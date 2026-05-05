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

/** @param {any} doc */
export function serializeList(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        owner: doc.owner,
        sharedWith: doc.sharedWith ?? [],
        pendingInvites: doc.pendingInvites ?? [],
        items: (doc.items ?? []).map(/** @param {any} item */ item => ({
            itemId: item.itemId,
            name: item.name,
            spec: item.spec,
            quantity: item.quantity,
            bought: item.bought,
            category: item.category
        }))
    };
}
