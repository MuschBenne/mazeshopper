const defaultCategories = [
    { name: 'Frukt & Grönt',  color: '#bbf7d0' },
    { name: 'Mejeri',         color: '#fef9c3' },
    { name: 'Kött & Fisk',    color: '#fecaca' },
    { name: 'Bröd & Bageri',  color: '#fed7aa' },
    { name: 'Konserver',      color: '#d9f99d' },
    { name: 'Snacks & Godis', color: '#f5d0fe' },
    { name: 'Drycker',        color: '#bfdbfe' },
    { name: 'Frys',           color: '#cffafe' }
];

const fallbackColors = [
    '#e2e8f0', '#fbcfe8', '#a7f3d0', '#fde68a',
    '#c7d2fe', '#fda4af', '#99f6e4', '#ddd6fe'
];

class SettingContext {
    /** @type {{name: string, color: string}[]} */
    categories = $state([...defaultCategories]);

    async load() {
        const res = await fetch('/api/categories');
        if (!res.ok) return;
        const { categories } = await res.json();
        this.categories = categories;
    }

    reset() {
        this.categories = [...defaultCategories];
    }

    async #save() {
        await fetch('/api/categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: this.categories })
        });
    }

    /**
     * @param {string} category
     * @param {string} [color]
     */
    async addCategory(category, color) {
        if (category.trim().length === 0) return;
        const finalColor = color || fallbackColors[this.categories.length % fallbackColors.length];
        this.categories.push({ name: category.trim(), color: finalColor });
        await this.#save();
    }

    /**
     * @param {number} index
     * @param {string} color
     */
    async updateCategoryColor(index, color) {
        if (index < 0 || index >= this.categories.length) return;
        this.categories[index].color = color;
        await this.#save();
    }

    /** @param {number} index */
    async removeCategory(index) {
        this.categories.splice(index, 1);
        await this.#save();
    }

    async resetCategories() {
        this.categories = [...defaultCategories];
        await this.#save();
    }
}

export const settingContext = new SettingContext();
