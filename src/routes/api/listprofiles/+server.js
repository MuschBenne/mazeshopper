import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

/** @param {any} doc */
function serializeProfile(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        categories: doc.categories ?? []
    };
}

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const profiles = await db.collection('listprofiles').find({ owner: username }).toArray();
    return json({ profiles: profiles.map(serializeProfile) });
}

export async function POST({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        return json({ error: 'invalid_name' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection('listprofiles').insertOne({
        owner: username,
        name: name.trim(),
        categories: [],
        createdAt: new Date()
    });
    return json({ profile: { id: result.insertedId.toString(), name: name.trim(), categories: [] } });
}
