/** @param {string} s */
export function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {string} email */
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** @param {string} pw */
export function isValidPassword(pw) {
    return pw.length >= 8 && /[a-zA-ZåäöÅÄÖ]/.test(pw) && /[0-9]/.test(pw);
}

/**
 * Filter som matchar listor användaren äger eller är delad med.
 *
 * Använder exakt match (inte case-insensitiv regex) eftersom en regex med
 * i-flagga tvingar fram en obegränsad indexskanning över samtliga användares
 * listor vid varje sidladdning. Användarnamn normaliseras till lowercase vid
 * registrering, och både share- och invitations-endpointen skriver det
 * kanoniska namnet från users-collectionen, så exakt match räcker.
 *
 * owner matchas strikt exakt: det värdet skrivs alltid från sessionen och har
 * aldrig behövt någon fallback. Att luckra upp det skulle låta två konton som
 * bara skiljer sig i skiftläge se varandras egna listor. sharedWith får en
 * lowercase-variant som skyddsnät för konton skapade före normaliseringen.
 *
 * @param {string} username
 */
export function listAccessFilter(username) {
    const lower = username.toLowerCase();
    const shared = lower === username ? [username] : [username, lower];
    return {
        $or: [
            { owner: username },
            { sharedWith: { $in: shared } }
        ]
    };
}

/**
 * Samma åtkomstregel som listAccessFilter, fast mot ett dokument man redan har.
 * Håll de två i synk.
 *
 * @param {any} doc
 * @param {string} username
 */
export function hasListAccess(doc, username) {
    if (doc.owner === username) return true;
    const lower = username.toLowerCase();
    return (doc.sharedWith ?? []).some(
        /** @param {string} u */ u => u === username || u === lower
    );
}

/** @param {any} doc */
export function serializeList(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        owner: doc.owner,
        profileId: doc.profileId ?? null,
        sharedWith: doc.sharedWith ?? [],
        pendingInvites: doc.pendingInvites ?? [],
        items: (doc.items ?? []).map(/** @param {any} item */ item => ({
            itemId: item.itemId,
            name: item.name,
            spec: item.spec,
            quantity: item.quantity,
            bought: item.bought,
            category: item.category,
            addedBy: item.addedBy ?? ''
        }))
    };
}
