import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';
import { listAccessFilter, serializeList } from '$lib/server/utils';
import { getUserCategories } from '$lib/server/categories';
import { ObjectId } from 'mongodb';

export async function load({ cookies, params }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    if (!ObjectId.isValid(params.id)) return { list: null, categories: [] };

    const db = await getDb();
    const list = await db.collection('lists').findOne({
        _id: new ObjectId(params.id),
        ...listAccessFilter(username)
    });

    if (!list) return { list: null, categories: [] };

    // Listan skickas med så sidan kan rendera direkt, utan att vänta på att
    // klientens /api/lists-hämtning blir klar.
    const serialized = serializeList(list);

    // Kategorierna kommer ur ägarens palett, så alla som delar listan ser samma
    // namn och färger. Varor med kategorier mottagaren själv inte har visas
    // ändå, via fallbacken för okända kategorinamn.
    const categories = await getUserCategories(db, list.owner);

    return { list: serialized, categories };
}
