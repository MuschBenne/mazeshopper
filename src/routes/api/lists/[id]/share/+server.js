import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

// Escapes special regex characters so usernames are matched literally.
/** @param {string} s */
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sends a sharing invitation to another user.
// Only the list owner can share — shared users cannot re-share the list.
export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const { username: target } = await request.json();
    const db = await getDb();

    // Only the list owner may share.
    const list = await db.collection('lists').findOne({ _id: new ObjectId(params.id), owner: username });
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

    // Case-insensitive username lookup so casing differences don't cause "user not found".
    const targetUser = await db.collection('users').findOne({
        username: { $regex: new RegExp(`^${escapeRegex(target)}$`, 'i') }
    });
    if (!targetUser) return json({ error: 'user_not_found' }, { status: 404 });

    const alreadyShared = (list.sharedWith ?? []).some(
        /** @param {string} u */ u => u.toLowerCase() === target.toLowerCase()
    );
    if (alreadyShared) return json({ error: 'already_shared' }, { status: 400 });

    const alreadyPending = (list.pendingInvites ?? []).some(
        /** @param {string} u */ u => u.toLowerCase() === target.toLowerCase()
    );
    if (alreadyPending) return json({ error: 'already_invited' }, { status: 400 });

    // Create the invitation document and add the user to pendingInvites in one go.
    await db.collection('invitations').insertOne({
        listId: params.id,
        listName: list.name,
        fromUser: username,
        toUser: targetUser.username,
        status: 'pending',
        createdAt: new Date()
    });

    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        { $push: { pendingInvites: targetUser.username } }
    );

    return json({ ok: true });
}

// Removes a user's access to the list and cancels any pending invitation they may have.
// Only the list owner can unshare.
export async function DELETE({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const db = await getDb();
    const ownedList = await db.collection('lists').findOne({ _id: new ObjectId(params.id), owner: username });
    if (!ownedList) return json({ error: 'forbidden' }, { status: 403 });

    const { username: target } = await request.json();

    // Remove from both sharedWith and pendingInvites using case-insensitive regex.
    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        {
            // @ts-ignore — MongoDB driver types don't accept regex inside $pull
            $pull: {
                sharedWith: { $regex: new RegExp(`^${escapeRegex(target)}$`, 'i') },
                pendingInvites: { $regex: new RegExp(`^${escapeRegex(target)}$`, 'i') }
            }
        }
    );

    // Also cancel any outstanding invitation so the user's invite list stays clean.
    await db.collection('invitations').updateMany(
        { listId: params.id, toUser: { $regex: new RegExp(`^${escapeRegex(target)}$`, 'i') }, status: 'pending' },
        { $set: { status: 'cancelled' } }
    );
    return json({ ok: true });
}
