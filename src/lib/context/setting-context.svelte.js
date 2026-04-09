import { browser } from '$app/environment';

const defaultCategories = [
    { name: 'Frukt & Grönt' },
    { name: 'Mejeri' },
    { name: 'Kött & Fisk' },
    { name: 'Bröd & Bageri' },
    { name: 'Konserver' },
    { name: 'Snacks & Godis' },
    { name: 'Drycker' },
    { name: 'Frys' }
];

class SettingContext {
    /**@type {{name: string}[]}*/
    categories = $state([]);

    constructor() {
        if (browser) {
            const saved = localStorage.getItem('categories');
            this.categories = saved ? JSON.parse(saved) : [...defaultCategories];
        } else {
            this.categories = [...defaultCategories];
        }
    }

    #save() {
        if (browser) {
            localStorage.setItem('categories', JSON.stringify(this.categories));
        }
    }

    /**@param {string} category */
    addCategory(category) {
        if (category.trim().length === 0) return;
        this.categories.push({ name: category });
        this.#save();
    }

    /**@param {number} index */
    removeCategory(index) {
        this.categories.splice(index, 1);
        this.#save();
    }

    resetCategories() {
        this.categories = [...defaultCategories];
        this.#save();
    }
}

export const settingContext = new SettingContext();
