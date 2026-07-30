import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getDb, closeClient } from '$lib/server/db';
import { makeGetEvent } from '../helpers.js';

const OWNER = 'invowner';
const GUEST = 'invguest';
const STRANGER = 'invstranger';

// Literalen måste stå här — vi.mock hissas över konstanterna ovan.
vi.mock('$lib/server/session', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getSessionUser: vi.fn().mockResolvedValue('invowner') };
});

import { getSessionUser } from '$lib/server/session';

const inviteHandler = () => import('../../routes/api/lists/[id]/invite/+server.js');
const joinHandler = () => import('../../routes/api/lists/join/[token]/+server.js');

let listId = '';

beforeEach(async () => {
    vi.mocked(getSessionUser).mockResolvedValue(OWNER);
    const db = await getDb();
    await db.collection('lists').deleteMany({});
    await db.collection('invitations').deleteMany({});
    const { insertedId } = await db.collection('lists').insertOne({
        name: 'Veckohandling', owner: OWNER, sharedWith: [], pendingInvites: [], items: []
    });
    listId = insertedId.toString();
});

afterAll(async () => {
    await closeClient();
});

describe('inbjudningslänk', () => {
    it('skapar en länk och återanvänder samma vid nytt försök', async () => {
        const { POST } = await inviteHandler();
        const first = await (await POST(makeGetEvent({ id: listId }))).json();
        expect(first.token).toMatch(/^[0-9a-f]{64}$/);

        // Att trycka två gånger får inte ogiltigförklara en länk man delat ut.
        const second = await (await POST(makeGetEvent({ id: listId }))).json();
        expect(second.token).toBe(first.token);
    });

    it('låter bara ägaren hantera länken', async () => {
        vi.mocked(getSessionUser).mockResolvedValue(GUEST);
        const { POST, GET, DELETE } = await inviteHandler();
        expect((await POST(makeGetEvent({ id: listId }))).status).toBe(403);
        expect((await GET(makeGetEvent({ id: listId }))).status).toBe(403);
        expect((await DELETE(makeGetEvent({ id: listId }))).status).toBe(403);
    });

    it('stänger av länken så den slutar fungera', async () => {
        const { POST, DELETE } = await inviteHandler();
        const { token } = await (await POST(makeGetEvent({ id: listId }))).json();
        await DELETE(makeGetEvent({ id: listId }));

        vi.mocked(getSessionUser).mockResolvedValue(GUEST);
        const { POST: join } = await joinHandler();
        expect((await join(makeGetEvent({ token }))).status).toBe(404);
    });
});

describe('gå med via länk', () => {
    /** @returns {Promise<string>} */
    async function makeToken() {
        const { POST } = await inviteHandler();
        return (await (await POST(makeGetEvent({ id: listId }))).json()).token;
    }

    it('ger åtkomst till listan', async () => {
        const token = await makeToken();
        vi.mocked(getSessionUser).mockResolvedValue(GUEST);

        const { POST: join } = await joinHandler();
        const res = await join(makeGetEvent({ token }));
        expect(res.status).toBe(200);
        expect((await res.json()).listId).toBe(listId);

        const db = await getDb();
        const list = await db.collection('lists').findOne({ owner: OWNER });
        expect(list?.sharedWith).toEqual([GUEST]);
    });

    it('lägger inte till samma person två gånger', async () => {
        const token = await makeToken();
        vi.mocked(getSessionUser).mockResolvedValue(GUEST);
        const { POST: join } = await joinHandler();

        await join(makeGetEvent({ token }));
        const second = await join(makeGetEvent({ token }));
        expect((await second.json()).alreadyMember).toBe(true);

        const db = await getDb();
        const list = await db.collection('lists').findOne({ owner: OWNER });
        expect(list?.sharedWith).toEqual([GUEST]);
    });

    it('rensar en väntande inbjudan när man går med via länk', async () => {
        const db = await getDb();
        await db.collection('lists').updateOne({ owner: OWNER }, { $set: { pendingInvites: [GUEST] } });
        await db.collection('invitations').insertOne({
            listId, listName: 'Veckohandling', fromUser: OWNER, toUser: GUEST, status: 'pending', createdAt: new Date()
        });

        const token = await makeToken();
        vi.mocked(getSessionUser).mockResolvedValue(GUEST);
        const { POST: join } = await joinHandler();
        await join(makeGetEvent({ token }));

        const list = await db.collection('lists').findOne({ owner: OWNER });
        expect(list?.pendingInvites).toEqual([]);
        expect(await db.collection('invitations').countDocuments({ toUser: GUEST })).toBe(0);
    });

    it('kräver inloggning', async () => {
        const token = await makeToken();
        vi.mocked(getSessionUser).mockResolvedValue(null);
        const { POST: join } = await joinHandler();
        expect((await join(makeGetEvent({ token }))).status).toBe(401);
    });

    it('avvisar en token som inte finns', async () => {
        vi.mocked(getSessionUser).mockResolvedValue(STRANGER);
        const { POST: join } = await joinHandler();
        expect((await join(makeGetEvent({ token: 'finnsinte' }))).status).toBe(404);
    });
});
