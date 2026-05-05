import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getDb, closeClient } from '$lib/server/db';
import { makeCookies, makePostEvent, makeGetEvent } from '../helpers.js';

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
