import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';

// Mallarna hämtades tidigare först efter hydrering, eftersom sidan saknade
// server-load helt. Sidan stod alltså tom en stund även när svaret var snabbt.
export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    const db = await getDb();
    const docs = await db.collection('templates').find({ owner: username }).toArray();

    return {
        templates: docs.map(t => ({
            id: t._id.toString(),
            owner: t.owner,
            name: t.name,
            items: t.items ?? [],
            profileId: t.profileId ?? null
        }))
    };
}
