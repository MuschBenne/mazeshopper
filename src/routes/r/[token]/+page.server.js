import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { serializeTemplate } from '$lib/server/utils';

// Publik läsvy för ett delat recept. Kräver ingen inloggning — poängen med
// delningslänken är att den ska gå att skicka till vem som helst.
export async function load({ params, cookies }) {
    const db = await getDb();
    const doc = await db.collection('templates').findOne({ shareToken: params.token });
    if (!doc) error(404, 'Länken gäller inte längre.');

    const username = await getSessionUser(cookies);
    const recipe = serializeTemplate(doc);

    return {
        // Token ligger redan i adressen; den behöver inte följa med i datan.
        recipe: { ...recipe, shareToken: null },
        sharedBy: doc.owner,
        isLoggedIn: Boolean(username),
        isOwn: username === doc.owner
    };
}
