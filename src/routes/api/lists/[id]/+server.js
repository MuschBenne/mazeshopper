import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

// Returns a single list by ID — only accessible to the owner or shared users.
export async function GET({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const doc = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        $or: [{ owner: username }, { sharedWith: username }]
    });
    if (!doc) return json({ error: 'not_found' }, { status: 404 });

    return json({ list: serializeList(doc) });
}

// Permanently deletes a list — only the owner is allowed to do this.
export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    // The owner filter prevents shared users from deleting a list they don't own.
    const result = await db.collection('lists').deleteOne({ _id: new ObjectId(params.id), owner: username });
    if (result.deletedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}

// Converts a MongoDB document into the plain object shape expected by the client.
/** @param {any} doc */
function serializeList(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        owner: doc.owner,
        sharedWith: doc.sharedWith ?? [],
        pendingInvites: doc.pendingInvites ?? [],
        items: (doc.items ?? []).map(/** @param {any} item */ item => ({
            itemId: item.itemId,
            name: item.name,
            spec: item.spec,
            quantity: item.quantity,
            bought: item.bought,
            category: item.category
        }))
    };
}
