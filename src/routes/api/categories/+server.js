import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

const defaultCategories = [
    { name: 'Frukt & Grönt',  color: '#bbf7d0' },
    { name: 'Mejeri',         color: '#fef9c3' },
    { name: 'Kött & Fisk',    color: '#fecaca' },
    { name: 'Bröd & Bageri',  color: '#fed7aa' },
    { name: 'Konserver',      color: '#d9f99d' },
    { name: 'Snacks & Godis', color: '#f5d0fe' },
    { name: 'Drycker',        color: '#bfdbfe' },
    { name: 'Frys',           color: '#cffafe' }
];

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const doc = await db.collection('user_settings').findOne({ owner: username });
    return json({ categories: doc ? doc.categories : defaultCategories });
}

export async function PUT({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const { categories } = await request.json();
    if (!Array.isArray(categories)) return json({ error: 'invalid' }, { status: 400 });

    // Only allow known fields per category
    const clean = categories.map(/** @param {any} c */ c => ({
        name: String(c.name ?? '').trim(),
        color: String(c.color ?? '#e2e8f0').trim()
    })).filter(c => c.name.length > 0);

    const db = await getDb();
    await db.collection('user_settings').updateOne(
        { owner: username },
        { $set: { categories: clean } },
        { upsert: true }
    );
    return json({ ok: true });
}
