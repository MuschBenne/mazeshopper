import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';
import { serializeTemplate } from '$lib/server/utils';

// Mallarna hämtades tidigare först efter hydrering, eftersom sidan saknade
// server-load helt. Sidan stod alltså tom en stund även när svaret var snabbt.
export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    const db = await getDb();
    const docs = await db.collection('templates').find({ owner: username }).toArray();

    // Samma serialisering som GET /api/templates, så seedad data och hämtad
    // data har exakt samma form — annars saknar de seedade mallarna fälten
    // som recepten lägger till (kind, servings, shareToken).
    return { templates: docs.map(serializeTemplate) };
}
