import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

// Returns all pending invitations addressed to the current user, newest first.
export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();
    const invitations = await db.collection('invitations')
        .find({ toUser: username, status: 'pending' })
        .sort({ createdAt: -1 })
        .toArray();

    return json({
        invitations: invitations.map(inv => ({
            id: inv._id.toString(),
            listId: inv.listId,
            listName: inv.listName,
            fromUser: inv.fromUser,
            createdAt: inv.createdAt
        }))
    });
}
