import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getSessionUser } from '$lib/server/session';
import { listAccessFilter } from '$lib/server/utils';

export async function GET({ cookies }) {
    const username = await getSessionUser(cookies);
    if (!username) return json({ error: 'unauthorized' }, { status: 401 });

    const db = await getDb();

    // Kategorierna ligger på användardokumentet och följer med i `user`.
    // listprofiles exporteras fortfarande så länge äldre konton har kvar dem.
    // Historik: exporten läste tidigare
    // den utrangerade user_settings och fick därför med tomma kategorier och
    // inga profiler alls. Mallar saknades också.
    const [user, lists, stores, listprofiles, templates] = await Promise.all([
        db.collection('users').findOne({ username }, { projection: { password: 0, _id: 0 } }),
        db.collection('lists').find(listAccessFilter(username), { projection: { _id: 0 } }).toArray(),
        db.collection('stores').find({ owner: username }, { projection: { _id: 0 } }).toArray(),
        db.collection('listprofiles').find({ owner: username }, { projection: { _id: 0 } }).toArray(),
        db.collection('templates').find({ owner: username }, { projection: { _id: 0 } }).toArray()
    ]);

    const exportData = {
        exportedAt: new Date().toISOString(),
        user: user ?? { username },
        lists,
        stores,
        listprofiles,
        templates
    };

    return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="mazeshopper-export-${username}.json"`
        }
    });
}
