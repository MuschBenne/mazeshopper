import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

const validHex = /^#[0-9a-fA-F]{6}$/;

export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const { name, color } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
        return json({ error: 'invalid_name' }, { status: 400 });
    }
    const safeColor = validHex.test(String(color ?? '')) ? color : '#e2e8f0';
    const catId = crypto.randomUUID();
    const category = { id: catId, name: name.trim(), color: safeColor };

    const db = await getDb();
    const result = await db.collection('listprofiles').updateOne(
        { _id: new ObjectId(params.id), owner: username },
        /** @type {any} */ ({ $push: { categories: category } })
    );
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ category });
}
