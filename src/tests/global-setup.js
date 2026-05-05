import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function setup() {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
}

export async function teardown() {
    const { closeClient } = await import('../lib/server/db.js');
    await closeClient();
    await mongod?.stop();
}
