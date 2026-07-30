import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';
import { listAccessFilter, serializeList } from '$lib/server/utils';

export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    const db = await getDb();
    // Inbjudningarna renderas ovanför listgriden. Hämtades de klientsida dök de
    // upp efter hydrering och knuffade ned korten under fingret.
    const [docs, invites] = await Promise.all([
        db.collection('lists').find(listAccessFilter(username)).toArray(),
        db.collection('invitations')
            .find({ toUser: username, status: 'pending' })
            .sort({ createdAt: -1 })
            .toArray()
    ]);

    return {
        lists: docs.map(serializeList),
        invitations: invites.map(inv => ({
            id: inv._id.toString(),
            listId: inv.listId,
            listName: inv.listName,
            fromUser: inv.fromUser,
            createdAt: inv.createdAt
        }))
    };
}
