import { browser } from '$app/environment';
import { notificationContext } from './notification-context.svelte';

// Manages the list of grocery stores and which one is currently selected.
// The selected store ID is persisted to localStorage so it survives page reloads.
// Storing by ID (not array index) prevents the selection from drifting when
// stores are added or deleted between sessions.
class StoreContext {
    /** @type {{id: string, name: string, profileId: string | null, categoryOrder: {[category: string]: number}, positions: {[category: string]: {x: number, y: number}}}[]} */
    stores = $state([]);

    // Låter sidan skilja "inga varuhus" från "inte hämtat än", så tomtillståndet
    // inte flimrar förbi vid varje sidladdning.
    loaded = $state(false);

    /** @type {string | null} */
    #selectedStoreId = $state(null);

    constructor() {
        if (browser) {
            this.#selectedStoreId = localStorage.getItem('selectedStoreId') ?? null;
        }
    }

    async load() {
        try {
            const res = await fetch('/api/stores');
            if (!res.ok) return;
            const { stores } = await res.json();
            this.stores = stores;
        } catch {
            notificationContext.show('Kunde inte ladda varuhus. Kontrollera din anslutning.');
        } finally {
            this.loaded = true;
        }
    }

    // Clears all store data on logout so the next user starts with a clean state.
    reset() {
        this.stores = [];
        this.loaded = false;
        this.#selectedStoreId = null;
        if (browser) localStorage.removeItem('selectedStoreId');
    }

    // Returns the index of the selected store in the current stores array, or null.
    get selectedStoreIndex() {
        if (this.#selectedStoreId === null) return null;
        const i = this.stores.findIndex(s => s.id === this.#selectedStoreId);
        return i === -1 ? null : i;
    }

    // Returns the currently selected store object, or null if none is selected.
    get selectedStore() {
        const i = this.selectedStoreIndex;
        return i === null ? null : this.stores[i];
    }

    /**
     * @param {string} name
     * @param {string} profileId
     */
    async addStore(name, profileId) {
        if (name.trim().length === 0) return false;
        try {
            const res = await fetch('/api/stores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, profileId })
            });
            if (!res.ok) throw new Error();
            const { store } = await res.json();
            this.stores = [...this.stores, store];
            return true;
        } catch {
            notificationContext.show('Kunde inte skapa varuhus. Försök igen.');
            return false;
        }
    }

    /** @param {number} index */
    async removeStore(index) {
        const store = this.stores[index];
        if (!store) return false;
        const prevStores = [...this.stores];
        const prevSelected = this.#selectedStoreId;
        this.stores = this.stores.filter((_, i) => i !== index);
        if (this.#selectedStoreId === store.id) {
            this.#selectedStoreId = null;
            this.#saveSelection();
        }
        try {
            const res = await fetch(`/api/stores/${store.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            this.stores = prevStores;
            this.#selectedStoreId = prevSelected;
            this.#saveSelection();
            notificationContext.show('Kunde inte ta bort varuhus. Försök igen.');
            return false;
        }
    }

    /**
     * Saves the store's drag-and-drop layout and derives the category order
     * from the route array (the order in which categories appear in the store).
     * Returnerar false om servern nekade — anroparen får då inte påstå att
     * rutten sparats, eftersom nästa handlingsrunda annars sorteras efter en
     * ordning som aldrig nådde databasen.
     * @param {number} storeIndex
     * @param {{[category: string]: {x: number, y: number}}} positions
     * @param {string[]} route
     * @returns {Promise<boolean>}
     */
    async setStoreLayout(storeIndex, positions, route) {
        const store = this.stores[storeIndex];
        if (!store) return false;
        /** @type {{[category: string]: number}} */
        const categoryOrder = {};
        route.forEach((name, i) => { categoryOrder[name] = i + 1; });
        this.stores[storeIndex] = { ...store, positions, categoryOrder };
        try {
            const res = await fetch(`/api/stores/${store.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions, categoryOrder })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            this.stores[storeIndex] = store;
            notificationContext.show('Kunde inte spara varuhusets ordning. Försök igen.');
            return false;
        }
    }

    /** @param {string | null} id */
    selectStore(id) {
        this.#selectedStoreId = id;
        this.#saveSelection();
    }

    #saveSelection() {
        if (!browser) return;
        if (this.#selectedStoreId === null) {
            localStorage.removeItem('selectedStoreId');
        } else {
            localStorage.setItem('selectedStoreId', this.#selectedStoreId);
        }
    }
}

export const storeContext = new StoreContext();
