import { dev } from '$app/environment';
import { getDb } from './db.js';

/** @param {string} token */
export async function hashToken(token) {
    const data = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the username for the current session token, or null if invalid.
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @returns {Promise<string | null>}
 */
export async function getSessionUser(cookies) {
    const token = cookies.get('session');
    if (!token) return null;
    const tokenHash = await hashToken(token);
    const db = await getDb();
    const session = await db.collection('sessions').findOne({ tokenHash, expiresAt: { $gt: new Date() } });
    return session ? session.username : null;
}

function generateSessionToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a new session and sets the cookie.
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {string} username
 */
export async function createSession(cookies, username) {
    const token = generateSessionToken();
    const tokenHash = await hashToken(token);
    const db = await getDb();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.collection('sessions').insertOne({
        tokenHash,
        username,
        createdAt: new Date(),
        expiresAt
    });
    cookies.set('session', token, {
        path: '/',
        httpOnly: true,
        secure: !dev,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax'
    });
}

/**
 * Deletes the current session and clears the cookie.
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export async function deleteSession(cookies) {
    const token = cookies.get('session');
    if (token) {
        const tokenHash = await hashToken(token);
        const db = await getDb();
        await db.collection('sessions').deleteOne({ tokenHash });
    }
    cookies.delete('session', { path: '/' });
}
