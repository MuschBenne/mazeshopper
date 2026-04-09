import { browser } from '$app/environment';

class ShoppingContext {
    /**@type {{name: string, spec:string, quantity: number, bought: boolean, category: string}[]}*/
    items = $state([]);

    constructor() {
        if (browser) {
            const saved = localStorage.getItem('shoppingList');
            this.items = saved ? JSON.parse(saved) : [];
        }
    }

    #save() {
        if (browser) {
            localStorage.setItem('shoppingList', JSON.stringify(this.items));
        }
    }

    /**
     * @param {string} name
     * @param {string} spec
     * @param {string} category
     */
    addItem(name, spec, category) {
        this.items = [...this.items, { name, spec, quantity: 1, bought: false, category }];
        this.#save();
    }

    /**@param {number} index */
    removeItem(index) {
        this.items.splice(index, 1);
        this.#save();
    }

    /**@param {number} index */
    toggleBought(index) {
        this.items[index].bought = !this.items[index].bought;
        this.#save();
    }

    /**@param {number} index */
    increaseQuantity(index) {
        this.items[index].quantity++;
        this.#save();
    }

    /**@param {number} index */
    decreaseQuantity(index) {
        if (this.items[index].quantity > 1) {
            this.items[index].quantity--;
            this.#save();
        }
    }

    clearBought() {
        this.items = this.items.filter(i => !i.bought);
        this.#save();
    }

    clearAll() {
        this.items = [];
        this.#save();
    }
}

export const shoppingContext = new ShoppingContext();
