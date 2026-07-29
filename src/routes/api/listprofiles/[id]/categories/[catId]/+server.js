import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

const validHex = /^#[0-9a-fA-F]{6}$/;

/** @param {import('mongodb').Db} db @param {string} profileId @param {string} owner @param {string} catId */
async function findCategory(db, profileId, owner, catId) {
    const profile = await db.collection('listprofiles').findOne(
        { _id: new ObjectId(profileId), owner },
        { projection: { 'categories': { $elemMatch: { id: catId } } } }
    );
    return profile?.categories?.[0] ?? null;
}

/**
 * Byter nyckel i ett namn-nycklat objekt utan att ändra ordningen.
 * @param {Record<string, any>} map
 * @param {string} from
 * @param {string} to
 */
function remapKey(map, from, to) {
    if (!(from in map)) return map;
    /** @type {Record<string, any>} */
    const out = {};
    for (const [k, v] of Object.entries(map)) out[k === from ? to : k] = v;
    return out;
}

/**
 * Kategorinamnet är det enda som binder ihop en vara med sin kategori och en
 * varuhusrutt med sin ordning — varken varor eller rutter refererar kategorins
 * id. Byttes namnet bara i profilen tappade därför alla varor sin kategori och
 * rutten slutade gälla för dem.
 *
 * Bara ägarens egna dokument skrivs om. I en lista man är inbjuden till står
 * ägarens strängar kvar, och de visas via fallbacken för okända kategorier.
 *
 * @param {import('mongodb').Db} db
 * @param {string} owner
 * @param {string} profileId
 * @param {string} from
 * @param {string} to
 */
async function renameCategoryEverywhere(db, owner, profileId, from, to) {
    await db.collection('lists').updateMany(
        { owner, profileId, 'items.category': from },
        { $set: { 'items.$[el].category': to } },
        { arrayFilters: [{ 'el.category': from }] }
    );

    await db.collection('templates').updateMany(
        { owner, profileId, 'items.category': from },
        { $set: { 'items.$[el].category': to } },
        { arrayFilters: [{ 'el.category': from }] }
    );

    // Varuhusens rutt och positioner är objekt nycklade på kategorinamn. De
    // skrivs om i JS istället för med $rename, eftersom ett kategorinamn kan
    // innehålla tecken som är ogiltiga i en fältsökväg.
    const stores = await db.collection('stores').find({ owner, profileId }).toArray();
    for (const store of stores) {
        const order = store.categoryOrder ?? {};
        const positions = store.positions ?? {};
        if (!(from in order) && !(from in positions)) continue;
        await db.collection('stores').updateOne(
            { _id: store._id },
            { $set: { categoryOrder: remapKey(order, from, to), positions: remapKey(positions, from, to) } }
        );
    }
}

export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const cat = await findCategory(db, params.id, username, params.catId);
    if (!cat) return json({ error: 'not_found' }, { status: 404 });
    if (cat.locked) return json({ error: 'locked' }, { status: 403 });

    const { name, color } = await request.json();
    /** @type {Record<string, string>} */
    const updates = {};
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
            return json({ error: 'invalid_name' }, { status: 400 });
        }
        updates['categories.$.name'] = name.trim();
    }
    if (color !== undefined) {
        updates['categories.$.color'] = validHex.test(String(color)) ? color : '#e2e8f0';
    }
    if (Object.keys(updates).length === 0) return json({ error: 'nothing_to_update' }, { status: 400 });

    const result = await db.collection('listprofiles').updateOne(
        { _id: new ObjectId(params.id), owner: username, 'categories.id': params.catId },
        { $set: updates }
    );
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });

    const newName = name === undefined ? null : String(name).trim();
    if (newName && newName !== cat.name) {
        await renameCategoryEverywhere(db, username, params.id, cat.name, newName);
    }

    return json({ ok: true });
}

export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const cat = await findCategory(db, params.id, username, params.catId);
    if (!cat) return json({ error: 'not_found' }, { status: 404 });
    if (cat.locked) return json({ error: 'locked' }, { status: 403 });

    const result = await db.collection('listprofiles').updateOne(
        { _id: new ObjectId(params.id), owner: username },
        // @ts-ignore — MongoDB $pull with object match is valid at runtime
        { $pull: { categories: { id: params.catId } } }
    );
    if (result.matchedCount === 0) return json({ error: 'not_found' }, { status: 404 });
    return json({ ok: true });
}
