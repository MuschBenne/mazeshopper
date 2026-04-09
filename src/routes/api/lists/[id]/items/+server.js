import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

/** Verify user has access (owner or sharedWith) */
async function getAccessibleList(db, listId, username) {
    if (!ObjectId.isValid(listId)) return null;
    return db.collection('lists').findOne({
        _id: new ObjectId(listId),
        $or: [{ owner: username }, { sharedWith: username }]
    });
}

export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getAccessibleList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();

    // Only allow known fields – never trust the client blindly
    const item = {
        itemId: typeof body.itemId === 'string' ? body.itemId : crypto.randomUUID(),
        name: String(body.name ?? '').trim(),
        spec: String(body.spec ?? '').trim(),
        quantity: Number.isInteger(body.quantity) && body.quantity > 0 ? body.quantity : 1,
        bought: false,
        category: String(body.category ?? '').trim()
    };
    if (!item.name) return json({ error: 'invalid_item' }, { status: 400 });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        { $push: { items: item } }
    );
    return json({ ok: true });
}

export async function DELETE({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getAccessibleList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    const url = new URL(request.url);
    const bought = url.searchParams.get('bought') === 'true';

    if (bought) {
        await db.collection('lists').updateOne(
            { _id: new ObjectId(params.id) },
            { $pull: { items: { bought: true } } }
        );
    } else {
        await db.collection('lists').updateOne(
            { _id: new ObjectId(params.id) },
            { $set: { items: [] } }
        );
    }
    return json({ ok: true });
}
