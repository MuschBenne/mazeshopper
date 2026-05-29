import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '$env/static/private';
import { DEFAULT_PROFILES } from './listprofile-defaults.js';

/** @type {MongoClient | null} */
let client = null;

let indexesEnsured = false;
let migrationRan = false;

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
        db.collection('listprofiles').createIndex({ owner: 1 }),
    ]);
    indexesEnsured = true;
}

// Ensures every "Generisk lista" profile has the locked Övrigt category.
// Idempotent: only touches profiles that lack a locked category — safe to run on every startup.
export async function ensureGenericProfileLockedCategory() {
    try {
        const db = await getDb();
        const profiles = await db.collection('listprofiles').find({
            name: 'Generisk lista',
            'categories.locked': { $ne: true }
        }).toArray();
        for (const profile of profiles) {
            await db.collection('listprofiles').updateOne(
                { _id: profile._id },
                /** @type {any} */ ({ $push: { categories: { id: crypto.randomUUID(), name: 'Övrigt', color: '#e2e8f0', locked: true } } })
            );
        }
    } catch (err) {
        console.error('ensureGenericProfileLockedCategory failed:', err);
    }
}

export async function runMigration() {
    if (migrationRan) return;
    migrationRan = true;
    try {
        const db = await getDb();
        const users = await db.collection('users').find({ listprofilesMigrated: { $ne: true } }).toArray();
        for (const user of users) {
            const username = user.username;
            const settings = await db.collection('user_settings').findOne({ owner: username });
            const existingCats = settings?.categories ?? [];
            const livsmedelCats = existingCats.length > 0
                ? existingCats.map(/** @param {any} c */ c => ({ id: crypto.randomUUID(), name: c.name, color: c.color }))
                : DEFAULT_PROFILES[0].categories.map(c => ({ id: crypto.randomUUID(), ...c }));

            const livsmedelResult = await db.collection('listprofiles').insertOne({
                owner: username,
                name: 'Livsmedel',
                categories: livsmedelCats,
                createdAt: new Date()
            });
            const profileId = livsmedelResult.insertedId.toString();

            await db.collection('lists').updateMany(
                { owner: username, profileId: { $exists: false } },
                { $set: { profileId } }
            );
            await db.collection('stores').updateMany(
                { owner: username, profileId: { $exists: false } },
                { $set: { profileId } }
            );

            for (const def of DEFAULT_PROFILES.slice(1)) {
                await db.collection('listprofiles').insertOne({
                    owner: username,
                    name: def.name,
                    categories: def.categories.map(c => ({ id: crypto.randomUUID(), ...c })),
                    createdAt: new Date()
                });
            }

            await db.collection('users').updateOne({ username }, { $set: { listprofilesMigrated: true } });
        }
    } catch (err) {
        console.error('listprofiles migration failed:', err);
        migrationRan = false; // allow retry on next startup
    }
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
    return client.db('mazeshopper');
}
