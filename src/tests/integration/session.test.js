import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getDb, closeClient } from '$lib/server/db';
import { createSession, getSessionUser, deleteSession, hashToken } from '$lib/server/session';
import { makeCookies } from '../helpers.js';

beforeEach(async () => {
    const db = await getDb();
    await db.collection('sessions').deleteMany({});
});

afterAll(async () => {
    await closeClient();
});

describe('hashToken', () => {
    it('produces a 64-character hex string', async () => {
        const hash = await hashToken('sometoken');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic for the same input', async () => {
        expect(await hashToken('abc')).toBe(await hashToken('abc'));
    });

    it('produces different hashes for different inputs', async () => {
        expect(await hashToken('a')).not.toBe(await hashToken('b'));
    });
});

describe('createSession', () => {
    it('stores a session in the database and sets the cookie', async () => {
        const cookies = makeCookies();
        await createSession(cookies, 'alice');

        const token = cookies.jar.get('session');
        expect(token).toBeTruthy();

        const db = await getDb();
        const tokenHash = await hashToken(token);
        const record = await db.collection('sessions').findOne({ tokenHash });
        expect(record).not.toBeNull();
        expect(record.username).toBe('alice');
        expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
});

describe('getSessionUser', () => {
    it('returns the username for a valid session', async () => {
        const cookies = makeCookies();
        await createSession(cookies, 'bob');
        const username = await getSessionUser(cookies);
        expect(username).toBe('bob');
    });

    it('returns null when no cookie is present', async () => {
        const cookies = makeCookies();
        expect(await getSessionUser(cookies)).toBeNull();
    });

    it('returns null for an unrecognised token', async () => {
        const cookies = makeCookies({ session: 'deadbeef'.repeat(8) });
        expect(await getSessionUser(cookies)).toBeNull();
    });

    it('returns null for an expired session', async () => {
        const cookies = makeCookies();
        await createSession(cookies, 'charlie');
        const token = cookies.jar.get('session');
        const db = await getDb();
        const tokenHash = await hashToken(token);
        // Backdate expiry to the past
        await db.collection('sessions').updateOne(
            { tokenHash },
            { $set: { expiresAt: new Date(Date.now() - 1000) } }
        );
        expect(await getSessionUser(cookies)).toBeNull();
    });
});

describe('deleteSession', () => {
    it('removes the session from the database and clears the cookie', async () => {
        const cookies = makeCookies();
        await createSession(cookies, 'dave');
        const token = cookies.jar.get('session');

        await deleteSession(cookies);

        expect(cookies.jar.get('session')).toBeUndefined();
        const db = await getDb();
        const tokenHash = await hashToken(token);
        const record = await db.collection('sessions').findOne({ tokenHash });
        expect(record).toBeNull();
    });

    it('does nothing when no session cookie is present', async () => {
        const cookies = makeCookies();
        await expect(deleteSession(cookies)).resolves.not.toThrow();
    });
});
