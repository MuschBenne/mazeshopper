import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '$env/static/private';

/** @type {MongoClient | null} */
let client = null;

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
