import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();

    const [user, lists, stores, settings] = await Promise.all([
        db.collection('users').findOne({ username }, { projection: { password: 0, _id: 0 } }),
        db.collection('lists').find({
            $or: [{ owner: username }, { sharedWith: username }]
        }, { projection: { _id: 0 } }).toArray(),
        db.collection('stores').find({ owner: username }, { projection: { _id: 0 } }).toArray(),
        db.collection('user_settings').findOne({ owner: username }, { projection: { _id: 0 } })
    ]);

    const exportData = {
        exportedAt: new Date().toISOString(),
        user: user ?? { username },
        lists,
        stores,
        categories: settings?.categories ?? []
    };

    return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="mazeshopper-export-${username}.json"`
        }
    });
}
