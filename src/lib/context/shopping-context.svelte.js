import { browser } from '$app/environment';
import { notificationContext } from './notification-context.svelte';

/**
 * @typedef {{ itemId: string, name: string, spec: string, quantity: number, bought: boolean, category: string }} ShoppingItem
 * @typedef {{ id: string, name: string, owner: string, sharedWith: string[], pendingInvites: string[], items: ShoppingItem[] }} ShoppingList
 * @typedef {{ id: string, listId: string, listName: string, fromUser: string, createdAt: string }} Invitation
 * @typedef {{ clearedAt: string, items: ShoppingItem[] }} BoughtEntry
 */

class ShoppingContext {
    /** @type {ShoppingList[]} */
    lists = $state([]);

    /** @type {Invitation[]} */
    invitations = $state([]);

    /** @type {{ [listId: string]: BoughtEntry[] }} */
    recentlyBought = $state({});

    constructor() {
        if (browser) {
            try {
                const saved = localStorage.getItem('mazeshopper_recentlyBought');
                if (saved) this.recentlyBought = JSON.parse(saved);
            } catch { /* ignore */ }
        }
    }

    async load() {
        const [listsRes, invRes] = await Promise.all([
            fetch('/api/lists'),
            fetch('/api/invitations')
        ]);
        if (listsRes.ok) {
            const { lists } = await listsRes.json();
            this.lists = lists;
        }
        if (invRes.ok) {
            const { invitations } = await invRes.json();
            this.invitations = invitations;
        }
    }

    /** Refresh a single list from the server (used for polling in shopping mode). */
    /** @param {string} listId */
    async refreshList(listId) {
        try {
            const res = await fetch(`/api/lists/${listId}`);
            if (!res.ok) return;
            const { list } = await res.json();
            const idx = this.lists.findIndex(l => l.id === listId);
            if (idx !== -1) this.lists[idx] = list;
        } catch { /* silent poll failure */ }
    }

    reset() {
        this.lists = [];
        this.invitations = [];
    }

    /**
     * @param {string} name
     * @param {string} owner
     */
    async createList(name, owner) {
        const res = await fetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, owner })
        });
        const { list } = await res.json();
        this.lists.push(list);
        return list.id;
    }

    /** @param {string} id */
    async deleteList(id) {
        await fetch(`/api/lists/${id}`, { method: 'DELETE' });
        const i = this.lists.findIndex(l => l.id === id);
        if (i !== -1) this.lists.splice(i, 1);
    }

    /** @param {string} id */
    getList(id) {
        return this.lists.find(l => l.id === id) ?? null;
    }

    /** @param {string} username */
    listsForUser(username) {
        return this.lists.filter(l =>
            l.owner === username ||
            l.sharedWith.some(u => u.toLowerCase() === username.toLowerCase())
        );
    }

    /**
     * @param {string} listId
     * @param {string} username
     * @returns {Promise<'ok' | 'already_shared' | 'already_invited' | 'not_found' | 'user_not_found'>}
     */
    async shareList(listId, username) {
        const res = await fetch(`/api/lists/${listId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) return data.error;
        const list = this.getList(listId);
        if (list) list.pendingInvites = [...(list.pendingInvites ?? []), username];
        return 'ok';
    }

    /**
     * @param {string} listId
     * @param {string} username
     */
    async unshareList(listId, username) {
        await fetch(`/api/lists/${listId}/share`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const list = this.getList(listId);
        if (list) {
            list.sharedWith = list.sharedWith.filter(u => u.toLowerCase() !== username.toLowerCase());
            list.pendingInvites = (list.pendingInvites ?? []).filter(u => u.toLowerCase() !== username.toLowerCase());
        }
    }

    /** @param {string} invId */
    async acceptInvitation(invId) {
        await fetch(`/api/invitations/${invId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept' })
        });
        this.invitations = this.invitations.filter(i => i.id !== invId);
        const res = await fetch('/api/lists');
        if (res.ok) {
            const { lists } = await res.json();
            this.lists = lists;
        }
    }

    /** @param {string} invId */
    async declineInvitation(invId) {
        await fetch(`/api/invitations/${invId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'decline' })
        });
        this.invitations = this.invitations.filter(i => i.id !== invId);
    }

    /**
     * @param {string} listId
     * @param {string} name
     * @param {string} spec
     * @param {string} category
     * @returns {Promise<boolean>}
     */
    async addItem(listId, name, spec, category) {
        const list = this.getList(listId);
        if (!list) return false;
        const itemId = crypto.randomUUID();
        const item = { itemId, name, spec, quantity: 1, bought: false, category };
        // Optimistic update
        list.items = [...list.items, item];
        try {
            const res = await fetch(`/api/lists/${listId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            list.items = list.items.filter(i => i.itemId !== itemId);
            notificationContext.show('Kunde inte lägga till vara. Försök igen.');
            return false;
        }
    }

    /**
     * @param {string} listId
     * @param {string} itemId
     */
    async removeItem(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item) return;
        // Optimistic update
        list.items = list.items.filter(i => i.itemId !== itemId);
        try {
            const res = await fetch(`/api/lists/${listId}/items/${itemId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
        } catch {
            list.items = [...list.items, item];
            notificationContext.show('Kunde inte ta bort vara. Försök igen.');
        }
    }

    /**
     * @param {string} listId
     * @param {string} itemId
     */
    async toggleBought(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item) return;
        const prevBought = item.bought;
        // Optimistic update
        item.bought = !prevBought;
        try {
            const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bought: item.bought })
            });
            if (!res.ok) throw new Error();
        } catch {
            item.bought = prevBought;
            notificationContext.show('Kunde inte uppdatera vara. Försök igen.');
        }
    }

    /**
     * @param {string} listId
     * @param {string} itemId
     */
    async increaseQuantity(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item) return;
        const prevQty = item.quantity;
        const newQty = prevQty + 1;
        item.quantity = newQty;
        try {
            const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty })
            });
            if (!res.ok) throw new Error();
        } catch {
            item.quantity = prevQty;
            notificationContext.show('Kunde inte uppdatera antal. Försök igen.');
        }
    }

    /**
     * @param {string} listId
     * @param {string} itemId
     */
    async decreaseQuantity(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item) return;
        if (item.quantity <= 1) return;
        const prevQty = item.quantity;
        const newQty = prevQty - 1;
        item.quantity = newQty;
        try {
            const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty })
            });
            if (!res.ok) throw new Error();
        } catch {
            item.quantity = prevQty;
            notificationContext.show('Kunde inte uppdatera antal. Försök igen.');
        }
    }

    /** @param {string} listId */
    async clearBought(listId) {
        const list = this.getList(listId);
        if (!list) return;
        const boughtItems = list.items.filter(i => i.bought);
        if (boughtItems.length === 0) return;
        // Save to history before clearing
        this.#addToHistory(listId, boughtItems);
        // Optimistic update
        list.items = list.items.filter(i => !i.bought);
        try {
            const res = await fetch(`/api/lists/${listId}/items?bought=true`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
        } catch {
            list.items = [...list.items, ...boughtItems];
            this.#removeLastHistory(listId);
            notificationContext.show('Kunde inte rensa köpta varor. Försök igen.');
        }
    }

    /** @param {string} listId */
    async clearAll(listId) {
        const list = this.getList(listId);
        if (!list) return;
        const prevItems = [...list.items];
        // Optimistic update
        list.items = [];
        try {
            const res = await fetch(`/api/lists/${listId}/items`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
        } catch {
            list.items = prevItems;
            notificationContext.show('Kunde inte tömma listan. Försök igen.');
        }
    }

    /**
     * @param {string} listId
     * @param {ShoppingItem[]} items
     */
    #addToHistory(listId, items) {
        const entry = { clearedAt: new Date().toISOString(), items: [...items] };
        const existing = this.recentlyBought[listId] ?? [];
        this.recentlyBought = { ...this.recentlyBought, [listId]: [entry, ...existing].slice(0, 3) };
        this.#saveHistory();
    }

    /** @param {string} listId */
    #removeLastHistory(listId) {
        const existing = this.recentlyBought[listId] ?? [];
        this.recentlyBought = { ...this.recentlyBought, [listId]: existing.slice(1) };
        this.#saveHistory();
    }

    #saveHistory() {
        if (browser) {
            try {
                localStorage.setItem('mazeshopper_recentlyBought', JSON.stringify(this.recentlyBought));
            } catch { /* ignore quota errors */ }
        }
    }
}

export const shoppingContext = new ShoppingContext();
