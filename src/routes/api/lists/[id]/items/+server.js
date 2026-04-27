import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

/**
 * @param {import('mongodb').Db} db
 * @param {string} listId
 * @param {string} username
 */
async function getAccessibleList(db, listId, username) {
    if (!ObjectId.isValid(listId)) return null;
    return db.collection('lists').findOne({
        _id: new ObjectId(listId),
        $or: [{ owner: username }, { sharedWith: username }]
    });
}

// Adds a new item to the list. Both owner and shared users can add items.
export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getAccessibleList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();

    // Only allow known fields — never trust the client blindly.
    const item = {
        itemId: crypto.randomUUID(),
        name: String(body.name ?? '').trim().slice(0, 200),
        spec: String(body.spec ?? '').trim().slice(0, 500),
        quantity: Number.isInteger(body.quantity) && body.quantity > 0 && body.quantity <= 9999 ? body.quantity : 1,
        bought: false,
        category: String(body.category ?? '').trim().slice(0, 50)
    };
    if (!item.name) return json({ error: 'invalid_item' }, { status: 400 });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        // @ts-ignore — MongoDB driver types don't accept plain objects for $push
        { $push: { items: item } }
    );
    return json({ ok: true });
}

// Deletes items from the list.
// ?bought=true removes only checked-off items; omitting it clears the entire list.
export async function DELETE({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getAccessibleList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    const url = new URL(request.url);
    const bought = url.searchParams.get('bought') === 'true';

    if (bought) {
        // Remove only items that have been marked as bought.
        await db.collection('lists').updateOne(
            { _id: new ObjectId(params.id) },
            // @ts-ignore — MongoDB driver types don't accept plain objects for $pull
            { $pull: { items: { bought: true } } }
        );
    } else {
        // Replace the entire items array with an empty one.
        await db.collection('lists').updateOne(
            { _id: new ObjectId(params.id) },
            { $set: { items: [] } }
        );
    }
    return json({ ok: true });
}
