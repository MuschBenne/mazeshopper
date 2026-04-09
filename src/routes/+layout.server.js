import { getSessionUser } from '$lib/server/session';

export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    return { user: username ? { username } : null };
}
