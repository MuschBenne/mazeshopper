import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';
import { getDb } from '$lib/server/db';

export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) redirect(302, '/');

    const db = await getDb();
    const docs = await db.collection('lists').find({
        $or: [
            { owner: username },
            { sharedWith: { $elemMatch: { $regex: new RegExp(`^${username}$`, 'i') } } }
        ]
    }).toArray();

    return {
        lists: docs.map(doc => ({
            id: doc._id.toString(),
            name: doc.name,
            owner: doc.owner,
            profileId: doc.profileId ?? null,
            sharedWith: doc.sharedWith ?? [],
            pendingInvites: doc.pendingInvites ?? [],
            items: (doc.items ?? []).map(/** @param {any} item */ item => ({
                itemId: item.itemId,
                name: item.name,
                spec: item.spec,
                quantity: item.quantity,
                bought: item.bought,
                category: item.category,
                addedBy: item.addedBy ?? ''
            }))
        }))
    };
}
