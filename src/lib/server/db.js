import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '$env/static/private';
import { env } from '$env/dynamic/private';

// Databasnamnet är valfritt och faller tillbaka på produktionsnamnet, så
// befintliga driftsättningar fungerar utan att variabeln sätts. Poängen är att
// kunna peka lokal utveckling mot en egen databas i samma kluster — annars
// skriver npm run dev i samma data som den driftsatta appen.
const DB_NAME = env.MONGODB_DB || 'mazeshopper';

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
        db.collection('lists').createIndex({ profileId: 1 }),
        db.collection('stores').createIndex({ owner: 1 }),
        db.collection('invitations').createIndex({ toUser: 1, status: 1 }),
        db.collection('password_resets').createIndex({ email: 1 }),
        db.collection('password_resets').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('email_verifications').createIndex({ tokenHash: 1 }),
        db.collection('email_verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('login_attempts').createIndex({ key: 1 }),
        db.collection('login_attempts').createIndex({ at: 1 }, { expireAfterSeconds: 900 }),
        db.collection('templates').createIndex({ owner: 1 }),
        db.collection('listprofiles').createIndex({ owner: 1 }),
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
    if (!client) {
        client = new MongoClient(MONGODB_URI);
        try {
            await client.connect();
        } catch (err) {
            client = null;
            throw err;
        }
    }
    return client.db(DB_NAME);
}
