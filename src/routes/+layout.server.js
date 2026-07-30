import { getSessionUserFull } from '$lib/server/session';
import { getDb } from '$lib/server/db';
import { getUserCategories } from '$lib/server/categories';

export async function load({ cookies }) {
    const user = await getSessionUserFull(cookies);
    if (!user) return { user, categories: [] };

    // Paletten används av listor, varuhus, mallar och inställningar — alltså
    // nästan varje sida. Att hämta den här gör att sidorna slipper vänta på en
    // klientfetch efter hydrering.
    const db = await getDb();
    const categories = await getUserCategories(db, user.username);
    return { user, categories };
}
