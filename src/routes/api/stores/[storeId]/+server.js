import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.storeId)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const result = await db.collection('stores').deleteOne({ _id: new ObjectId(params.storeId), owner: username });
    if (result.deletedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}

export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.storeId)) return json({ error: 'not_found' }, { status: 404 });

    const { positions, categoryOrder } = await request.json();
    const db = await getDb();
    const result = await db.collection('stores').updateOne(
        { _id: new ObjectId(params.storeId), owner: username },
        { $set: { positions, categoryOrder } }
    );
    if (result.matchedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}
