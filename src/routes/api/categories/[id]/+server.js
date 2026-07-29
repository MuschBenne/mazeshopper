import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { getUserCategories, renameCategoryEverywhere } from '$lib/server/categories';

const validHex = /^#[0-9a-fA-F]{6}$/;

export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const categories = await getUserCategories(db, username);
    const current = categories.find(c => c.id === params.id);
    if (!current) return json({ error: 'not_found' }, { status: 404 });

    const body = await request.json();
    /** @type {Record<string, unknown>} */
    const updates = {};

    let newName = null;
    if (body.name !== undefined) {
        const name = String(body.name).trim().slice(0, 50);
        if (!name) return json({ error: 'invalid_name' }, { status: 400 });
        const clash = categories.some(c => c.id !== params.id && c.name.toLowerCase() === name.toLowerCase());
        if (clash) return json({ error: 'duplicate_name' }, { status: 409 });
        updates['categories.$.name'] = name;
        if (name !== current.name) newName = name;
    }

    if (body.color !== undefined) {
        updates['categories.$.color'] = validHex.test(String(body.color)) ? body.color : '#e2e8f0';
    }

    if (body.group !== undefined) {
        updates['categories.$.group'] = typeof body.group === 'string' && body.group.trim()
            ? body.group.trim().slice(0, 50)
            : null;
    }

    if (Object.keys(updates).length === 0) return json({ error: 'nothing_to_update' }, { status: 400 });

    const result = await db.collection('users').updateOne(
        { username, 'categories.id': params.id },
        { $set: updates }
    );
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });

    if (newName) await renameCategoryEverywhere(db, username, current.name, newName);

    return json({ ok: true });
}

export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const categories = await getUserCategories(db, username);
    const current = categories.find(c => c.id === params.id);
    if (!current) return json({ error: 'not_found' }, { status: 404 });

    // Varor med kategorin försvinner inte — de visas i "Utan kategori" via
    // samma fallback som varor från en delad lista med okända kategorier.
    await db.collection('users').updateOne(
        { username },
        // @ts-ignore — $pull med objektmatch är giltigt i runtime
        { $pull: { categories: { id: params.id } } }
    );
    return json({ ok: true });
}
