import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { ObjectId } from 'mongodb';

/** @param {string} s */
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    const { username: target } = await request.json();
    const db = await getDb();

    // Only the list owner may share
    const list = await db.collection('lists').findOne({ _id: new ObjectId(params.id), owner: username });
    if (!list) return json({ error: 'forbidden' }, { status: 403 });

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

export async function DELETE({ params, request, cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });
    if (!ObjectId.isValid(params.id)) return json({ error: 'not_found' }, { status: 404 });

    // Only the list owner may unshare
    const db = await getDb();
    const ownedList = await db.collection('lists').findOne({ _id: new ObjectId(params.id), owner: username });
    if (!ownedList) return json({ error: 'forbidden' }, { status: 403 });

    const { username: target } = await request.json();
    await db.collection('lists').updateOne(
        { _id: new ObjectId(params.id) },
        {
            $pull: {
                sharedWith: { $regex: new RegExp(`^${escapeRegex(target)}$`, 'i') },
                pendingInvites: { $regex: new RegExp(`^${escapeRegex(target)}$`, 'i') }
            }
        }
    );
    await db.collection('invitations').updateMany(
        { listId: params.id, toUser: { $regex: new RegExp(`^${escapeRegex(target)}$`, 'i') }, status: 'pending' },
        { $set: { status: 'cancelled' } }
    );
    return json({ ok: true });
}
