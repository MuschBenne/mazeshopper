import { notificationContext } from './notification-context.svelte';

/**
 * @typedef {{ id: string, name: string, color: string, group: string | null }} Category
 */

// Användarens kategoripalett — en platt uppsättning med en valfri grupp-etikett.
// Gruppen är ett rent visningsfilter: ingen lista, inget varuhus och ingen mall
// refererar den, så den kan aldrig vara "i bruk" och blockera något.
class CategoryContext {
    /** @type {Category[]} */
    categories = $state([]);

    loaded = $state(false);

    #seeded = false;

    /** @param {Category[]} categories */
    seed(categories) {
        this.categories = [...categories];
        this.loaded = true;
        this.#seeded = true;
    }

    async load() {
        if (this.#seeded) return;
        try {
            const res = await fetch('/api/categories');
            if (!res.ok) return;
            const { categories } = await res.json();
            this.categories = categories;
        } catch {
            // Layouten anropar load() utan await, så ett nätverksfel skulle
            // annars bli en tyst unhandled rejection. Övriga contexter visar
            // en toast här — gör likadant.
            notificationContext.show('Kunde inte ladda kategorier. Kontrollera din anslutning.');
        } finally {
            this.loaded = true;
        }
    }

    reset() {
        this.categories = [];
        this.loaded = false;
        this.#seeded = false;
    }

    // Grupperna i den ordning de först dyker upp i paletten.
    get groups() {
        /** @type {string[]} */
        const seen = [];
        for (const c of this.categories) {
            if (c.group && !seen.includes(c.group)) seen.push(c.group);
        }
        return seen;
    }

    // Ogrupperade kategorier är universella och ingår i varje grupp.
    /** @param {string | null} group */
    inGroup(group) {
        if (!group) return this.categories;
        return this.categories.filter(c => c.group === group || !c.group);
    }

    /** @param {string} name */
    groupOf(name) {
        return this.categories.find(c => c.name === name)?.group ?? null;
    }

    /**
     * @param {string} name
     * @param {string | null} [group]
     * @param {string} [color]
     */
    async addCategory(name, group = null, color = undefined) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed, group, color })
            });
            if (res.status === 409) {
                notificationContext.show('Det finns redan en kategori med det namnet.');
                return null;
            }
            if (!res.ok) throw new Error();
            const { category } = await res.json();
            this.categories = [...this.categories, category];
            return category;
        } catch {
            notificationContext.show('Kunde inte lägga till kategori. Försök igen.');
            return null;
        }
    }

    /**
     * @param {string} id
     * @param {{ name?: string, color?: string, group?: string | null }} updates
     */
    async updateCategory(id, updates) {
        const cat = this.categories.find(c => c.id === id);
        if (!cat) return false;
        const prev = { name: cat.name, color: cat.color, group: cat.group };
        if (updates.name !== undefined) cat.name = updates.name;
        if (updates.color !== undefined) cat.color = updates.color;
        if (updates.group !== undefined) cat.group = updates.group;
        try {
            const res = await fetch(`/api/categories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.status === 409) {
                Object.assign(cat, prev);
                notificationContext.show('Det finns redan en kategori med det namnet.');
                return false;
            }
            if (!res.ok) throw new Error();
            return true;
        } catch {
            Object.assign(cat, prev);
            notificationContext.show('Kunde inte uppdatera kategori. Försök igen.');
            return false;
        }
    }

    /** @param {string} id */
    async removeCategory(id) {
        const prev = [...this.categories];
        this.categories = this.categories.filter(c => c.id !== id);
        try {
            const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            this.categories = prev;
            notificationContext.show('Kunde inte ta bort kategori. Försök igen.');
            return false;
        }
    }
}

export const categoryContext = new CategoryContext();
