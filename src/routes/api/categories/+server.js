import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { getUserCategories } from '$lib/server/categories';

const validHex = /^#[0-9a-fA-F]{6}$/;
const fallbackColors = [
    '#e2e8f0', '#fbcfe8', '#a7f3d0', '#fde68a',
    '#c7d2fe', '#fda4af', '#99f6e4', '#ddd6fe'
];

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    return json({ categories: await getUserCategories(db, username) });
}

export async function POST({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const body = await request.json();
    const name = String(body.name ?? '').trim().slice(0, 50);
    if (!name) return json({ error: 'invalid_name' }, { status: 400 });

    const db = await getDb();
    const categories = await getUserCategories(db, username);

    // Namnet är det som binder varor till kategorier, så två med samma namn
    // vore samma hink med två färger.
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return json({ error: 'duplicate_name' }, { status: 409 });
    }
    if (categories.length >= 60) return json({ error: 'too_many' }, { status: 400 });

    const group = typeof body.group === 'string' && body.group.trim()
        ? body.group.trim().slice(0, 50)
        : null;

    const category = {
        id: crypto.randomUUID(),
        name,
        color: validHex.test(String(body.color)) ? body.color : fallbackColors[categories.length % fallbackColors.length],
        group
    };

    await db.collection('users').updateOne(
        { username },
        // @ts-ignore — MongoDB-typerna accepterar inte vanliga objekt i $push
        { $push: { categories: category } }
    );
    return json({ category });
}
