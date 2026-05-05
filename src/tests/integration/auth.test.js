import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getDb, closeClient } from '$lib/server/db';
import { makeCookies, makePostEvent } from '../helpers.js';

// Prevent actual emails from being sent
vi.mock('$lib/server/email', () => ({
    sendEmailVerification: vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

// Lazy import so the mock above is registered first
async function getHandler() {
    return import('../../routes/api/auth/+server.js');
}

beforeEach(async () => {
    const db = await getDb();
    await Promise.all([
        db.collection('users').deleteMany({}),
        db.collection('sessions').deleteMany({}),
        db.collection('login_attempts').deleteMany({}),
        db.collection('email_verifications').deleteMany({}),
        db.collection('password_resets').deleteMany({}),
    ]);
});

afterAll(async () => {
    await closeClient();
});

// ── register ──────────────────────────────────────────────────────────────────

describe('register', () => {
    it('creates a user and returns ok', async () => {
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'register', username: 'alice', password: 'secret12', email: 'alice@example.com' }));
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(data.user.username).toBe('alice');
        expect(data.user.emailVerified).toBe(false);
    });

    it('stores the user in the database', async () => {
        const { POST } = await getHandler();
        await POST(makePostEvent({ action: 'register', username: 'Bob', password: 'secret12', email: 'bob@example.com' }));
        const db = await getDb();
        const user = await db.collection('users').findOne({ username: 'bob' });
        expect(user).not.toBeNull();
        expect(user.email).toBe('bob@example.com');
    });

    it('normalises the username to lowercase', async () => {
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'register', username: 'Carol', password: 'secret12', email: 'carol@example.com' }));
        const data = await res.json();
        expect(data.user.username).toBe('carol');
    });

    it('rejects a weak password', async () => {
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'register', username: 'dave', password: 'abc', email: 'dave@example.com' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('weak_password');
    });

    it('rejects an invalid email', async () => {
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'register', username: 'eve', password: 'secret12', email: 'not-an-email' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('invalid_email');
    });

    it('rejects a duplicate username (case-insensitive)', async () => {
        const { POST } = await getHandler();
        await POST(makePostEvent({ action: 'register', username: 'frank', password: 'secret12', email: 'frank@example.com' }));
        const res = await POST(makePostEvent({ action: 'register', username: 'FRANK', password: 'secret12', email: 'frank2@example.com' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('taken');
    });

    it('rejects a duplicate email', async () => {
        const { POST } = await getHandler();
        await POST(makePostEvent({ action: 'register', username: 'grace', password: 'secret12', email: 'shared@example.com' }));
        const res = await POST(makePostEvent({ action: 'register', username: 'henry', password: 'secret12', email: 'shared@example.com' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe('email_taken');
    });

    it('rate-limits registration to 5 attempts per IP per window', async () => {
        const { POST } = await getHandler();
        const ip = '10.0.0.99';
        for (let i = 0; i < 5; i++) {
            await POST(makePostEvent({ action: 'register', username: `u${i}`, password: 'secret12', email: `u${i}@x.com` }, makeCookies(), ip));
        }
        const res = await POST(makePostEvent({ action: 'register', username: 'overflow', password: 'secret12', email: 'overflow@x.com' }, makeCookies(), ip));
        expect(res.status).toBe(429);
    });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('login', () => {
    async function registerUser(username = 'testuser', password = 'secret12', email = 'test@example.com') {
        const { POST } = await getHandler();
        await POST(makePostEvent({ action: 'register', username, password, email }));
    }

    it('returns the user on valid credentials', async () => {
        await registerUser();
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'login', username: 'testuser', password: 'secret12' }));
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(data.user.username).toBe('testuser');
    });

    it('is case-insensitive for username', async () => {
        await registerUser();
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'login', username: 'TESTUSER', password: 'secret12' }));
        expect((await res.json()).ok).toBe(true);
    });

    it('returns 401 for wrong password', async () => {
        await registerUser();
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'login', username: 'testuser', password: 'wrongpass1' }));
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe('invalid_credentials');
    });

    it('returns 401 for unknown username', async () => {
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'login', username: 'nobody', password: 'secret12' }));
        expect(res.status).toBe(401);
    });

    it('sets the session cookie on success', async () => {
        await registerUser();
        const { POST } = await getHandler();
        const cookies = makeCookies();
        await POST(makePostEvent({ action: 'login', username: 'testuser', password: 'secret12' }, cookies));
        expect(cookies.jar.get('session')).toBeTruthy();
    });

    it('rate-limits login to 10 attempts per IP', async () => {
        await registerUser();
        const { POST } = await getHandler();
        const ip = '10.0.1.1';
        for (let i = 0; i < 10; i++) {
            await POST(makePostEvent({ action: 'login', username: 'testuser', password: 'badpassword1' }, makeCookies(), ip));
        }
        const res = await POST(makePostEvent({ action: 'login', username: 'testuser', password: 'secret12' }, makeCookies(), ip));
        expect(res.status).toBe(429);
    });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('logout', () => {
    it('clears the session cookie and removes the session from the database', async () => {
        const { POST } = await getHandler();
        const cookies = makeCookies();
        await POST(makePostEvent({ action: 'register', username: 'logoutuser', password: 'secret12', email: 'logout@example.com' }, cookies));
        expect(cookies.jar.get('session')).toBeTruthy();

        await POST(makePostEvent({ action: 'logout' }, cookies));
        expect(cookies.jar.get('session')).toBeUndefined();

        const db = await getDb();
        const sessions = await db.collection('sessions').countDocuments({ username: 'logoutuser' });
        expect(sessions).toBe(0);
    });
});

// ── exists ────────────────────────────────────────────────────────────────────

describe('exists', () => {
    it('returns true for an existing user', async () => {
        const { POST } = await getHandler();
        await POST(makePostEvent({ action: 'register', username: 'existsuser', password: 'secret12', email: 'exists@example.com' }));
        const res = await POST(makePostEvent({ action: 'exists', username: 'existsuser' }));
        expect((await res.json()).exists).toBe(true);
    });

    it('returns false for a non-existing user', async () => {
        const { POST } = await getHandler();
        const res = await POST(makePostEvent({ action: 'exists', username: 'nobody' }));
        expect((await res.json()).exists).toBe(false);
    });
});
