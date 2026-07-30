import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { listAccessFilter } from '$lib/server/utils';
import { normalizeUnit, scaleQuantity } from '$lib/units';
import { ObjectId } from 'mongodb';

export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });
    const list = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        ...listAccessFilter(username)
    });
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    if (!Array.isArray(body.items)) return json({ error: 'invalid_items' }, { status: 400 });

    // Skalfaktor för recept: dubbla portioner ska ge dubbla mängder. Hur den
    // avrundas beror på enheten — se scaleQuantity. Enheten följer med till
    // listvaran, annars gick "3 dl grädde" in i listan som "×3 grädde".
    const rawScale = Number(body.scale);
    const scale = Number.isFinite(rawScale) && rawScale > 0 ? Math.min(99, rawScale) : 1;

    const items = body.items.map(/** @param {Record<string,unknown>} i */ i => {
        const unit = normalizeUnit(i.unit);
        return {
            itemId: crypto.randomUUID(),
            name: String(i.name ?? '').trim().slice(0, 200),
            spec: String(i.spec ?? '').trim().slice(0, 500),
            quantity: scaleQuantity(i.quantity, unit, scale),
            unit,
            bought: false,
            category: String(i.category ?? '').trim().slice(0, 50),
            addedBy: username
        };
    }).filter(/** @param {{ name: string }} i */ i => i.name);

    if (items.length === 0) return json({ ok: true, count: 0, items: [] });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        // @ts-ignore — MongoDB driver types don't accept plain objects for $push $each
        { $push: { items: { $each: items } } }
    );
    return json({ ok: true, count: items.length, items });
}
