import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        return json({ error: 'invalid_name' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection('listprofiles').updateOne(
        { _id: new ObjectId(params.id), owner: username },
        { $set: { name: name.trim() } }
    );
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
}

export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();

    const listCount = await db.collection('lists').countDocuments({ owner: username, profileId: params.id });
    if (listCount > 0) return json({ error: 'in_use_lists' }, { status: 409 });

    const storeCount = await db.collection('stores').countDocuments({ owner: username, profileId: params.id });
    if (storeCount > 0) return json({ error: 'in_use_stores' }, { status: 409 });

    const result = await db.collection('listprofiles').deleteOne({ _id: new ObjectId(params.id), owner: username });
    if (result.deletedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
}
