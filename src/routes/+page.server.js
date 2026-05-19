import { redirect } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/session';

export async function load({ cookies }) {
    const username = await getSessionUser(cookies);
    if (username) redirect(302, '/inkopslista');
}
