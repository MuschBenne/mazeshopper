import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const lists = await db.collection('lists').find({
        $or: [
            { owner: username },
            { sharedWith: { $elemMatch: { $regex: new RegExp(`^${username}$`, 'i') } } }
        ]
    }).toArray();

    return json({ lists: lists.map(serializeList) });
}

export async function POST({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
        return json({ error: 'invalid_name' }, { status: 400 });
    }
    const db = await getDb();
    const result = await db.collection('lists').insertOne({
        name: name.trim(),
        owner: username,
        sharedWith: [],
        pendingInvites: [],
        items: []
    });

    const list = { id: result.insertedId.toString(), name: name.trim(), owner: username, sharedWith: [], pendingInvites: [], items: [] };
    return json({ list });
}

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
