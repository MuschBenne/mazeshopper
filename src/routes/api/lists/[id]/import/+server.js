import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });
    const list = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        $or: [{ owner: username }, { sharedWith: username }]
    });
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    if (!Array.isArray(body.items)) return json({ error: 'invalid_items' }, { status: 400 });

    const items = body.items.map(/** @param {Record<string,unknown>} i */ i => ({
        itemId: crypto.randomUUID(),
        name: String(i.name ?? '').trim().slice(0, 200),
        spec: String(i.spec ?? '').trim().slice(0, 500),
        quantity: Number.isInteger(i.quantity) && /** @type {number} */ (i.quantity) > 0 && /** @type {number} */ (i.quantity) <= 9999 ? i.quantity : 1,
        bought: false,
        category: String(i.category ?? '').trim().slice(0, 50)
    })).filter(/** @param {{ name: string }} i */ i => i.name);

    if (items.length === 0) return json({ ok: true, count: 0, items: [] });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        // @ts-ignore — MongoDB driver types don't accept plain objects for $push $each
        { $push: { items: { $each: items } } }
    );
    return json({ ok: true, count: items.length, items });
}
