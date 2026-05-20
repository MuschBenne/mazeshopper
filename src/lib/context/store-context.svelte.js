import { browser } from '$app/environment';

// Manages the list of grocery stores and which one is currently selected.
// The selected store ID is persisted to localStorage so it survives page reloads.
// Storing by ID (not array index) prevents the selection from drifting when
// stores are added or deleted between sessions.
class StoreContext {
    /** @type {{id: string, name: string, categoryOrder: {[category: string]: number}, positions: {[category: string]: {x: number, y: number}}}[]} */
    stores = $state([]);

    /** @type {string | null} */
    #selectedStoreId = $state(null);

    constructor() {
        if (browser) {
            this.#selectedStoreId = localStorage.getItem('selectedStoreId') ?? null;
        }
    }

    async load() {
        const res = await fetch('/api/stores');
        if (!res.ok) return;
        const { stores } = await res.json();
        this.stores = stores;
    }

    // Clears all store data on logout so the next user starts with a clean state.
    reset() {
        this.stores = [];
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

    /** @param {string} name */
    async addStore(name) {
        if (name.trim().length === 0) return;
        const res = await fetch('/api/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const { store } = await res.json();
        this.stores = [...this.stores, store];
    }

    /** @param {number} index */
    async removeStore(index) {
        const store = this.stores[index];
        await fetch(`/api/stores/${store.id}`, { method: 'DELETE' });
        this.stores = this.stores.filter((_, i) => i !== index);
        if (this.#selectedStoreId === store.id) {
            this.#selectedStoreId = null;
            this.#saveSelection();
        }
    }

    /**
     * Saves the store's drag-and-drop layout and derives the category order
     * from the route array (the order in which categories appear in the store).
     * @param {number} storeIndex
     * @param {{[category: string]: {x: number, y: number}}} positions
     * @param {string[]} route
     */
    async setStoreLayout(storeIndex, positions, route) {
        const store = this.stores[storeIndex];
        /** @type {{[category: string]: number}} */
        const categoryOrder = {};
        route.forEach((name, i) => { categoryOrder[name] = i + 1; });
        await fetch(`/api/stores/${store.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ positions, categoryOrder })
        });
        this.stores[storeIndex] = { ...store, positions, categoryOrder };
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
