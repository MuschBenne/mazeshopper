import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createSession, deleteSession, getSessionUser } from '$lib/server/session';
import { sendPasswordReset } from '$lib/server/email';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const RESET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const RESET_MAX_PER_HOUR = 3;

/** @param {string} s */
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @returns {string} 64-char hex token */
function generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} token */
async function hashToken(token) {
    const data = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} email */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ user: null });
    const db = await getDb();
    const dbUser = await db.collection('users').findOne({ username });
    return json({ user: { username, email: dbUser?.email ?? null } });
}

export async function POST({ request, cookies }) {
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
        const { username, password, email } = body;

        if (!email || !isValidEmail(email)) {
            return json({ error: 'invalid_email' }, { status: 400 });
        }
        const emailNorm = email.trim().toLowerCase();

        const existsUsername = await users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (existsUsername) return json({ error: 'taken' }, { status: 400 });

        const existsEmail = await users.findOne({ email: emailNorm });
        if (existsEmail) return json({ error: 'email_taken' }, { status: 400 });

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const name = username.trim();
        await users.insertOne({ username: name, password: hash, email: emailNorm });
        await createSession(cookies, name);
        return json({ ok: true, user: { username: name, email: emailNorm } });
    }

    if (action === 'login') {
        const { username, password } = body;
        const user = await users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (!user) return json({ error: 'not_found' }, { status: 401 });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return json({ error: 'wrong_password' }, { status: 401 });
        await createSession(cookies, user.username);
        return json({ ok: true, user: { username: user.username, email: user.email ?? null } });
    }

    if (action === 'update_email') {
        const username = await getSessionUser(cookies);
        if (!username) return json({ error: 'unauthorized' }, { status: 401 });

        const { email } = body;
        if (!email || !isValidEmail(email)) return json({ error: 'invalid_email' }, { status: 400 });

        const emailNorm = email.trim().toLowerCase();
        const existing = await users.findOne({ email: emailNorm });
        if (existing && existing.username !== username) return json({ error: 'email_taken' }, { status: 400 });

        await users.updateOne({ username }, { $set: { email: emailNorm } });
        return json({ ok: true });
    }

    // ── Password reset ────────────────────────────────────────────────────────

    if (action === 'request_reset') {
        const { email } = body;
        // Always return ok to avoid revealing whether email exists
        if (!email || !isValidEmail(email)) return json({ ok: true });

        const emailNorm = email.trim().toLowerCase();
        const user = await users.findOne({ email: emailNorm });
        if (!user) return json({ ok: true });

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
        if (newPassword.length < 8) return json({ error: 'too_short' }, { status: 400 });

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

        // Delete all reset tokens for this email
        await resets.deleteMany({ email: reset.email });

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
        await db.collection('lists').deleteMany({ owner: username });
        await db.collection('lists').updateMany(
            { $or: [{ sharedWith: username }, { pendingInvites: username }] },
            // @ts-ignore — MongoDB $pull with plain string value is valid at runtime
            { $pull: { sharedWith: username, pendingInvites: username } }
        );
        await db.collection('stores').deleteMany({ owner: username });
        await db.collection('user_settings').deleteMany({ owner: username });

        cookies.delete('session', { path: '/' });
        return json({ ok: true });
    }

    return json({ error: 'unknown action' }, { status: 400 });
}
