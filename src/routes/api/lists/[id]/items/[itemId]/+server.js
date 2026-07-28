import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { listAccessFilter } from '$lib/server/utils';
import { ObjectId } from 'mongodb';

// Removes a single item from the list by its itemId.
export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'forbidden' }, { status: 403 });

    const db = await getDb();
    const result = await db.collection('lists').updateOne(
        {
            _id: new ObjectId(params.id),
            ...listAccessFilter(username)
        },
        // @ts-ignore — MongoDB driver types don't accept plain objects for $pull
        { $pull: { items: { itemId: params.itemId } } }
    );
    if (result.matchedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}

// Partially updates a single item. Accepts: bought, quantity, name, spec.
// Uses MongoDB arrayFilters to target the specific item inside the embedded array.
// Access check is merged into the updateOne filter to save a round-trip.
export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const body = await request.json();

    // Only allow updating bought, quantity, name, spec, and category.
    /** @type {Record<string, any>} */
    const setFields = {};
    if (typeof body.bought === 'boolean') setFields['items.$[el].bought'] = body.bought;
    if (Number.isInteger(body.quantity) && body.quantity > 0 && body.quantity <= 9999) setFields['items.$[el].quantity'] = body.quantity;
    if (typeof body.name === 'string' && body.name.trim().length > 0) setFields['items.$[el].name'] = body.name.trim().slice(0, 200);
    if (typeof body.spec === 'string') setFields['items.$[el].spec'] = body.spec.trim().slice(0, 500);
    if (typeof body.category === 'string') setFields['items.$[el].category'] = body.category.trim().slice(0, 50);

    if (Object.keys(setFields).length === 0) return json({ error: 'no_valid_fields' }, { status: 400 });

    if (!ObjectId.isValid(params.id)) return json({ error: 'forbidden' }, { status: 403 });

    const db = await getDb();
    const result = await db.collection('lists').updateOne(
        {
            _id: new ObjectId(params.id),
            ...listAccessFilter(username)
        },
        { $set: setFields },
        { arrayFilters: [{ 'el.itemId': params.itemId }] }
    );
    if (result.matchedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}
