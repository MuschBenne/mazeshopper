import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getDb, closeClient } from '$lib/server/db';
import { getUserCategories, renameCategoryEverywhere } from '$lib/server/categories';

const USER = 'palettuser';

beforeEach(async () => {
    const db = await getDb();
    await Promise.all([
        db.collection('users').deleteMany({}),
        db.collection('listprofiles').deleteMany({}),
        db.collection('lists').deleteMany({}),
        db.collection('stores').deleteMany({}),
        db.collection('templates').deleteMany({})
    ]);
});

afterAll(async () => {
    await closeClient();
});

/** @param {{name: string, categories: {name: string, color?: string}[]}[]} profiles */
async function seedProfiles(profiles) {
    const db = await getDb();
    await db.collection('users').insertOne({ username: USER });
    let created = Date.now();
    for (const p of profiles) {
        await db.collection('listprofiles').insertOne({
            owner: USER,
            name: p.name,
            categories: p.categories.map(c => ({ id: crypto.randomUUID(), name: c.name, color: c.color ?? '#e2e8f0' })),
            createdAt: new Date(created++)
        });
    }
}

describe('migrering från listprofiler', () => {
    it('slår ihop profilerna och gör profilnamnet till grupp', async () => {
        await seedProfiles([
            { name: 'Livsmedel', categories: [{ name: 'Mejeri' }, { name: 'Bröd' }] },
            { name: 'Bygg', categories: [{ name: 'Verktyg' }] }
        ]);

        const cats = await getUserCategories(await getDb(), USER);
        expect(cats).toHaveLength(3);
        expect(cats.find(c => c.name === 'Mejeri')?.group).toBe('Livsmedel');
        expect(cats.find(c => c.name === 'Verktyg')?.group).toBe('Bygg');
    });

    it('gör kategorier som finns i flera profiler ogrupperade', async () => {
        await seedProfiles([
            { name: 'Livsmedel', categories: [{ name: 'Mejeri' }, { name: 'Övrigt' }] },
            { name: 'Bygg', categories: [{ name: 'Verktyg' }, { name: 'Övrigt' }] }
        ]);

        const cats = await getUserCategories(await getDb(), USER);
        // Övrigt finns överallt och hör därför inte hemma i någon enskild grupp —
        // annars går det inte att välja så fort ett gruppfilter är aktivt.
        expect(cats.filter(c => c.name === 'Övrigt')).toHaveLength(1);
        expect(cats.find(c => c.name === 'Övrigt')?.group).toBeNull();
    });

    it('slår ihop namn oavsett skiftläge och behåller första färgen', async () => {
        await seedProfiles([
            { name: 'A', categories: [{ name: 'Mejeri', color: '#111111' }] },
            { name: 'B', categories: [{ name: 'mejeri', color: '#222222' }] }
        ]);

        const cats = await getUserCategories(await getDb(), USER);
        expect(cats).toHaveLength(1);
        expect(cats[0].color).toBe('#111111');
        expect(cats[0].group).toBeNull();
    });

    it('sparar resultatet så migreringen bara sker en gång', async () => {
        await seedProfiles([{ name: 'Livsmedel', categories: [{ name: 'Mejeri' }] }]);
        const db = await getDb();

        await getUserCategories(db, USER);
        // Profilen ändras efteråt — en andra körning ska inte plocka upp den,
        // eftersom paletten nu är källan.
        await db.collection('listprofiles').updateOne(
            { owner: USER },
            { $push: { categories: { id: crypto.randomUUID(), name: 'Bröd', color: '#e2e8f0' } } }
        );

        expect(await getUserCategories(db, USER)).toHaveLength(1);
    });

    it('ger standardpaletten till en användare utan profiler', async () => {
        const db = await getDb();
        await db.collection('users').insertOne({ username: USER });

        const cats = await getUserCategories(db, USER);
        expect(cats.length).toBeGreaterThan(10);
        expect(cats.find(c => c.name === 'Övrigt')?.group).toBeNull();
    });
});

describe('namnbyte kaskaderar', () => {
    it('skriver om varor, mallar och varuhusrutter', async () => {
        const db = await getDb();
        await db.collection('lists').insertOne({
            owner: USER, name: 'L', sharedWith: [], pendingInvites: [],
            items: [{ itemId: '1', name: 'Mjölk', category: 'Mejeri' }, { itemId: '2', name: 'Spik', category: 'Verktyg' }]
        });
        await db.collection('templates').insertOne({
            owner: USER, name: 'T', items: [{ itemId: '3', name: 'Ost', category: 'Mejeri' }]
        });
        await db.collection('stores').insertOne({
            owner: USER, name: 'Ica',
            categoryOrder: { Mejeri: 1, Verktyg: 2 },
            positions: { Mejeri: { x: 0, y: 0 } }
        });

        await renameCategoryEverywhere(db, USER, 'Mejeri', 'Kylvaror');

        const list = await db.collection('lists').findOne({ owner: USER });
        expect(list?.items.map((/** @type {any} */ i) => i.category)).toEqual(['Kylvaror', 'Verktyg']);

        const template = await db.collection('templates').findOne({ owner: USER });
        expect(template?.items[0].category).toBe('Kylvaror');

        const store = await db.collection('stores').findOne({ owner: USER });
        expect(store?.categoryOrder).toEqual({ Kylvaror: 1, Verktyg: 2 });
        expect(store?.positions).toEqual({ Kylvaror: { x: 0, y: 0 } });
    });

    it('rör inte listor som ägs av någon annan', async () => {
        const db = await getDb();
        await db.collection('lists').insertOne({
            owner: 'annan', name: 'L', sharedWith: [USER], pendingInvites: [],
            items: [{ itemId: '1', name: 'Mjölk', category: 'Mejeri' }]
        });

        await renameCategoryEverywhere(db, USER, 'Mejeri', 'Kylvaror');

        const list = await db.collection('lists').findOne({ owner: 'annan' });
        expect(list?.items[0].category).toBe('Mejeri');
    });
});
