import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export async function load({ cookies, params }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    if (!ObjectId.isValid(params.id)) return { profileCategories: [] };

    const db = await getDb();
    const list = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        $or: [{ owner: username }, { sharedWith: username }]
    });

    if (!list?.profileId) return { profileCategories: [] };

    const profile = await db.collection('listprofiles').findOne({
        _id: new ObjectId(list.profileId)
    });
    return { profileCategories: profile?.categories ?? [] };
}
