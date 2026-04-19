import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

// Returns all stores owned by the current user.
export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const stores = await db.collection('stores').find({ owner: username }).toArray();
    return json({ stores: stores.map(serializeStore) });
}

// Creates a new store with an empty layout — category positions are set later via PATCH.
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

// Converts a MongoDB document into the plain object shape expected by the client.
/** @param {any} doc */
function serializeStore(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        categoryOrder: doc.categoryOrder ?? {},
        positions: doc.positions ?? {}
    };
}
