import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '$env/static/private';

/** @type {MongoClient | null} */
let client = null;

let indexesEnsured = false;

export async function ensureIndexes() {
    if (indexesEnsured) return;
    const db = await getDb();

    // Drop legacy token index and purge old-format sessions that lack tokenHash.
    // The tokenHash migration (replacing plaintext token storage) left a unique
    // index on 'token' that treats missing fields as null — only one null is
    // allowed, so a second new-format session causes a duplicate key error.
    await db.collection('sessions').dropIndex('token_1').catch(() => {});
    await db.collection('sessions').deleteMany({ tokenHash: { $exists: false } });

    await Promise.all([
        db.collection('users').createIndex({ username: 1 }, { unique: true }),
        db.collection('users').createIndex({ email: 1 }, { sparse: true }),
        db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
        db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('lists').createIndex({ owner: 1 }),
        db.collection('lists').createIndex({ sharedWith: 1 }),
        db.collection('password_resets').createIndex({ email: 1 }),
        db.collection('password_resets').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('email_verifications').createIndex({ tokenHash: 1 }),
        db.collection('email_verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('login_attempts').createIndex({ key: 1 }),
        db.collection('login_attempts').createIndex({ at: 1 }, { expireAfterSeconds: 900 }),
        db.collection('templates').createIndex({ owner: 1 }),
    ]);
    indexesEnsured = true;
}

export async function closeClient() {
    if (client) {
        await client.close();
        client = null;
        indexesEnsured = false;
    }
}

export async function getDb() {
    if (client) {
        try {
            // Ping to verify connection is still alive
            await client.db('admin').command({ ping: 1 });
        } catch {
            client = null;
        }
    }
    if (!client) {
        client = new MongoClient(MONGODB_URI);
        try {
            await client.connect();
        } catch (err) {
            client = null;
            throw err;
        }
    }
    return client.db('mazeshopper');
}
