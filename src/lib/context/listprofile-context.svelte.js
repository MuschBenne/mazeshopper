import { notificationContext } from './notification-context.svelte';

const fallbackColors = [
    '#e2e8f0', '#fbcfe8', '#a7f3d0', '#fde68a',
    '#c7d2fe', '#fda4af', '#99f6e4', '#ddd6fe'
];

/**
 * @typedef {{ id: string, name: string, color: string, locked?: boolean }} ProfileCategory
 * @typedef {{ id: string, name: string, categories: ProfileCategory[] }} ListProfile
 */

class ListProfileContext {
    /** @type {ListProfile[]} */
    profiles = $state([]);

    loaded = $state(false);

    async load() {
        try {
            const res = await fetch('/api/listprofiles');
            if (!res.ok) return;
            const { profiles } = await res.json();
            this.profiles = profiles;
        } finally {
            this.loaded = true;
        }
    }

    reset() {
        this.profiles = [];
        this.loaded = false;
    }

    /** @param {string} name */
    async createProfile(name) {
        try {
            const res = await fetch('/api/listprofiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error();
            const { profile } = await res.json();
            this.profiles = [...this.profiles, profile];
            return profile;
        } catch {
            notificationContext.show('Kunde inte skapa profil. Försök igen.');
            return null;
        }
    }

    /**
     * @param {string} id
     * @param {string} name
     */
    async renameProfile(id, name) {
        const profile = this.profiles.find(p => p.id === id);
        if (!profile) return false;
        const prev = profile.name;
        profile.name = name;
        try {
            const res = await fetch(`/api/listprofiles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            profile.name = prev;
            notificationContext.show('Kunde inte byta namn. Försök igen.');
            return false;
        }
    }

    /** @param {string} id */
    async deleteProfile(id) {
        try {
            const res = await fetch(`/api/listprofiles/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                if (data.error === 'in_use_lists') {
                    notificationContext.show('Profilen används av en eller flera listor och kan inte tas bort.');
                } else if (data.error === 'in_use_stores') {
                    notificationContext.show('Profilen används av ett eller flera varuhus och kan inte tas bort.');
                } else {
                    notificationContext.show('Kunde inte ta bort profil. Försök igen.');
                }
                return false;
            }
            this.profiles = this.profiles.filter(p => p.id !== id);
            return true;
        } catch {
            notificationContext.show('Kunde inte ta bort profil. Försök igen.');
            return false;
        }
    }

    /**
     * @param {string} profileId
     * @param {string} name
     * @param {string} [color]
     */
    async addCategory(profileId, name, color) {
        if (!name.trim()) return null;
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return null;
        const safeColor = color || fallbackColors[profile.categories.length % fallbackColors.length];
        try {
            const res = await fetch(`/api/listprofiles/${profileId}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), color: safeColor })
            });
            if (!res.ok) throw new Error();
            const { category } = await res.json();
            profile.categories = [...profile.categories, category];
            return category;
        } catch {
            notificationContext.show('Kunde inte lägga till kategori. Försök igen.');
            return null;
        }
    }

    /**
     * @param {string} profileId
     * @param {string} catId
     * @param {{ name?: string, color?: string }} updates
     */
    async updateCategory(profileId, catId, updates) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return false;
        const cat = profile.categories.find(c => c.id === catId);
        if (!cat) return false;
        const prev = { name: cat.name, color: cat.color };
        if (updates.name !== undefined) cat.name = updates.name;
        if (updates.color !== undefined) cat.color = updates.color;
        try {
            const res = await fetch(`/api/listprofiles/${profileId}/categories/${catId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            cat.name = prev.name;
            cat.color = prev.color;
            notificationContext.show('Kunde inte uppdatera kategori. Försök igen.');
            return false;
        }
    }

    /**
     * @param {string} profileId
     * @param {string} catId
     */
    async removeCategory(profileId, catId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;
        const prev = [...profile.categories];
        profile.categories = profile.categories.filter(c => c.id !== catId);
        try {
            const res = await fetch(`/api/listprofiles/${profileId}/categories/${catId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
        } catch {
            profile.categories = prev;
            notificationContext.show('Kunde inte ta bort kategori. Försök igen.');
        }
    }

    /**
     * @param {string} id
     * @returns {ListProfile | undefined}
     */
    getProfile(id) {
        return this.profiles.find(p => p.id === id);
    }
}

export const listprofileContext = new ListProfileContext();
