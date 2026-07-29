import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';
import { serializeTemplate, clampServings } from '$lib/server/utils';

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const templates = await db.collection('templates').find({ owner: username }).toArray();
    return json({ templates: templates.map(serializeTemplate) });
}

export async function POST({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const body = await request.json();
    const name = String(body.name ?? '').trim().slice(0, 100);
    if (!name) return json({ error: 'invalid_name' }, { status: 400 });

    const profileId = typeof body.profileId === 'string' ? body.profileId : null;
    if (profileId) {
        const profile = await db.collection('listprofiles').findOne({ owner: username, _id: new ObjectId(profileId) });
        if (!profile) return json({ error: 'invalid_profile' }, { status: 400 });
    }

    const count = await db.collection('templates').countDocuments({ owner: username });
    if (count >= 50) return json({ error: 'too_many_templates' }, { status: 400 });

    // Ett recept är en mall med portioner. Skillnaden är två fält, inte en
    // egen domän — import, redigering och delning är samma kod.
    const kind = body.kind === 'recipe' ? 'recipe' : 'template';
    const servings = kind === 'recipe' ? clampServings(body.servings) : undefined;

    const doc = {
        owner: username,
        name,
        kind,
        items: [],
        ...(servings !== undefined ? { servings } : {}),
        ...(profileId ? { profileId } : {})
    };
    const result = await db.collection('templates').insertOne(doc);
    return json({ template: serializeTemplate({ ...doc, _id: result.insertedId }) });
}
