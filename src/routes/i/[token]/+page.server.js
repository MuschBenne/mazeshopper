import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { hasListAccess } from '$lib/server/utils';

// Publik landningssida för en inbjudningslänk. Kräver ingen inloggning för att
// visas — den som inte har konto ska se vad de bjuds in till innan de skapar ett.
export async function load({ params, cookies }) {
    const db = await getDb();
    const list = await db.collection('lists').findOne({ inviteToken: params.token });
    if (!list) error(404, 'Den här inbjudan gäller inte längre.');

    const username = await getSessionUser(cookies);

    return {
        listId: list._id.toString(),
        listName: list.name,
        owner: list.owner,
        // Visar hur mycket som redan ligger i listan, utan att avslöja innehållet
        // för någon som ännu inte gått med.
        itemCount: (list.items ?? []).length,
        memberCount: (list.sharedWith ?? []).length + 1,
        isLoggedIn: Boolean(username),
        isMember: username !== null && hasListAccess(list, username)
    };
}
