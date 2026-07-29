import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getDb, closeClient } from '$lib/server/db';
import { makeBodyEvent, makeGetEvent } from '../helpers.js';

const OWNER = 'receptagare';
const OTHER = 'mottagare';

vi.mock('$lib/server/session', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getSessionUser: vi.fn().mockResolvedValue('receptagare') };
});

import { getSessionUser } from '$lib/server/session';

beforeEach(async () => {
    vi.mocked(getSessionUser).mockResolvedValue(OWNER);
    const db = await getDb();
    await db.collection('templates').deleteMany({});
});

afterAll(async () => {
    await closeClient();
});

async function seedRecipe() {
    const db = await getDb();
    const { insertedId } = await db.collection('templates').insertOne({
        owner: OWNER,
        name: 'Pannkakor',
        kind: 'recipe',
        servings: 4,
        items: [{ itemId: 'a', name: 'Ägg', spec: '', quantity: 3, unit: 'st', category: 'Mejeri' }]
    });
    return insertedId;
}

// ── Delningslänken ────────────────────────────────────────────────────────────

describe('PATCH /api/templates/[id] — delningslänk', () => {
    it('skapar en token vid delning och tar bort den när delningen stängs av', async () => {
        const db = await getDb();
        const id = await seedRecipe();
        const { PATCH } = await import('../../routes/api/templates/[id]/+server.js');

        const on = await PATCH(makeBodyEvent('PATCH', { id: id.toString() }, { shared: true }));
        const { shareToken } = await on.json();
        expect(shareToken).toMatch(/^[0-9a-f]{64}$/);
        expect((await db.collection('templates').findOne({ _id: id }))?.shareToken).toBe(shareToken);

        // Att sluta dela ska bryta en länk som redan hunnit spridas.
        const off = await PATCH(makeBodyEvent('PATCH', { id: id.toString() }, { shared: false }));
        expect((await off.json()).shareToken).toBeNull();
        expect((await db.collection('templates').findOne({ _id: id }))?.shareToken).toBeUndefined();
    });

    it('behåller samma token om delningen slås på igen', async () => {
        const id = await seedRecipe();
        const { PATCH } = await import('../../routes/api/templates/[id]/+server.js');
        const first = await (await PATCH(makeBodyEvent('PATCH', { id: id.toString() }, { shared: true }))).json();
        const second = await (await PATCH(makeBodyEvent('PATCH', { id: id.toString() }, { shared: true }))).json();
        expect(second.shareToken).toBe(first.shareToken);
    });

    it('klämmer portionerna till 1–99', async () => {
        const db = await getDb();
        const id = await seedRecipe();
        const { PATCH } = await import('../../routes/api/templates/[id]/+server.js');
        await PATCH(makeBodyEvent('PATCH', { id: id.toString() }, { servings: 500 }));
        expect((await db.collection('templates').findOne({ _id: id }))?.servings).toBe(99);
    });
});

// ── Spara delat recept som egen kopia ─────────────────────────────────────────

describe('POST /api/templates/shared/[token]', () => {
    async function seedShared() {
        const db = await getDb();
        const id = await seedRecipe();
        await db.collection('templates').updateOne({ _id: id }, { $set: { shareToken: 'a'.repeat(64) } });
        return 'a'.repeat(64);
    }

    it('kopierar receptet till mottagaren med nya vara-id:n', async () => {
        const db = await getDb();
        const token = await seedShared();
        vi.mocked(getSessionUser).mockResolvedValue(OTHER);

        const { POST } = await import('../../routes/api/templates/shared/[token]/+server.js');
        const res = await POST(makeBodyEvent('POST', { token }, {}));
        expect(res.status).toBe(200);
        const { template } = await res.json();

        expect(template.owner).toBe(OTHER);
        expect(template.kind).toBe('recipe');
        expect(template.servings).toBe(4);
        // Kopia, inte prenumeration — den egna kopian får aldrig ärva token.
        expect(template.shareToken).toBeNull();
        expect(template.items[0].name).toBe('Ägg');
        expect(template.items[0].category).toBe('Mejeri');
        expect(template.items[0].itemId).not.toBe('a');

        expect(await db.collection('templates').countDocuments({ owner: OTHER })).toBe(1);
        // Originalet får inte röras.
        expect(await db.collection('templates').countDocuments({ owner: OWNER })).toBe(1);
    });

    it('nekar att spara sitt eget recept en gång till', async () => {
        const token = await seedShared();
        const { POST } = await import('../../routes/api/templates/shared/[token]/+server.js');
        const res = await POST(makeBodyEvent('POST', { token }, {}));
        expect(res.status).toBe(409);
        expect((await res.json()).error).toBe('already_yours');
    });

    it('ger 404 för en token som inte längre delas', async () => {
        await seedRecipe();
        vi.mocked(getSessionUser).mockResolvedValue(OTHER);
        const { POST } = await import('../../routes/api/templates/shared/[token]/+server.js');
        const res = await POST(makeBodyEvent('POST', { token: 'b'.repeat(64) }, {}));
        expect(res.status).toBe(404);
    });

    it('kräver inloggning', async () => {
        const token = await seedShared();
        vi.mocked(getSessionUser).mockResolvedValueOnce(null);
        const { POST } = await import('../../routes/api/templates/shared/[token]/+server.js');
        const res = await POST(makeBodyEvent('POST', { token }, {}));
        expect(res.status).toBe(401);
    });
});

// ── Serialisering ─────────────────────────────────────────────────────────────

describe('GET /api/templates', () => {
    it('behandlar dokument utan kind som mallar', async () => {
        const db = await getDb();
        await db.collection('templates').insertOne({
            owner: OWNER, name: 'Gammal mall', items: [{ itemId: 'x', name: 'Bröd', spec: '', quantity: 1, category: '' }]
        });
        const { GET } = await import('../../routes/api/templates/+server.js');
        const { templates } = await (await GET(makeGetEvent())).json();
        expect(templates[0].kind).toBe('template');
        expect(templates[0].servings).toBeNull();
        expect(templates[0].shareToken).toBeNull();
    });
});
