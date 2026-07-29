import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { listAccessFilter, serializeList } from '$lib/server/utils';

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
    // profileId är kvar som frivilligt fält under övergången, men krävs inte
    // längre: kategorierna kommer ur användarens palett, inte ur en profil.
    const db = await getDb();
    const result = await db.collection('lists').insertOne({
        name: name.trim(),
        owner: username,
        profileId: profileId ?? null,
        sharedWith: [],
        pendingInvites: [],
        items: []
    });

    const list = { id: result.insertedId.toString(), name: name.trim(), owner: username, profileId: profileId ?? null, sharedWith: [], pendingInvites: [], items: [] };
    return json({ list });
}
