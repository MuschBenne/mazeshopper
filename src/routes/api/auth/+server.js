import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createSession, deleteSession, getSessionUser } from '$lib/server/session';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/** @param {string} s */
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    return json({ user: username ? { username } : null });
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
        const { username, password } = body;
        const exists = await users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (exists) return json({ error: 'taken' }, { status: 400 });
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const name = username.trim();
        await users.insertOne({ username: name, password: hash });
        await createSession(cookies, name);
        return json({ ok: true, user: { username: name } });
    }

    if (action === 'login') {
        const { username, password } = body;
        const user = await users.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (!user) return json({ error: 'not_found' }, { status: 401 });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return json({ error: 'wrong_password' }, { status: 401 });
        await createSession(cookies, user.username);
        return json({ ok: true, user: { username: user.username } });
    }

    return json({ error: 'unknown action' }, { status: 400 });
}
