import { DEFAULT_CATEGORIES } from './category-defaults.js';

/**
 * @typedef {{ id: string, name: string, color: string, group: string | null }} Category
 */

/** @param {{ name: string, color: string, group?: string | null }} c */
function withId(c) {
    return { id: crypto.randomUUID(), name: c.name, color: c.color, group: c.group ?? null };
}

/** Paletten som nya konton får. */
export function defaultCategories() {
    return DEFAULT_CATEGORIES.map(withId);
}

/**
 * Slår ihop användarens listprofiler till en platt palett. Kategorier med
 * samma namn (skiftlägesokänsligt) blir en; första färgen vinner och det gamla
 * profilnamnet blir grupp. `locked` faller bort — i en platt palett finns
 * "Övrigt" bara en gång och behöver inget skydd.
 *
 * @param {import('mongodb').Db} db
 * @param {string} username
 * @returns {Promise<Category[]>}
 */
async function migrateFromProfiles(db, username) {
    const profiles = await db.collection('listprofiles')
        .find({ owner: username })
        .sort({ createdAt: 1 })
        .toArray();

    /** @type {Map<string, Category>} */
    const byName = new Map();
    for (const profile of profiles) {
        for (const cat of profile.categories ?? []) {
            const name = String(cat.name ?? '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (byName.has(key)) continue;
            byName.set(key, {
                id: String(cat.id ?? crypto.randomUUID()),
                name,
                color: cat.color ?? '#e2e8f0',
                group: profile.name ?? null
            });
        }
    }

    return [...byName.values()];
}

/**
 * Hämtar användarens kategoripalett. Migrerar från listprofiler första gången
 * och sparar resultatet, så att omvandlingen bara sker en gång per konto och
 * ingen separat migreringskörning behövs.
 *
 * @param {import('mongodb').Db} db
 * @param {string} username
 * @returns {Promise<Category[]>}
 */
export async function getUserCategories(db, username) {
    const user = await db.collection('users').findOne(
        { username },
        { projection: { categories: 1 } }
    );
    if (!user) return [];
    if (Array.isArray(user.categories)) return user.categories;

    const migrated = await migrateFromProfiles(db, username);
    const categories = migrated.length > 0 ? migrated : defaultCategories();
    await db.collection('users').updateOne({ username }, { $set: { categories } });
    return categories;
}

/**
 * Kategorinamnet är det enda som binder ihop en vara med sin kategori och en
 * varuhusrutt med sin ordning — inget refererar kategorins id. Ett namnbyte
 * måste därför skrivas överallt, annars tappar varorna sin kategori och rutten
 * slutar gälla för dem.
 *
 * Bara ägarens egna dokument skrivs om. I en lista man är inbjuden till står
 * ägarens strängar kvar och visas via fallbacken för okända kategorier.
 *
 * @param {import('mongodb').Db} db
 * @param {string} owner
 * @param {string} from
 * @param {string} to
 */
export async function renameCategoryEverywhere(db, owner, from, to) {
    if (from === to) return;

    for (const collection of ['lists', 'templates']) {
        await db.collection(collection).updateMany(
            { owner, 'items.category': from },
            { $set: { 'items.$[el].category': to } },
            { arrayFilters: [{ 'el.category': from }] }
        );
    }

    // Rutt och positioner är objekt nycklade på kategorinamn. De skrivs om i JS
    // istället för med $rename, eftersom ett kategorinamn kan innehålla tecken
    // som inte är giltiga i en fältsökväg.
    const stores = await db.collection('stores').find({ owner }).toArray();
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

/**
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
