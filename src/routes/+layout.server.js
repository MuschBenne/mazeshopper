import { getSessionUserFull } from '$lib/server/session';

export async function load({ cookies }) {
    const user = await getSessionUserFull(cookies);
    return { user };
}
