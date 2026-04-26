import { getDb } from './db.js';

/**
 * Returns the username for the current session token, or null if invalid.
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @returns {Promise<string | null>}
 */
export async function getSessionUser(cookies) {
    const token = cookies.get('session');
    if (!token) return null;
    const db = await getDb();
    const session = await db.collection('sessions').findOne({ token, expiresAt: { $gt: new Date() } });
    return session ? session.username : null;
}

/**
 * Creates a new session and sets the cookie.
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {string} username
 */
export async function createSession(cookies, username) {
    const token = crypto.randomUUID();
    const db = await getDb();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.collection('sessions').insertOne({
        token,
        username,
        createdAt: new Date(),
        expiresAt
    });
    cookies.set('session', token, {
        path: '/',
        httpOnly: true,
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
        const db = await getDb();
        await db.collection('sessions').deleteOne({ token });
    }
    cookies.delete('session', { path: '/' });
}
