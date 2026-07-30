import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { generateShareToken } from '$lib/server/utils';
import { ObjectId } from 'mongodb';

/**
 * Bara ägaren får hantera inbjudningslänken — samma regel som för delning med
 * användarnamn. En delad användare ska inte kunna bjuda in fler.
 * @param {import('mongodb').Db} db
 * @param {string} id
 * @param {string} username
 */
async function getOwnedList(db, id, username) {
    if (!ObjectId.isValid(id)) return null;
    return db.collection('lists').findOne({ _id: new ObjectId(id), owner: username });
}

export async function GET({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getOwnedList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    return json({ token: list.inviteToken ?? null });
}

// Skapar länken, eller returnerar den som redan finns. Att trycka två gånger
// ska inte ogiltigförklara en länk man just delat ut.
export async function POST({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getOwnedList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    if (list.inviteToken) return json({ token: list.inviteToken });

    const token = generateShareToken();
    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        { $set: { inviteToken: token } }
    );
    return json({ token });
}

// Stänger av länken. Redan utdelade länkar slutar fungera direkt — den som
// hunnit gå med är kvar och tas bort separat.
export async function DELETE({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await getOwnedList(db, params.id, username);
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        { $unset: { inviteToken: '' } }
    );
    return json({ ok: true });
}
