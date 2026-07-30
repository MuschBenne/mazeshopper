import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { hasListAccess } from '$lib/server/utils';

// Går med i en lista via inbjudningslänk. Kräver inloggning — poängen med
// länken är att den leder någon hela vägen till ett konto.
export async function POST({ params, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const list = await db.collection('lists').findOne({ inviteToken: params.token });
    if (!list) return json({ error: 'not_found' }, { status: 404 });

    // Redan med? Behandla som lyckat — den som klickar länken två gånger ska
    // hamna i listan, inte mötas av ett felmeddelande.
    if (hasListAccess(list, username)) {
        return json({ ok: true, listId: list._id.toString(), alreadyMember: true });
    }

    // Har personen en väntande inbjudan sedan tidigare är den överflödig nu.
    /** @type {any} — MongoDB-typerna accepterar inte enkla strängvärden här */
    const update = {
        $push: { sharedWith: username },
        $pull: { pendingInvites: username }
    };
    await db.collection('lists').updateOne({ _id: list._id }, update);

    await db.collection('invitations').deleteMany({
        listId: list._id.toString(),
        toUser: username,
        status: 'pending'
    });

    return json({ ok: true, listId: list._id.toString(), alreadyMember: false });
}
