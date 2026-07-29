import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { serializeTemplate } from '$lib/server/utils';

// Sparar ett delat recept som en egen kopia. Kopia, inte prenumeration: den
// som sparar ska kunna ändra fritt utan att påverka originalet, och utan att
// referera till en profil eller ett konto som inte är deras.
export async function POST({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const source = await db.collection('templates').findOne({ shareToken: params.token });
    if (!source) return json({ error: 'not_found' }, { status: 404 });
    if (source.owner === username) return json({ error: 'already_yours' }, { status: 409 });

    const count = await db.collection('templates').countDocuments({ owner: username });
    if (count >= 50) return json({ error: 'too_many_templates' }, { status: 400 });

    // Kategorierna följer med som namn. De som mottagaren inte har visas via
    // samma fallback som varor i delade listor, så inget innehåll tappas.
    const doc = {
        owner: username,
        name: String(source.name ?? '').slice(0, 100),
        kind: source.kind === 'recipe' ? 'recipe' : 'template',
        ...(source.kind === 'recipe' ? { servings: source.servings ?? 4 } : {}),
        items: (source.items ?? []).map(/** @param {any} i */ i => ({
            itemId: crypto.randomUUID(),
            name: String(i.name ?? '').slice(0, 200),
            spec: String(i.spec ?? '').slice(0, 500),
            quantity: i.quantity ?? 1,
            unit: String(i.unit ?? '').slice(0, 20),
            category: String(i.category ?? '').slice(0, 50)
        }))
    };

    const result = await db.collection('templates').insertOne(doc);
    return json({ template: serializeTemplate({ ...doc, _id: result.insertedId }) });
}
