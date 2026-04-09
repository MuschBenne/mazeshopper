import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const result = await db.collection('lists').deleteOne({ _id: new ObjectId(params.id), owner: username });
    if (result.deletedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}
