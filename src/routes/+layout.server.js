import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';

export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return { user: null };
    const db = await getDb();
    const dbUser = await db.collection('users').findOne({ username });
    return { user: { username, email: dbUser?.email ?? null } };
}
