import { notificationContext } from './notification-context.svelte';

/**
 * @typedef {{ itemId: string, name: string, spec: string, quantity: number, unit?: string, category: string }} TemplateItem
 * @typedef {{ id: string, owner: string, name: string, kind: 'template' | 'recipe', servings: number | null, shareToken: string | null, items: TemplateItem[], profileId: string | null }} Template
 */

class TemplateContext {
    /** @type {Template[]} */
    templates = $state([]);

    // Låter sidan skilja "inga mallar" från "inte hämtat än", så tomtillståndet
    // inte flimrar förbi vid varje sidladdning.
    loaded = $state(false);

    async load() {
        try {
            const res = await fetch('/api/templates');
            if (res.ok) {
                const { templates } = await res.json();
                this.templates = templates;
            }
        } catch {
            notificationContext.show('Kunde inte ladda mallar. Kontrollera din anslutning.');
        } finally {
            this.loaded = true;
        }
    }

    reset() {
        this.templates = [];
        this.loaded = false;
    }

    /**
     * Antal portioner receptet är skrivet för. Mängderna räknas om mot det här
     * talet vid import.
     * @param {string} id
     * @param {number} servings
     */
    async setServings(id, servings) {
        const t = this.getTemplate(id);
        if (!t) return false;
        const prev = t.servings;
        t.servings = servings;
        try {
            const res = await fetch(`/api/templates/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ servings })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            t.servings = prev;
            notificationContext.show('Kunde inte spara portioner. Försök igen.');
            return false;
        }
    }

    /**
     * Slår på eller av den publika länken. Att stänga av tar bort token, så en
     * länk som redan spridits slutar fungera.
     * @param {string} id
     * @param {boolean} shared
     */
    async setShared(id, shared) {
        const t = this.getTemplate(id);
        if (!t) return false;
        const prev = t.shareToken;
        try {
            const res = await fetch(`/api/templates/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shared })
            });
            if (!res.ok) throw new Error();
            const { shareToken } = await res.json();
            t.shareToken = shareToken ?? null;
            return true;
        } catch {
            t.shareToken = prev;
            notificationContext.show('Kunde inte ändra delningen. Försök igen.');
            return false;
        }
    }

    /** @param {string} id */
    getTemplate(id) {
        return this.templates.find(t => t.id === id) ?? null;
    }

    /**
     * @param {string} name
     * @param {string | null} profileId
     */
    async createTemplate(name, profileId, kind = 'template', servings = 4) {
        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, profileId, kind, servings })
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
