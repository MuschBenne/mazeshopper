import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

// Accepts or declines a pending invitation.
// On accept: adds the user to sharedWith and removes them from pendingInvites.
// On decline: only removes them from pendingInvites.
export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.invId)) return json({ error: 'not_found' }, { status: 404 });

    const { action } = await request.json();
    const db = await getDb();

    // Verify the invitation belongs to this user and is still pending.
    const inv = await db.collection('invitations').findOne({
        _id: new ObjectId(params.invId),
        toUser: username,
        status: 'pending'
    });
    if (!inv) return json({ error: 'not_found' }, { status: 404 });

    if (action === 'accept') {
        if (ObjectId.isValid(inv.listId)) {
            // Add to sharedWith and remove from pendingInvites atomically.
            await db.collection('lists').updateOne(
                { _id: new ObjectId(inv.listId) },
                /** @type {any} */ ({
                    $push: { sharedWith: username },
                    $pull: { pendingInvites: username }
                })
            );
        }
        await db.collection('invitations').updateOne(
            { _id: new ObjectId(params.invId) },
            { $set: { status: 'accepted' } }
        );
        return json({ ok: true, action: 'accepted' });
    }

    if (action === 'decline') {
        if (ObjectId.isValid(inv.listId)) {
            await db.collection('lists').updateOne(
                { _id: new ObjectId(inv.listId) },
                // @ts-ignore — MongoDB driver types don't accept plain strings for $pull
                { $pull: { pendingInvites: username } }
            );
        }
        await db.collection('invitations').updateOne(
            { _id: new ObjectId(params.invId) },
            { $set: { status: 'declined' } }
        );
        return json({ ok: true, action: 'declined' });
    }

    return json({ error: 'unknown action' }, { status: 400 });
}
