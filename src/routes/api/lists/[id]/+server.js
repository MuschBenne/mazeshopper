import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { listAccessFilter, serializeList } from '$lib/server/utils';
import { ObjectId } from 'mongodb';

// Returns a single list by ID — only accessible to the owner or shared users.
export async function GET({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const doc = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        ...listAccessFilter(username)
    });
    if (!doc) return json({ error: 'not_found' }, { status: 404 });

    return json({ list: serializeList(doc) });
}

// Byter listans profil. Fanns tidigare inte alls: valde man fel profil när
// listan skapades var enda utvägen att radera listan och börja om. Bara ägaren
// får byta, eftersom kategorierna som visas för alla kommer ur ägarens profil.
export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const { profileId } = await request.json();
    if (!profileId || typeof profileId !== 'string' || !ObjectId.isValid(profileId)) {
        return json({ error: 'invalid_profile' }, { status: 400 });
    }

    const db = await getDb();
    const profile = await db.collection('listprofiles').findOne({
        _id: new ObjectId(profileId),
        owner: username
    });
    if (!profile) return json({ error: 'invalid_profile' }, { status: 400 });

    // Varornas kategorier är namn och rörs inte. De som saknas i den nya
    // profilen visas fortfarande, via samma fallback som delade listor använder.
    const result = await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id), owner: username },
        { $set: { profileId } }
    );
    if (result.matchedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}

// Permanently deletes a list — only the owner is allowed to do this.
export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    // The owner filter prevents shared users from deleting a list they don't own.
    const result = await db.collection('lists').deleteOne({ _id: new ObjectId(params.id), owner: username });
    if (result.deletedCount === 0) return json({ error: 'forbidden' }, { status: 403 });
    return json({ ok: true });
}
