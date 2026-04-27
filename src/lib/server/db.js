import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '$env/static/private';

/** @type {MongoClient | null} */
let client = null;

let indexesEnsured = false;

export async function ensureIndexes() {
    if (indexesEnsured) return;
    const db = await getDb();
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
    ]);
    indexesEnsured = true;
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
