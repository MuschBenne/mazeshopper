import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { listAccessFilter, serializeList } from '$lib/server/utils';
import { ObjectId } from 'mongodb';

// Returns all lists where the current user is either the owner or in the sharedWith array.
export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const lists = await db.collection('lists').find(listAccessFilter(username)).toArray();

    return json({ lists: lists.map(serializeList) });
}

// Creates a new empty shopping list owned by the current user.
export async function POST({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const { name, profileId } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        return json({ error: 'invalid_name' }, { status: 400 });
    }
    if (!profileId || typeof profileId !== 'string' || !ObjectId.isValid(profileId)) {
        return json({ error: 'invalid_profile' }, { status: 400 });
    }

    const db = await getDb();
    // Profilen slogs tidigare aldrig upp här — bara typen kontrollerades. En
    // lista kunde därför peka på en profil som inte finns, och fick då ingen
    // kategoriväljare alls. Mallar har alltid gjort den här kontrollen.
    const profile = await db.collection('listprofiles').findOne({
        _id: new ObjectId(profileId),
        owner: username
    });
    if (!profile) return json({ error: 'invalid_profile' }, { status: 400 });

    const result = await db.collection('lists').insertOne({
        name: name.trim(),
        owner: username,
        profileId,
        sharedWith: [],
        pendingInvites: [],
        items: []
    });

    const list = { id: result.insertedId.toString(), name: name.trim(), owner: username, profileId, sharedWith: [], pendingInvites: [], items: [] };
    return json({ list });
}
