import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const stores = await db.collection('stores').find({ owner: username }).toArray();
    return json({ stores: stores.map(serializeStore) });
}

export async function POST({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
        return json({ error: 'invalid_name' }, { status: 400 });
    }
    const db = await getDb();
    const result = await db.collection('stores').insertOne({ owner: username, name: name.trim(), categoryOrder: {}, positions: {} });
    return json({ store: { id: result.insertedId.toString(), name: name.trim(), categoryOrder: {}, positions: {} } });
}

/** @param {any} doc */
function serializeStore(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        categoryOrder: doc.categoryOrder ?? {},
        positions: doc.positions ?? {}
    };
}
