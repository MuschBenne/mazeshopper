/**
 * Specifikationer användaren redan skrivit, till <datalist> under spec-fältet.
 *
 * "vispgrädde 36 %" skrivs om och om igen, i lista efter lista. Förslagen
 * kommer ur det som redan finns i användarens egna listor, mallar och recept —
 * ingen ny lagring, inget att underhålla.
 *
 * @param {{ items?: { spec?: string }[] }[]} lists
 * @param {{ items?: { spec?: string }[] }[]} templates
 * @param {number} [limit] Taket finns för att en <datalist> med tusentals rader
 *   gör fältet trögt utan att hjälpa någon.
 */
export function collectSpecSuggestions(lists = [], templates = [], limit = 200) {
    /** @type {Set<string>} */
    const seen = new Set();
    for (const source of [...lists, ...templates]) {
        for (const item of source.items ?? []) {
            const spec = (item.spec ?? '').trim();
            if (spec) seen.add(spec);
        }
    }
    return [...seen].sort((a, b) => a.localeCompare(b, 'sv')).slice(0, limit);
}
