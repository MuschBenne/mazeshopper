import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

// Permanently deletes a store. Only the owner can delete their own stores.
export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.storeId)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    // The owner filter prevents one user from deleting another user's store.
    const result = await db.collection('stores').deleteOne({ _id: new ObjectId(params.storeId), owner: username });
    if (result.deletedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}

// Saves the drag-and-drop layout for a store: category positions on the map
// and the derived categoryOrder used to sort shopping list items.
export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.storeId)) return json({ error: 'not_found' }, { status: 404 });

    const body = await request.json();
    const { positions, categoryOrder } = body;

    /** @param {unknown} v */
    const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (!isPlainObject(positions) || !isPlainObject(categoryOrder)) {
        return json({ error: 'invalid' }, { status: 400 });
    }
    const MAX_KEYS = 200;
    if (Object.keys(positions).length > MAX_KEYS || Object.keys(categoryOrder).length > MAX_KEYS) {
        return json({ error: 'too_large' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection('stores').updateOne(
        { _id: new ObjectId(params.storeId), owner: username },
        { $set: { positions, categoryOrder } }
    );
    if (result.matchedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}
