/**
 * @typedef {{ itemId: string, name: string, spec: string, quantity: number, bought: boolean, category: string }} ShoppingItem
 * @typedef {{ id: string, name: string, owner: string, sharedWith: string[], pendingInvites: string[], items: ShoppingItem[] }} ShoppingList
 * @typedef {{ id: string, listId: string, listName: string, fromUser: string, createdAt: string }} Invitation
 */

class ShoppingContext {
    /** @type {ShoppingList[]} */
    lists = $state([]);

    /** @type {Invitation[]} */
    invitations = $state([]);

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

    /**
     * @param {string} invId
     */
    async acceptInvitation(invId) {
        await fetch(`/api/invitations/${invId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept' })
        });
        this.invitations = this.invitations.filter(i => i.id !== invId);
        // Reload lists so the newly accepted list appears
        const res = await fetch('/api/lists');
        if (res.ok) {
            const { lists } = await res.json();
            this.lists = lists;
        }
    }

    /**
     * @param {string} invId
     */
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
     */
    async addItem(listId, name, spec, category) {
        const list = this.getList(listId);
        if (!list) return;
        const itemId = crypto.randomUUID();
        const item = { itemId, name, spec, quantity: 1, bought: false, category };
        await fetch(`/api/lists/${listId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        list.items = [...list.items, item];
    }

    /**
     * @param {string} listId
     * @param {number} index
     */
    async removeItem(listId, index) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items[index];
        await fetch(`/api/lists/${listId}/items/${item.itemId}`, { method: 'DELETE' });
        list.items.splice(index, 1);
    }

    /**
     * @param {string} listId
     * @param {number} index
     */
    async toggleBought(listId, index) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items[index];
        const newBought = !item.bought;
        await fetch(`/api/lists/${listId}/items/${item.itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bought: newBought })
        });
        list.items[index].bought = newBought;
    }

    /**
     * @param {string} listId
     * @param {number} index
     */
    async increaseQuantity(listId, index) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items[index];
        const newQty = item.quantity + 1;
        await fetch(`/api/lists/${listId}/items/${item.itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: newQty })
        });
        list.items[index].quantity = newQty;
    }

    /**
     * @param {string} listId
     * @param {number} index
     */
    async decreaseQuantity(listId, index) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items[index];
        if (item.quantity <= 1) return;
        const newQty = item.quantity - 1;
        await fetch(`/api/lists/${listId}/items/${item.itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: newQty })
        });
        list.items[index].quantity = newQty;
    }

    /** @param {string} listId */
    async clearBought(listId) {
        await fetch(`/api/lists/${listId}/items?bought=true`, { method: 'DELETE' });
        const list = this.getList(listId);
        if (list) list.items = list.items.filter(i => !i.bought);
    }

    /** @param {string} listId */
    async clearAll(listId) {
        await fetch(`/api/lists/${listId}/items`, { method: 'DELETE' });
        const list = this.getList(listId);
        if (list) list.items = [];
    }
}

export const shoppingContext = new ShoppingContext();
