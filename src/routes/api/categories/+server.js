import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

// Fallback used when the user has no saved settings document yet.
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

// Returns the user's saved categories, or the defaults if none have been saved.
export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const doc = await db.collection('user_settings').findOne({ owner: username });
    return json({ categories: doc ? doc.categories : defaultCategories });
}

// Replaces the user's entire category list. Uses upsert so new users get a settings doc created automatically.
export async function PUT({ request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const { categories } = await request.json();
    if (!Array.isArray(categories)) return json({ error: 'invalid' }, { status: 400 });

    // Strip unknown fields and filter out any entries with an empty or too-long name.
    const validHex = /^#[0-9a-fA-F]{6}$/;
    const MAX_CATEGORIES = 200;
    const clean = categories.slice(0, MAX_CATEGORIES).map(/** @param {any} c */ c => ({
        name: String(c.name ?? '').trim().slice(0, 100),
        color: validHex.test(String(c.color ?? '')) ? String(c.color).trim() : '#e2e8f0'
    })).filter(c => c.name.length > 0);

    const db = await getDb();
    await db.collection('user_settings').updateOne(
        { owner: username },
        { $set: { categories: clean } },
        { upsert: true }
    );
    return json({ ok: true });
}
