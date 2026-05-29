import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

const validHex = /^#[0-9a-fA-F]{6}$/;

export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const { name, color } = await request.json();
    /** @type {Record<string, string>} */
    const updates = {};
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
            return json({ error: 'invalid_name' }, { status: 400 });
        }
        updates['categories.$.name'] = name.trim();
    }
    if (color !== undefined) {
        updates['categories.$.color'] = validHex.test(String(color)) ? color : '#e2e8f0';
    }
    if (Object.keys(updates).length === 0) return json({ error: 'nothing_to_update' }, { status: 400 });

    const db = await getDb();
    const result = await db.collection('listprofiles').updateOne(
        { _id: new ObjectId(params.id), owner: username, 'categories.id': params.catId },
        { $set: updates }
    );
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
}

export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const result = await db.collection('listprofiles').updateOne(
        { _id: new ObjectId(params.id), owner: username },
        // @ts-ignore — MongoDB $pull with object match is valid at runtime
        { $pull: { categories: { id: params.catId } } }
    );
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
}
