import { browser } from '$app/environment';

class StoreContext {
    /**@type {{name: string, categoryOrder: {[category: string]: number}, positions: {[category: string]: {x: number, y: number}}}[]}*/
    stores = $state([]);

    /**@type {number | null}*/
    selectedStoreIndex = $state(null);

    constructor() {
        if (browser) {
            const saved = localStorage.getItem('stores');
            const parsed = saved ? JSON.parse(saved) : [];
            this.stores = parsed.map(/** @param {any} s */ s => ({
                categoryOrder: {},
                positions: {},
                ...s
            }));
            const savedIndex = localStorage.getItem('selectedStoreIndex');
            this.selectedStoreIndex = savedIndex !== null ? JSON.parse(savedIndex) : null;
        }
    }

    #save() {
        if (browser) {
            localStorage.setItem('stores', JSON.stringify(this.stores));
        }
    }

    #saveSelection() {
        if (browser) {
            localStorage.setItem('selectedStoreIndex', JSON.stringify(this.selectedStoreIndex));
        }
    }

    get selectedStore() {
        if (this.selectedStoreIndex === null) return null;
        return this.stores[this.selectedStoreIndex] ?? null;
    }

    /**@param {string} name */
    addStore(name) {
        if (name.trim().length === 0) return;
        this.stores = [...this.stores, { name, categoryOrder: {}, positions: {} }];
        this.#save();
    }

    /**@param {number} index */
    removeStore(index) {
        this.stores = this.stores.filter((_, i) => i !== index);
        if (this.selectedStoreIndex === index) {
            this.selectedStoreIndex = null;
            this.#saveSelection();
        } else if (this.selectedStoreIndex !== null && this.selectedStoreIndex > index) {
            this.selectedStoreIndex--;
            this.#saveSelection();
        }
        this.#save();
    }

    /**
     * Save the visual layout and derive categoryOrder from the route array.
     * @param {number} storeIndex
     * @param {{[category: string]: {x: number, y: number}}} positions
     * @param {string[]} route  ordered list of category names
     */
    setStoreLayout(storeIndex, positions, route) {
        /** @type {{[category: string]: number}} */
        const categoryOrder = {};
        route.forEach((name, i) => { categoryOrder[name] = i + 1; });
        this.stores[storeIndex] = {
            ...this.stores[storeIndex],
            positions,
            categoryOrder
        };
        this.#save();
    }

    /**@param {number | null} index */
    selectStore(index) {
        this.selectedStoreIndex = index;
        this.#saveSelection();
    }
}

export const storeContext = new StoreContext();
