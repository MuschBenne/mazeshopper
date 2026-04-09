import { browser } from '$app/environment';

class StoreContext {
    /** @type {{id: string, name: string, categoryOrder: {[category: string]: number}, positions: {[category: string]: {x: number, y: number}}}[]} */
    stores = $state([]);

    /** @type {number | null} */
    selectedStoreIndex = $state(null);

    constructor() {
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

    reset() {
        this.stores = [];
        this.selectedStoreIndex = null;
        if (browser) localStorage.removeItem('selectedStoreIndex');
    }

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
        if (this.selectedStoreIndex === index) {
            this.selectedStoreIndex = null;
            this.#saveSelection();
        } else if (this.selectedStoreIndex !== null && this.selectedStoreIndex > index) {
            this.selectedStoreIndex--;
            this.#saveSelection();
        }
    }

    /**
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

    /** @param {number | null} index */
    selectStore(index) {
        this.selectedStoreIndex = index;
        this.#saveSelection();
    }

    #saveSelection() {
        if (browser) {
            localStorage.setItem('selectedStoreIndex', JSON.stringify(this.selectedStoreIndex));
        }
    }
}

export const storeContext = new StoreContext();
