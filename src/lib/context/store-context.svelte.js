import { browser } from '$app/environment';

// Manages the list of grocery stores and which one is currently selected.
// The selected store index is persisted to localStorage so it survives page reloads.
class StoreContext {
    /** @type {{id: string, name: string, categoryOrder: {[category: string]: number}, positions: {[category: string]: {x: number, y: number}}}[]} */
    stores = $state([]);

    /** @type {number | null} */
    selectedStoreIndex = $state(null);

    constructor() {
        // Restore the previously selected store on page load.
        if (browser) {
            const savedIndex = localStorage.getItem('selectedStoreIndex');
            this.selectedStoreIndex = savedIndex !== null ? JSON.parse(savedIndex) : null;
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
        this.selectedStoreIndex = null;
        if (browser) localStorage.removeItem('selectedStoreIndex');
    }

    // Returns the currently selected store object, or null if none is selected.
    get selectedStore() {
        if (this.selectedStoreIndex === null) return null;
        return this.stores[this.selectedStoreIndex] ?? null;
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

        // If the removed store was selected, clear the selection.
        // If a store after it was selected, shift the index down by one.
        if (this.selectedStoreIndex === index) {
            this.selectedStoreIndex = null;
            this.#saveSelection();
        } else if (this.selectedStoreIndex !== null && this.selectedStoreIndex > index) {
            this.selectedStoreIndex--;
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
        // Convert the ordered route array into a {category: rank} map for fast lookups.
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

    /** @param {number | null} index */
    selectStore(index) {
        this.selectedStoreIndex = index;
        this.#saveSelection();
    }

    // Writes the selected index to localStorage so it persists across reloads.
    #saveSelection() {
        if (browser) {
            localStorage.setItem('selectedStoreIndex', JSON.stringify(this.selectedStoreIndex));
        }
    }
}

export const storeContext = new StoreContext();
