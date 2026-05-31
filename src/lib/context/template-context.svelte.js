import { notificationContext } from './notification-context.svelte';

/**
 * @typedef {{ itemId: string, name: string, spec: string, quantity: number, category: string }} TemplateItem
 * @typedef {{ id: string, owner: string, name: string, items: TemplateItem[], profileId: string | null }} Template
 */

class TemplateContext {
    /** @type {Template[]} */
    templates = $state([]);

    async load() {
        try {
            const res = await fetch('/api/templates');
            if (res.ok) {
                const { templates } = await res.json();
                this.templates = templates;
            }
        } catch {
            notificationContext.show('Kunde inte ladda mallar. Kontrollera din anslutning.');
        }
    }

    reset() {
        this.templates = [];
    }

    /** @param {string} id */
    getTemplate(id) {
        return this.templates.find(t => t.id === id) ?? null;
    }

    /**
     * @param {string} name
     * @param {string | null} profileId
     */
    async createTemplate(name, profileId) {
        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, profileId })
            });
            if (res.status === 400) {
                const { error } = await res.json();
                if (error === 'too_many_templates') {
                    notificationContext.show('Du kan ha max 50 mallar. Ta bort en gammal mall för att skapa en ny.');
                    return null;
                }
            }
            if (!res.ok) throw new Error();
            const { template } = await res.json();
            this.templates.push(template);
            return /** @type {string} */ (template.id);
        } catch {
            notificationContext.show('Kunde inte skapa mall. Försök igen.');
            return null;
        }
    }

    /**
     * @param {string} templateId
     * @param {string} profileId
     */
    async assignProfile(templateId, profileId) {
        const t = this.getTemplate(templateId);
        if (!t) return false;
        const prev = t.profileId;
        t.profileId = profileId;
        try {
            const res = await fetch(`/api/templates/${templateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            t.profileId = prev;
            notificationContext.show('Kunde inte tilldela profil. Försök igen.');
            return false;
        }
    }

    /** @param {string} id */
    async deleteTemplate(id) {
        const prev = [...this.templates];
        this.templates = this.templates.filter(t => t.id !== id);
        try {
            const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
        } catch {
            this.templates = prev;
            notificationContext.show('Kunde inte ta bort mall. Försök igen.');
        }
    }

    /**
     * @param {string} id
     * @param {string} name
     */
    async renameTemplate(id, name) {
        const t = this.getTemplate(id);
        if (!t) return false;
        const prev = t.name;
        t.name = name;
        try {
            const res = await fetch(`/api/templates/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            t.name = prev;
            notificationContext.show('Kunde inte byta namn på mall. Försök igen.');
            return false;
        }
    }

    /**
     * @param {string} templateId
     * @param {string} name
     * @param {string} spec
     * @param {number} quantity
     * @param {string} category
     */
    async addItem(templateId, name, spec, quantity, category) {
        const t = this.getTemplate(templateId);
        if (!t) return false;
        const item = { itemId: crypto.randomUUID(), name, spec, quantity, category };
        t.items = [...t.items, item];
        try {
            const res = await fetch(`/api/templates/${templateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: t.items })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            t.items = t.items.filter(i => i.itemId !== item.itemId);
            notificationContext.show('Kunde inte lägga till vara i mall. Försök igen.');
            return false;
        }
    }

    /**
     * @param {string} templateId
     * @param {string} itemId
     */
    async removeItem(templateId, itemId) {
        const t = this.getTemplate(templateId);
        if (!t) return;
        const prev = [...t.items];
        t.items = t.items.filter(i => i.itemId !== itemId);
        try {
            const res = await fetch(`/api/templates/${templateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: t.items })
            });
            if (!res.ok) throw new Error();
        } catch {
            t.items = prev;
            notificationContext.show('Kunde inte ta bort vara från mall. Försök igen.');
        }
    }

    /**
     * @param {string} templateId
     * @param {string} itemId
     * @param {{ name?: string, spec?: string, quantity?: number, category?: string }} changes
     */
    async updateItem(templateId, itemId, changes) {
        const t = this.getTemplate(templateId);
        if (!t) return false;
        const item = t.items.find(i => i.itemId === itemId);
        if (!item) return false;
        const prev = { ...item };
        t.items = t.items.map(i => i.itemId === itemId ? { ...i, ...changes } : i);
        try {
            const res = await fetch(`/api/templates/${templateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: t.items })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            t.items = t.items.map(i => i.itemId === itemId ? prev : i);
            notificationContext.show('Kunde inte uppdatera vara i mall. Försök igen.');
            return false;
        }
    }
}

export const templateContext = new TemplateContext();
