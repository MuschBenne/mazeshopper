import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';
import { listAccessFilter, serializeList } from '$lib/server/utils';

export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    const db = await getDb();
    const docs = await db.collection('lists').find(listAccessFilter(username)).toArray();

    return { lists: docs.map(serializeList) };
}
