import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getDb, closeClient } from '$lib/server/db';
import { makeCookies, makePostEvent, makeGetEvent, makeBodyEvent } from '../helpers.js';

const MOCK_USER = 'listowner';
const OTHER_USER = 'otheruser';

vi.mock('$lib/server/session', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getSessionUser: vi.fn().mockResolvedValue('listowner') };
});

async function getListsHandler() {
    return import('../../routes/api/lists/+server.js');
}
async function getListHandler() {
    return import('../../routes/api/lists/[id]/+server.js');
}

import { getSessionUser } from '$lib/server/session';

beforeEach(async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER);
    const db = await getDb();
    await db.collection('lists').deleteMany({});
});

afterAll(async () => {
    await closeClient();
});

// ── GET /api/lists ────────────────────────────────────────────────────────────

describe('GET /api/lists', () => {
    it('returns an empty array when the user has no lists', async () => {
        const { GET } = await getListsHandler();
        const res = await GET(makeGetEvent());
        const data = await res.json();
        expect(data.lists).toEqual([]);
    });

    it('returns lists owned by the user', async () => {
        const db = await getDb();
        await db.collection('lists').insertOne({ name: 'Min lista', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { GET } = await getListsHandler();
        const res = await GET(makeGetEvent());
        const data = await res.json();
        expect(data.lists).toHaveLength(1);
        expect(data.lists[0].name).toBe('Min lista');
    });

    it('returns lists shared with the user', async () => {
        const db = await getDb();
        await db.collection('lists').insertOne({ name: 'Delad lista', owner: OTHER_USER, sharedWith: [MOCK_USER], pendingInvites: [], items: [] });
        const { GET } = await getListsHandler();
        const res = await GET(makeGetEvent());
        const data = await res.json();
        expect(data.lists).toHaveLength(1);
        expect(data.lists[0].name).toBe('Delad lista');
    });

    it('returns 401 when not authenticated', async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce(null);
        const { GET } = await getListsHandler();
        const res = await GET(makeGetEvent());
        expect(res.status).toBe(401);
    });
});

// ── POST /api/lists ───────────────────────────────────────────────────────────

describe('POST /api/lists', () => {
    it('creates a list and returns it', async () => {
        const { POST } = await getListsHandler();
        const res = await POST(makePostEvent({ name: 'Handla' }));
        const data = await res.json();
        expect(data.list.name).toBe('Handla');
        expect(data.list.owner).toBe(MOCK_USER);
        expect(data.list.id).toBeTruthy();
    });

    it('trims whitespace from the list name', async () => {
        const { POST } = await getListsHandler();
        const res = await POST(makePostEvent({ name: '  Handla  ' }));
        expect((await res.json()).list.name).toBe('Handla');
    });

    // Kategorierna kommer ur användarens palett, inte ur en profil. Att kräva
    // ett profilval innan listan fick skapas var friktion utan motsvarande nytta.
    it('creates a list without a profileId', async () => {
        const { POST } = await getListsHandler();
        const res = await POST(makePostEvent({ name: 'Handla' }));
        expect(res.status).toBe(200);
        expect((await res.json()).list.profileId).toBeNull();
    });

    it('rejects an empty name', async () => {
        const { POST } = await getListsHandler();
        const res = await POST(makePostEvent({ name: '' }));
        expect(res.status).toBe(400);
    });

    it('rejects a name exceeding 100 characters', async () => {
        const { POST } = await getListsHandler();
        const res = await POST(makePostEvent({ name: 'x'.repeat(101) }));
        expect(res.status).toBe(400);
    });

    it('returns 401 when not authenticated', async () => {
        vi.mocked(getSessionUser).mockResolvedValueOnce(null);
        const { POST } = await getListsHandler();
        const res = await POST(makePostEvent({ name: 'Test' }));
        expect(res.status).toBe(401);
    });
});

// ── GET /api/lists/[id] ───────────────────────────────────────────────────────

describe('GET /api/lists/[id]', () => {
    it('returns the list for the owner', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'Ägarlista', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { GET } = await getListHandler();
        const res = await GET(makeGetEvent({ id: insertedId.toString() }));
        expect(res.status).toBe(200);
        expect((await res.json()).list.name).toBe('Ägarlista');
    });

    it('returns the list for a shared user', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'Delad', owner: OTHER_USER, sharedWith: [MOCK_USER], pendingInvites: [], items: [] });
        const { GET } = await getListHandler();
        const res = await GET(makeGetEvent({ id: insertedId.toString() }));
        expect(res.status).toBe(200);
    });

    it('returns 404 for a list the user has no access to', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'Privat', owner: OTHER_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { GET } = await getListHandler();
        const res = await GET(makeGetEvent({ id: insertedId.toString() }));
        expect(res.status).toBe(404);
    });

    it('returns 404 for a malformed id', async () => {
        const { GET } = await getListHandler();
        const res = await GET(makeGetEvent({ id: 'not-an-objectid' }));
        expect(res.status).toBe(404);
    });
});

// ── DELETE /api/lists/[id] ────────────────────────────────────────────────────

describe('DELETE /api/lists/[id]', () => {
    it('deletes the list and returns ok for the owner', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'Radera mig', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { DELETE } = await getListHandler();
        const event = { ...makeGetEvent({ id: insertedId.toString() }), cookies: makeCookies() };
        const res = await DELETE(event);
        expect(res.status).toBe(200);
        expect(await db.collection('lists').findOne({ _id: insertedId })).toBeNull();
    });

    it('returns 403 when a shared user tries to delete the list', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'Skyddad', owner: OTHER_USER, sharedWith: [MOCK_USER], pendingInvites: [], items: [] });
        const { DELETE } = await getListHandler();
        const event = { ...makeGetEvent({ id: insertedId.toString() }), cookies: makeCookies() };
        const res = await DELETE(event);
        expect(res.status).toBe(403);
    });
});

// ── POST /api/lists/[id]/items ────────────────────────────────────────────────

describe('POST /api/lists/[id]/items', () => {
    // Kategori gjordes valfri när kravet på ett val innan första varan togs bort.
    // Varor utan kategori hamnar i "Utan kategori" i listvyn.
    it('accepts an item without a category', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'L', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { POST } = await import('../../routes/api/lists/[id]/items/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: insertedId.toString() }, { name: 'Mjölk', spec: '', category: '' }));
        expect(res.status).toBe(200);

        const list = await db.collection('lists').findOne({ _id: insertedId });
        expect(list?.items).toHaveLength(1);
        expect(list?.items[0].category).toBe('');
        expect(list?.items[0].addedBy).toBe(MOCK_USER);
    });

    // Mängd och enhet är två olika saker: "3" betydde tidigare både tre paket
    // och tre deciliter. Båda måste överleva ned i dokumentet.
    it('sparar mängd och enhet, med decimaler', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'L', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { POST } = await import('../../routes/api/lists/[id]/items/+server.js');
        await POST(makeBodyEvent('POST', { id: insertedId.toString() }, {
            name: 'Grädde', spec: '', quantity: 1.5, unit: 'DL', category: ''
        }));

        const list = await db.collection('lists').findOne({ _id: insertedId });
        expect(list?.items[0].quantity).toBe(1.5);
        expect(list?.items[0].unit).toBe('dl');
    });

    // Tomt mängdfält ska förbli tomt. Den gamla handlern gjorde tyst om det
    // till 1, vilket är det som blev "×2 salt" när ett recept skalades.
    it('låter en vara utan mängd förbli utan mängd', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'L', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { POST } = await import('../../routes/api/lists/[id]/items/+server.js');
        await POST(makeBodyEvent('POST', { id: insertedId.toString() }, { name: 'Salt', spec: '', category: '' }));

        const list = await db.collection('lists').findOne({ _id: insertedId });
        expect(list?.items[0].quantity).toBeNull();
        expect(list?.items[0].unit).toBe('');
    });

    it('still rejects an item without a name', async () => {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'L', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        const { POST } = await import('../../routes/api/lists/[id]/items/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: insertedId.toString() }, { name: '   ', category: 'Mejeri' }));
        expect(res.status).toBe(400);
    });
});

// ── POST /api/lists/[id]/import ───────────────────────────────────────────────

describe('POST /api/lists/[id]/import', () => {
    async function seedList() {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({ name: 'L', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [] });
        return insertedId;
    }

    it('imports items unchanged without a scale', async () => {
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [{ name: 'Ägg', spec: '', quantity: 6, category: 'Mejeri' }]
        }));
        const data = await res.json();
        expect(data.items[0].quantity).toBe(6);
    });

    // Recept skalas mot antalet portioner. Avrundas uppåt — hellre en för mycket
    // än en för lite. Skalfaktorn räknas ut i klienten och skickas med.
    it('scales quantities and rounds up', async () => {
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [
                { name: 'Ägg', spec: '', quantity: 6, category: 'Mejeri' },
                { name: 'Salt', spec: '', quantity: 1, category: '' }
            ],
            scale: 1.5
        }));
        const data = await res.json();
        expect(data.items.map((/** @type {any} */ i) => i.quantity)).toEqual([9, 2]);
    });

    it('never scales a quantity below 1 or above 9999', async () => {
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [{ name: 'Ägg', spec: '', quantity: 4, category: '' }],
            scale: 0.1
        }));
        expect((await res.json()).items[0].quantity).toBe(1);
    });

    // Hela poängen med enheten: den ska följa med hela vägen från receptet ned
    // i listvaran, annars blir "3 dl grädde" till "×3 grädde".
    it('tar med enheten ned i listvaran', async () => {
        const db = await getDb();
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [{ name: 'Grädde', spec: '', quantity: 3, unit: 'dl', category: 'Mejeri' }]
        }));
        expect((await res.json()).items[0].unit).toBe('dl');

        const list = await db.collection('lists').findOne({ _id: id });
        expect(list?.items[0].unit).toBe('dl');
        expect(list?.items[0].quantity).toBe(3);
    });

    // "Salt efter smak" har ingen mängd att dubbla. Den gamla koden gjorde
    // saknad mängd till 1 och skalade den — dubbla portioner gav "×2 salt".
    it('skalar inte en vara som saknar mängd', async () => {
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [{ name: 'Salt', spec: 'efter smak', quantity: null, unit: '', category: '' }],
            scale: 2
        }));
        expect((await res.json()).items[0].quantity).toBeNull();
    });

    it('avrundar kontinuerliga enheter till trevliga steg istället för uppåt', async () => {
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [
                { name: 'Potatis', spec: '', quantity: 1.5, unit: 'kg', category: '' },
                { name: 'Ägg', spec: '', quantity: 3, unit: '', category: '' }
            ],
            scale: 1.5
        }));
        const data = await res.json();
        // 1,5 kg × 1,5 blev 3 kg med det gamla Math.ceil — en fjärdedel för mycket.
        expect(data.items[0].quantity).toBe(2.5);
        // Räknbart avrundas fortfarande uppåt: hellre ett ägg för mycket.
        expect(data.items[1].quantity).toBe(5);
    });

    // Halvering är lika vanlig som dubblering. Med halvor som minsta steg blev
    // 1,5 kg till 1 kg, och 0,25 tsk till 0,5 — mer än receptet börjat med.
    it('halverar utan att runda uppåt förbi originalet', async () => {
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [
                { name: 'Potatis', spec: '', quantity: 1.5, unit: 'kg', category: '' },
                { name: 'Salt', spec: '', quantity: 0.25, unit: 'tsk', category: '' }
            ],
            scale: 0.5
        }));
        const data = await res.json();
        expect(data.items[0].quantity).toBe(0.75);
        expect(data.items[1].quantity).toBe(0.25);
    });

    it('ignores a nonsensical scale instead of wiping the quantities', async () => {
        const id = await seedList();
        const { POST } = await import('../../routes/api/lists/[id]/import/+server.js');
        const res = await POST(makeBodyEvent('POST', { id: id.toString() }, {
            items: [{ name: 'Ägg', spec: '', quantity: 6, category: '' }],
            scale: 'mycket'
        }));
        expect((await res.json()).items[0].quantity).toBe(6);
    });
});

// ── PATCH /api/lists/[id]/items/[itemId] ──────────────────────────────────────
//
// Vägen en inline-redigering och stegknapparna tar. Den saknade täckning helt,
// och det är här varor från tiden före enheter får sitt unit-fält för första
// gången — dokumenten i databasen har inte fältet alls.

describe('PATCH /api/lists/[id]/items/[itemId]', () => {
    /** @param {any} item */
    async function seedWithItem(item) {
        const db = await getDb();
        const { insertedId } = await db.collection('lists').insertOne({
            name: 'L', owner: MOCK_USER, sharedWith: [], pendingInvites: [], items: [item]
        });
        return insertedId;
    }

    it('rättar enheten på en vara', async () => {
        const db = await getDb();
        const id = await seedWithItem({ itemId: 'a', name: 'Grädde', spec: '', quantity: 3, unit: 'kg', bought: false, category: '' });
        const { PATCH } = await import('../../routes/api/lists/[id]/items/[itemId]/+server.js');
        const res = await PATCH(makeBodyEvent('PATCH', { id: id.toString(), itemId: 'a' }, { unit: 'DL' }));
        expect(res.status).toBe(200);

        const list = await db.collection('lists').findOne({ _id: id });
        expect(list?.items[0].unit).toBe('dl');
        expect(list?.items[0].quantity).toBe(3);
    });

    // Dokument skrivna innan enheter fanns saknar fältet. $set måste skapa det.
    it('ger en gammal vara utan unit-fält en enhet', async () => {
        const db = await getDb();
        const id = await seedWithItem({ itemId: 'a', name: 'Mjölk', spec: '', quantity: 2, bought: false, category: '' });
        const { PATCH } = await import('../../routes/api/lists/[id]/items/[itemId]/+server.js');
        await PATCH(makeBodyEvent('PATCH', { id: id.toString(), itemId: 'a' }, { quantity: 1.5, unit: 'l' }));

        const list = await db.collection('lists').findOne({ _id: id });
        expect(list?.items[0]).toMatchObject({ quantity: 1.5, unit: 'l' });
    });

    // Så här ångrar man en angiven mängd, och så här landar minusknappen när
    // den stegat ned under ett helt steg.
    it('tar bort mängden när quantity skickas som null', async () => {
        const db = await getDb();
        const id = await seedWithItem({ itemId: 'a', name: 'Salt', spec: '', quantity: 1, unit: '', bought: false, category: '' });
        const { PATCH } = await import('../../routes/api/lists/[id]/items/[itemId]/+server.js');
        await PATCH(makeBodyEvent('PATCH', { id: id.toString(), itemId: 'a' }, { quantity: null }));

        const list = await db.collection('lists').findOne({ _id: id });
        expect(list?.items[0].quantity).toBeNull();
    });

    // Fältet måste vara med i anropet för att röras. En bockning i handelsläget
    // skickar bara `bought` och får inte nollställa mängden på vägen.
    it('lämnar mängden orörd när anropet inte nämner den', async () => {
        const db = await getDb();
        const id = await seedWithItem({ itemId: 'a', name: 'Ägg', spec: '', quantity: 6, unit: '', bought: false, category: '' });
        const { PATCH } = await import('../../routes/api/lists/[id]/items/[itemId]/+server.js');
        await PATCH(makeBodyEvent('PATCH', { id: id.toString(), itemId: 'a' }, { bought: true }));

        const list = await db.collection('lists').findOne({ _id: id });
        expect(list?.items[0]).toMatchObject({ quantity: 6, bought: true });
    });
});
