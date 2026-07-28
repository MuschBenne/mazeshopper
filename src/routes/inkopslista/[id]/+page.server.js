import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';
import { listAccessFilter, serializeList } from '$lib/server/utils';
import { ObjectId } from 'mongodb';

export async function load({ cookies, params }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    if (!ObjectId.isValid(params.id)) return { list: null, profileCategories: [] };

    const db = await getDb();
    const list = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        ...listAccessFilter(username)
    });

    if (!list) return { list: null, profileCategories: [] };

    // Listan skickas med så sidan kan rendera direkt, utan att vänta på att
    // klientens /api/lists-hämtning blir klar.
    const serialized = serializeList(list);

    if (!list.profileId || !ObjectId.isValid(list.profileId)) {
        return { list: serialized, profileCategories: [] };
    }

    const profile = await db.collection('listprofiles').findOne({
        _id: new ObjectId(list.profileId)
    });
    return { list: serialized, profileCategories: profile?.categories ?? [] };
}
