import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createSession, deleteSession, getSessionUser, hashToken } from '$lib/server/session';
import { sendPasswordReset, sendEmailVerification } from '$lib/server/email';
import { escapeRegex, isValidEmail, isValidPassword } from '$lib/server/utils';
import { DEFAULT_PROFILES } from '$lib/server/listprofile-defaults.js';
import bcrypt from 'bcryptjs';
import { dev } from '$app/environment';

const SALT_ROUNDS = dev ? 1 : 12;
const RESET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const RESET_MAX_PER_HOUR = 3;

/** @returns {string} 64-char hex token */
function generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}


export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ user: null });
    const db = await getDb();
    const dbUser = await db.collection('users').findOne({ username });
    return json({ user: { username, email: dbUser?.email ?? null, emailVerified: dbUser?.emailVerified ?? true } });
}

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** @param {import('@sveltejs/kit').RequestEvent} event */
function safeGetClientAddress(event) {
    try {
        return event.getClientAddress();
    } catch {
        return event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    }
}

export async function POST(event) {
    const { request, cookies } = event;
    const body = await request.json();
    const { action } = body;
    const db = await getDb();
    const users = db.collection('users');

    if (action === 'logout') {
        await deleteSession(cookies);
        return json({ ok: true });
    }

    if (action === 'exists') {
        const { username } = body;
        const user = await users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        return json({ exists: !!user });
    }

    if (action === 'register') {
        const ip = safeGetClientAddress(event);
        const regKey = `register:${ip}`;
        const regSince = new Date(Date.now() - LOGIN_WINDOW_MS);
        const regCount = await db.collection('login_attempts').countDocuments({ key: regKey, at: { $gt: regSince } });
        if (regCount >= 5) return json({ error: 'too_many_attempts' }, { status: 429 });
        await db.collection('login_attempts').insertOne({ key: regKey, at: new Date() });

        const { username, password, email } = body;

        if (!username || typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 30) {
            return json({ error: 'invalid_username' }, { status: 400 });
        }
        if (!password || !isValidPassword(password)) {
            return json({ error: 'weak_password' }, { status: 400 });
        }
        if (!email || !isValidEmail(email)) {
            return json({ error: 'invalid_email' }, { status: 400 });
        }
        const emailNorm = email.trim().toLowerCase();

        const existsUsername = await users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (existsUsername) return json({ error: 'taken' }, { status: 400 });

        const existsEmail = await users.findOne({ email: emailNorm });
        if (existsEmail) return json({ error: 'email_taken' }, { status: 400 });

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const name = username.trim().toLowerCase();
        await users.insertOne({ username: name, password: hash, email: emailNorm, emailVerified: false, listprofilesMigrated: true });
        await createSession(cookies, name);

        for (const def of DEFAULT_PROFILES) {
            await db.collection('listprofiles').insertOne({
                owner: name,
                name: def.name,
                categories: def.categories.map(c => ({ id: crypto.randomUUID(), ...c })),
                createdAt: new Date()
            });
        }

        const verifyToken = generateToken();
        const verifyTokenHash = await hashToken(verifyToken);
        await db.collection('email_verifications').insertOne({
            email: emailNorm, username: name, tokenHash: verifyTokenHash,
            createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        const origin = new URL(request.url).origin;
        try {
            await sendEmailVerification(emailNorm, name, `${origin}/verifiera-epost?token=${verifyToken}`);
        } catch (err) {
            console.error('Failed to send verification email:', err);
        }

        return json({ ok: true, user: { username: name, email: emailNorm, emailVerified: false } });
    }

    if (action === 'login') {
        const ip = safeGetClientAddress(event);
        const rateLimitKey = `login:${ip}`;
        const since = new Date(Date.now() - LOGIN_WINDOW_MS);
        const attempts = await db.collection('login_attempts').countDocuments({ key: rateLimitKey, at: { $gt: since } });
        if (attempts >= LOGIN_MAX_ATTEMPTS) {
            return json({ error: 'too_many_attempts' }, { status: 429 });
        }

        const { username, password } = body;
        const user = await users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (!user) {
            await db.collection('login_attempts').insertOne({ key: rateLimitKey, at: new Date() });
            return json({ error: 'invalid_credentials' }, { status: 401 });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            await db.collection('login_attempts').insertOne({ key: rateLimitKey, at: new Date() });
            return json({ error: 'invalid_credentials' }, { status: 401 });
        }
        await createSession(cookies, user.username);
        return json({ ok: true, user: { username: user.username, email: user.email ?? null, emailVerified: user.emailVerified ?? true } });
    }

    if (action === 'update_email') {
        const username = await getSessionUser(cookies);
        if (!username) return json({ error: 'unauthorized' }, { status: 401 });

        const { email } = body;
        if (!email || !isValidEmail(email)) return json({ error: 'invalid_email' }, { status: 400 });

        const emailNorm = email.trim().toLowerCase();
        const existing = await users.findOne({ email: emailNorm });
        if (existing && existing.username !== username) return json({ error: 'email_taken' }, { status: 400 });

        await users.updateOne({ username }, { $set: { email: emailNorm, emailVerified: false } });

        const verifyToken = generateToken();
        const verifyTokenHash = await hashToken(verifyToken);
        await db.collection('email_verifications').deleteMany({ email: emailNorm });
        await db.collection('email_verifications').insertOne({
            email: emailNorm, username, tokenHash: verifyTokenHash,
            createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        const originForVerify = new URL(request.url).origin;
        try {
            await sendEmailVerification(emailNorm, username, `${originForVerify}/verifiera-epost?token=${verifyToken}`);
        } catch (err) {
            console.error('Failed to send verification email on email change:', err);
        }

        return json({ ok: true });
    }

    // ── Password reset ────────────────────────────────────────────────────────

    if (action === 'request_reset') {
        const { email } = body;
        // Always return ok to avoid revealing whether email exists
        if (!email || !isValidEmail(email)) return json({ ok: true });

        const ip = safeGetClientAddress(event);
        const resetIpKey = `request_reset:${ip}`;
        const resetIpSince = new Date(Date.now() - LOGIN_WINDOW_MS);
        const resetIpCount = await db.collection('login_attempts').countDocuments({ key: resetIpKey, at: { $gt: resetIpSince } });
        if (resetIpCount >= 10) return json({ ok: true });
        await db.collection('login_attempts').insertOne({ key: resetIpKey, at: new Date() });

        const emailNorm = email.trim().toLowerCase();
        const user = await users.findOne({ email: emailNorm });
        if (!user) return json({ ok: true });
        if (!user.emailVerified) return json({ ok: true }); // silently skip — user needs to verify email first

        const resets = db.collection('password_resets');

        // Rate limit: max RESET_MAX_PER_HOUR requests per hour per email
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = await resets.countDocuments({
            email: emailNorm,
            createdAt: { $gt: oneHourAgo }
        });
        if (recentCount >= RESET_MAX_PER_HOUR) return json({ ok: true });

        // Invalidate any existing unused tokens for this email
        await resets.deleteMany({ email: emailNorm });

        const token = generateToken();
        const tokenHash = await hashToken(token);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + RESET_EXPIRY_MS);

        await resets.insertOne({
            email: emailNorm,
            username: user.username,
            tokenHash,
            createdAt: now,
            expiresAt
        });

        const origin = new URL(request.url).origin;
        const resetUrl = `${origin}/aterstall-losenord?token=${token}`;
        try {
            await sendPasswordReset(emailNorm, resetUrl);
        } catch (err) {
            console.error('Failed to send password reset email:', err);
        }

        return json({ ok: true });
    }

    if (action === 'reset_password') {
        const { token, newPassword } = body;
        if (!token || !newPassword) return json({ error: 'invalid' }, { status: 400 });
        if (!isValidPassword(newPassword)) return json({ error: 'weak_password' }, { status: 400 });

        const tokenHash = await hashToken(token);
        const resets = db.collection('password_resets');
        const reset = await resets.findOne({ tokenHash });

        if (!reset) return json({ error: 'invalid_token' }, { status: 400 });
        if (reset.expiresAt < new Date()) {
            await resets.deleteOne({ tokenHash });
            return json({ error: 'expired' }, { status: 400 });
        }

        const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await users.updateOne({ username: reset.username }, { $set: { password: hash } });

        // Invalidate all active sessions and reset tokens so old stolen sessions stop working.
        await db.collection('sessions').deleteMany({ username: reset.username });
        await resets.deleteMany({ email: reset.email });

        return json({ ok: true });
    }

    if (action === 'verify_email') {
        const { token } = body;
        if (!token) return json({ error: 'invalid' }, { status: 400 });
        const tokenHash = await hashToken(token);
        const verifications = db.collection('email_verifications');
        const verification = await verifications.findOne({ tokenHash });
        if (!verification) return json({ error: 'invalid_token' }, { status: 400 });
        if (verification.expiresAt < new Date()) {
            await verifications.deleteOne({ tokenHash });
            return json({ error: 'expired' }, { status: 400 });
        }
        await users.updateOne({ username: verification.username }, { $set: { emailVerified: true } });
        await verifications.deleteMany({ email: verification.email });
        return json({ ok: true });
    }

    if (action === 'resend_verification') {
        const username = await getSessionUser(cookies);
        if (!username) return json({ error: 'unauthorized' }, { status: 401 });

        const resendKey = `resend_verify:${username}`;
        const resendSince = new Date(Date.now() - LOGIN_WINDOW_MS);
        const resendCount = await db.collection('login_attempts').countDocuments({ key: resendKey, at: { $gt: resendSince } });
        if (resendCount >= 3) return json({ ok: true });
        await db.collection('login_attempts').insertOne({ key: resendKey, at: new Date() });

        const user = await users.findOne({ username });
        if (!user || user.emailVerified || !user.email) return json({ ok: true });
        const verifyToken = generateToken();
        const verifyTokenHash = await hashToken(verifyToken);
        await db.collection('email_verifications').deleteMany({ email: user.email });
        await db.collection('email_verifications').insertOne({
            email: user.email, username, tokenHash: verifyTokenHash,
            createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        const origin = new URL(request.url).origin;
        try {
            await sendEmailVerification(user.email, username, `${origin}/verifiera-epost?token=${verifyToken}`);
        } catch (err) {
            console.error('Failed to resend verification email:', err);
        }
        return json({ ok: true });
    }

    if (action === 'delete_account') {
        const username = await getSessionUser(cookies);
        if (!username) return json({ error: 'unauthorized' }, { status: 401 });

        const user = await users.findOne({ username });
        const email = user?.email ?? null;

        await users.deleteOne({ username });
        await db.collection('sessions').deleteMany({ username });
        if (email) await db.collection('password_resets').deleteMany({ email });
        if (email) await db.collection('email_verifications').deleteMany({ email });
        await db.collection('lists').deleteMany({ owner: username });
        await db.collection('lists').updateMany(
            { $or: [{ sharedWith: username }, { pendingInvites: username }] },
            // @ts-ignore — MongoDB $pull with plain string value is valid at runtime
            { $pull: { sharedWith: username, pendingInvites: username } }
        );
        await db.collection('invitations').deleteMany({ $or: [{ fromUser: username }, { toUser: username }] });
        await db.collection('stores').deleteMany({ owner: username });
        await db.collection('templates').deleteMany({ owner: username });
        await db.collection('user_settings').deleteMany({ owner: username });
        await db.collection('listprofiles').deleteMany({ owner: username });

        cookies.delete('session', { path: '/' });
        return json({ ok: true });
    }

    return json({ error: 'unknown action' }, { status: 400 });
}
