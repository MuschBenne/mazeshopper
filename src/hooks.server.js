import { ensureIndexes } from '$lib/server/db';

ensureIndexes().catch(err => console.error('Failed to ensure indexes:', err));

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
    return resolve(event);
}
