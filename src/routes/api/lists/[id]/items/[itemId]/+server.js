import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

// Returns the list only if the current user is the owner or in the sharedWith array.
async function getAccessibleList(db, listId, username) {
    if (!ObjectId.isValid(listId)) return null;
    return db.collection('lists').findOne({
        _id: new ObjectId(listId),
        $or: [{ owner: username }, { sharedWith: username }]
    });
}

// Removes a single item from the list by its itemId.
export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getAccessibleList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        { $pull: { items: { itemId: params.itemId } } }
    );
    return json({ ok: true });
}

// Partially updates a single item. Accepts: bought, quantity, name, spec.
// Uses MongoDB arrayFilters to target the specific item inside the embedded array.
export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getAccessibleList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();

    // Only allow updating bought, quantity, name, and spec.
    /** @type {Record<string, any>} */
    const setFields = {};
    if (typeof body.bought === 'boolean') setFields['items.$[el].bought'] = body.bought;
    if (Number.isInteger(body.quantity) && body.quantity > 0) setFields['items.$[el].quantity'] = body.quantity;
    if (typeof body.name === 'string' && body.name.trim().length > 0) setFields['items.$[el].name'] = body.name.trim();
    if (typeof body.spec === 'string') setFields['items.$[el].spec'] = body.spec.trim();

    if (Object.keys(setFields).length === 0) return json({ error: 'no_valid_fields' }, { status: 400 });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        { $set: setFields },
        { arrayFilters: [{ 'el.itemId': params.itemId }] }
    );
    return json({ ok: true });
}
