import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';
import { clampServings, generateShareToken } from '$lib/server/utils';

/**
 * @param {import('mongodb').Db} db
 * @param {string} id
 * @param {string} username
 */
async function getOwnedTemplate(db, id, username) {
    if (!ObjectId.isValid(id)) return null;
    return db.collection('templates').findOne({ _id: new ObjectId(id), owner: username });
}

export async function PATCH({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const template = await getOwnedTemplate(db, params.id, username);
    if (!template) return json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    /** @type {Record<string, unknown>} */
    const update = {};

    if (typeof body.name === 'string') {
        const name = body.name.trim().slice(0, 100);
        if (!name) return json({ error: 'invalid_name' }, { status: 400 });
        update.name = name;
    }

    if (typeof body.profileId === 'string') {
        const profile = await db.collection('listprofiles').findOne({ owner: username, _id: new ObjectId(body.profileId) });
        if (!profile) return json({ error: 'invalid_profile' }, { status: 400 });
        update.profileId = body.profileId;
    }

    if (body.servings !== undefined) {
        update.servings = clampServings(body.servings);
    }

    if (Array.isArray(body.items)) {
        update.items = body.items.map(/** @param {Record<string,unknown>} i */ i => ({
            itemId: String(i.itemId ?? crypto.randomUUID()),
            name: String(i.name ?? '').trim().slice(0, 200),
            spec: String(i.spec ?? '').trim().slice(0, 500),
            quantity: Number.isInteger(i.quantity) && /** @type {number} */ (i.quantity) > 0 && /** @type {number} */ (i.quantity) <= 9999 ? i.quantity : 1,
            unit: String(i.unit ?? '').trim().slice(0, 20),
            category: String(i.category ?? '').trim().slice(0, 50)
        })).filter(/** @param {{ name: string }} i */ i => i.name);
    }

    // Delningslänken slås på och av här. Att stänga av tar bort token, så en
    // länk som redan spridits slutar fungera direkt.
    /** @type {Record<string, ''> | null} */
    let unset = null;
    if (body.shared === true) {
        update.shareToken = template.shareToken ?? generateShareToken();
    } else if (body.shared === false) {
        unset = { shareToken: '' };
    }

    if (Object.keys(update).length === 0 && !unset) return json({ ok: true });

    await db.collection('templates').updateOne(
        { _id: new ObjectId(params.id) },
        {
            ...(Object.keys(update).length > 0 ? { $set: update } : {}),
            ...(unset ? { $unset: unset } : {})
        }
    );
    return json({ ok: true, shareToken: unset ? null : (update.shareToken ?? template.shareToken ?? null) });
}

export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const template = await getOwnedTemplate(db, params.id, username);
    if (!template) return json({ error: 'forbidden' }, { status: 403 });

    await db.collection('templates').deleteOne({ _id: new ObjectId(params.id) });
    return json({ ok: true });
}
