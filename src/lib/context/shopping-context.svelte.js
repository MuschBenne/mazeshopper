import { browser } from '$app/environment';
import { notificationContext } from './notification-context.svelte';
import { normalizeUnit, sanitizeQuantity, scaleQuantity, stepForUnit } from '$lib/units';

/**
 * `quantity: null` betyder "ingen mängd angiven" och `unit: ''` betyder styck.
 * Varor som skapades innan enheter fanns saknar fältet helt och serializeList
 * fyller i tomma strängen åt dem.
 * @typedef {{ itemId: string, name: string, spec: string, quantity: number | null, unit?: string, bought: boolean, category: string, addedBy?: string }} ShoppingItem
 * @typedef {{ id: string, name: string, owner: string, profileId: string | null, sharedWith: string[], pendingInvites: string[], items: ShoppingItem[] }} ShoppingList
 * @typedef {{ id: string, listId: string, listName: string, fromUser: string, createdAt: string }} Invitation
 * @typedef {{ clearedAt: string, items: ShoppingItem[] }} BoughtEntry
 */

// Manages all shopping lists, invitations, and recently bought history.
// Uses optimistic updates throughout: the UI updates immediately and rolls back on server error.
class ShoppingContext {
    /** @type {ShoppingList[]} */
    lists = $state([]);

    /** @type {Invitation[]} */
    invitations = $state([]);

    loaded = $state(false);

    // Keyed by listId — stores up to 3 recent "cleared bought" sessions per list.
    /** @type {{ [listId: string]: BoughtEntry[] }} */
    recentlyBought = $state({});

    constructor() {
        // Restore purchase history from localStorage so it survives page reloads.
        if (browser) {
            try {
                const saved = localStorage.getItem('mazeshopper_recentlyBought');
                if (saved) this.recentlyBought = JSON.parse(saved);
            } catch { /* ignore parse errors from corrupt storage */ }
        }
    }

    // Räknas upp varje gång listorna seedas från en server-load. En pågående
    // load() jämför mot värdet den startade med och kastar sitt svar om en
    // nyare seed hunnit landa — annars kan ett långsamt /api/lists-svar skriva
    // över både färsk server-data och optimistiska ändringar gjorda under tiden.
    #seedGen = 0;

    // Räknare som ökar vid varje seedList. load() jämför mot värdet den startade
    // med för att se vilka enskilda listor som seedats medan svaret var i luften.
    #seedTick = 0;

    /** @type {Map<string, number>} */
    #listSeedTick = new Map();

    // Antal egna mutationer som är i luften per lista. Så länge det är fler än
    // noll speglar servern fortfarande ett äldre läge, och dess ögonblicksbilder
    // ska inte få skriva över den optimistiska staten.
    /** @type {Map<string, number>} */
    #pendingMutations = new Map();

    // Listor där minst en ögonblicksbild kastats — de måste stämmas av mot
    // servern när mutationerna lagt sig, annars tappas andras ändringar.
    /** @type {Set<string>} */
    #missedSnapshots = new Set();

    // Sätts när inbjudningarna kommit med från en server-load.
    #invitationsSeeded = false;

    // Inbjudningarna hämtades tidigare alltid klientsida och dök upp ovanför
    // listgriden när svaret landade, vilket knuffade ned korten under fingret.
    /** @param {Invitation[]} invitations */
    seedInvitations(invitations) {
        this.invitations = [...invitations];
        this.#invitationsSeeded = true;
    }

    // Fyller listorna från data som redan hämtats server-side.
    /** @param {ShoppingList[]} lists */
    seedAll(lists) {
        // Kopieras så att optimistiska mutationer inte skriver i SvelteKits
        // cachade load-data.
        this.lists = [...lists];
        this.loaded = true;
        this.#seedGen++;
    }

    // Loads all lists the current user owns or has been shared with, plus pending invitations.
    async load() {
        // Sidor som redan hämtat listorna server-side seedar dem före render.
        // Att hämta om dem direkt efteråt vore samma fråga en gång till —
        // /api/lists och sidornas server-load använder samma åtkomstfilter.
        const gen = this.#seedGen;
        const tick = this.#seedTick;
        const listsAreSeeded = this.loaded && gen > 0;
        try {
            const [listsRes, invRes] = await Promise.all([
                listsAreSeeded ? null : fetch('/api/lists'),
                this.#invitationsSeeded ? null : fetch('/api/invitations')
            ]);
            if (listsRes?.ok) {
                const { lists } = await listsRes.json();
                // Släpp svaret om en seed hunnit landa medan det var i luften.
                // En enskild lista som seedats under tiden är färskare än svaret
                // och behålls — resten av listorna kommer bara härifrån.
                if (this.#seedGen === gen) {
                    this.lists = lists.map((/** @type {ShoppingList} */ l) =>
                        (this.#listSeedTick.get(l.id) ?? 0) > tick ? (this.getList(l.id) ?? l) : l
                    );
                }
            }
            if (invRes?.ok) {
                const { invitations } = await invRes.json();
                this.invitations = invitations;
            }
        } catch {
            notificationContext.show('Kunde inte ladda listor. Kontrollera din anslutning.');
        } finally {
            this.loaded = true;
        }
    }

    // Tar emot en ögonblicksbild från SSE-strömmen. Strömmen skickar tillbaka
    // hela dokumentet även för ens egna ändringar, så en bild som beskriver
    // läget före en mutation som fortfarande är i luften skulle nolla den —
    // för användaren ser det ut som att bocken hoppar tillbaka av sig själv.
    /** @param {ShoppingList} list */
    applyUpdate(list) {
        if ((this.#pendingMutations.get(list.id) ?? 0) > 0) {
            this.#missedSnapshots.add(list.id);
            return;
        }
        const idx = this.lists.findIndex(l => l.id === list.id);
        if (idx !== -1) this.lists[idx] = list;
    }

    /** @param {string} listId */
    #beginMutation(listId) {
        this.#pendingMutations.set(listId, (this.#pendingMutations.get(listId) ?? 0) + 1);
    }

    // När den sista mutationen kvitterats motsvarar den lokala staten det vi
    // skickat. Har vi däremot kastat en ögonblicksbild på vägen kan den ha
    // innehållit någon annans ändring, och då måste listan hämtas om en gång.
    /** @param {string} listId */
    #endMutation(listId) {
        const left = (this.#pendingMutations.get(listId) ?? 1) - 1;
        if (left > 0) {
            this.#pendingMutations.set(listId, left);
            return;
        }
        this.#pendingMutations.delete(listId);
        if (this.#missedSnapshots.delete(listId)) this.#resync(listId);
    }

    /** @param {string} listId */
    async #resync(listId) {
        try {
            const res = await fetch(`/api/lists/${listId}`);
            if (!res.ok) return;
            const { list } = await res.json();
            this.applyUpdate(list);
        } catch { /* nästa ström-uppdatering rättar till det */ }
    }

    /**
     * Kör en mutation som ändrar listdokumentet och håller undan strömmens
     * ögonblicksbilder så länge den är i luften.
     * @template T
     * @param {string} listId
     * @param {() => Promise<T>} run
     * @returns {Promise<T>}
     */
    async #mutating(listId, run) {
        this.#beginMutation(listId);

        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            this.#endMutation(listId);
        };

        // fetch har ingen egen timeout. Tappar telefonen täckning mitt i ett
        // anrop svarar det aldrig, och utan den här spärren skulle räknaren
        // aldrig gå ner — listan slutade då tyst ta emot uppdateringar från
        // strömmen tills sidan laddades om. Släpp taget och lita på att
        // avstämningen rättar staten när anslutningen är tillbaka.
        const timer = setTimeout(release, 15_000);

        try {
            return await run();
        } finally {
            clearTimeout(timer);
            release();
        }
    }

    // Lägger in en lista som redan hämtats server-side, så detaljsidan kan rendera
    // direkt utan att invänta den bredare /api/lists-hämtningen.
    /** @param {ShoppingList} list */
    seedList(list) {
        this.#listSeedTick.set(list.id, ++this.#seedTick);
        const idx = this.lists.findIndex(l => l.id === list.id);
        if (idx === -1) this.lists = [...this.lists, list];
        else this.lists[idx] = list;
    }

    // Clears all data on logout so the next user starts with a clean state.
    reset() {
        this.lists = [];
        this.invitations = [];
        this.loaded = false;
        this.#seedGen = 0;
        this.#seedTick = 0;
        this.#listSeedTick.clear();
        this.#pendingMutations.clear();
        this.#missedSnapshots.clear();
        this.#invitationsSeeded = false;
    }

    /**
     * @param {string} name
     * @param {string} owner
     */
    async createList(name, owner) {
        try {
            const res = await fetch('/api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, owner })
            });
            if (!res.ok) throw new Error();
            const { list } = await res.json();
            this.lists.push(list);
            return list.id;
        } catch {
            notificationContext.show('Kunde inte skapa lista. Försök igen.');
            return null;
        }
    }

    /**
     * Tar bort listan. Returnerar false om servern nekade — anroparen ska då
     * inte navigera bort, eftersom listan fortfarande finns kvar.
     * @param {string} id
     */
    async deleteList(id) {
        const i = this.lists.findIndex(l => l.id === id);
        const prev = i !== -1 ? this.lists[i] : null;
        if (i !== -1) this.lists.splice(i, 1);
        try {
            const res = await fetch(`/api/lists/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            if (prev) this.lists.splice(i, 0, prev);
            notificationContext.show('Kunde inte ta bort listan. Försök igen.');
            return false;
        }
    }

    /** @param {string} id */
    getList(id) {
        return this.lists.find(l => l.id === id) ?? null;
    }

    /**
     * Toggles the bought state of a single item with optimistic update.
     * @param {string} listId
     * @param {string} itemId
     */
    async toggleBought(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item) return;
        const prev = item.bought;
        item.bought = !prev;
        await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bought: !prev })
                });
                if (!res.ok) throw new Error();
            } catch {
                item.bought = prev;
                notificationContext.show('Kunde inte uppdatera vara. Försök igen.');
            }
        });
    }

    // Returns lists where the user is either the owner or in the sharedWith array.
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
        let res, data;
        try {
            res = await fetch(`/api/lists/${listId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            data = await res.json();
        } catch {
            notificationContext.show('Kunde inte dela listan. Kontrollera din anslutning.');
            return 'not_found';
        }
        if (!res.ok) return data.error;
        // Reflect the pending invite in the UI before the target accepts.
        const list = this.getList(listId);
        if (list) list.pendingInvites = [...(list.pendingInvites ?? []), username];
        return 'ok';
    }

    /**
     * @param {string} listId
     * @param {string} username
     */
    async unshareList(listId, username) {
        const list = this.getList(listId);
        const prevShared = list ? [...list.sharedWith] : null;
        const prevPending = list ? [...(list.pendingInvites ?? [])] : null;
        if (list) {
            // Remove from both arrays since the user may still be in pendingInvites.
            list.sharedWith = list.sharedWith.filter(u => u.toLowerCase() !== username.toLowerCase());
            list.pendingInvites = (list.pendingInvites ?? []).filter(u => u.toLowerCase() !== username.toLowerCase());
        }
        try {
            const res = await fetch(`/api/lists/${listId}/share`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            if (list && prevShared && prevPending) {
                list.sharedWith = prevShared;
                list.pendingInvites = prevPending;
            }
            notificationContext.show('Kunde inte ta bort delningen. Försök igen.');
            return false;
        }
    }

    /**
     * @param {string} listId
     * @param {string} username
     */
    async leaveList(listId, username) {
        const prev = [...this.lists];
        this.lists = this.lists.filter(l => l.id !== listId);
        try {
            const res = await fetch(`/api/lists/${listId}/share`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            this.lists = prev;
            notificationContext.show('Kunde inte lämna listan. Försök igen.');
            return false;
        }
    }

    /** @param {string} invId */
    async acceptInvitation(invId) {
        const prev = [...this.invitations];
        this.invitations = this.invitations.filter(i => i.id !== invId);
        try {
            const res = await fetch(`/api/invitations/${invId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept' })
            });
            if (!res.ok) throw new Error();
            // Re-fetch the full list of lists so the newly shared list appears immediately.
            const listsRes = await fetch('/api/lists');
            if (listsRes.ok) {
                const { lists } = await listsRes.json();
                this.lists = lists;
            }
            return true;
        } catch {
            this.invitations = prev;
            notificationContext.show('Kunde inte acceptera inbjudan. Försök igen.');
            return false;
        }
    }

    /** @param {string} invId */
    async declineInvitation(invId) {
        const prev = [...this.invitations];
        this.invitations = this.invitations.filter(i => i.id !== invId);
        try {
            const res = await fetch(`/api/invitations/${invId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'decline' })
            });
            if (!res.ok) throw new Error();
            return true;
        } catch {
            this.invitations = prev;
            notificationContext.show('Kunde inte neka inbjudan. Försök igen.');
            return false;
        }
    }

    /**
     * @param {string} listId
     * @param {string} name
     * @param {string} spec
     * @param {string} category
     * @param {string} [addedBy]
     * @param {{ quantity?: number | null, unit?: string }} [amount]
     * @returns {Promise<boolean>}
     */
    async addItem(listId, name, spec, category, addedBy = '', amount = {}) {
        const list = this.getList(listId);
        if (!list) return false;
        const itemId = crypto.randomUUID();
        const item = {
            itemId,
            name,
            spec,
            quantity: sanitizeQuantity(amount.quantity),
            unit: normalizeUnit(amount.unit),
            bought: false,
            category,
            addedBy
        };
        // Optimistic update — show the item immediately before the server confirms.
        list.items = [...list.items, item];
        return await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                if (!res.ok) throw new Error();
                return true;
            } catch {
                // Roll back the optimistic update on failure.
                list.items = list.items.filter(i => i.itemId !== itemId);
                notificationContext.show('Kunde inte lägga till vara. Försök igen.');
                return false;
            }
        });
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
        // Optimistic update.
        list.items = list.items.filter(i => i.itemId !== itemId);
        await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/items/${itemId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error();
            } catch {
                // Restore the item if the delete failed.
                list.items = [...list.items, item];
                notificationContext.show('Kunde inte ta bort vara. Försök igen.');
            }
        });
    }

    /**
     * Updates the item's name, spec, category, quantity and unit both locally
     * and on the server. Mängd och enhet skickas bara med när anroparen anger
     * dem, så en redigering utan de fälten lämnar mängden orörd.
     * @param {string} listId
     * @param {string} itemId
     * @param {string} name
     * @param {string} spec
     * @param {string} category
     * @param {{ quantity?: number | null, unit?: string }} [amount]
     */
    async editItem(listId, itemId, name, spec, category, amount) {
        const list = this.getList(listId);
        if (!list) return false;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item) return false;
        const prev = { name: item.name, spec: item.spec, category: item.category, quantity: item.quantity, unit: item.unit };

        /** @type {Record<string, unknown>} */
        const payload = { name: name.trim(), spec: spec.trim(), category };
        if (amount) {
            payload.quantity = sanitizeQuantity(amount.quantity);
            payload.unit = normalizeUnit(amount.unit);
        }

        // Optimistic update.
        item.name = name.trim();
        item.spec = spec.trim();
        item.category = category;
        if (amount) {
            item.quantity = /** @type {number | null} */ (payload.quantity);
            item.unit = /** @type {string} */ (payload.unit);
        }

        return await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error();
                return true;
            } catch {
                item.name = prev.name;
                item.spec = prev.spec;
                item.category = prev.category;
                item.quantity = prev.quantity;
                item.unit = prev.unit;
                notificationContext.show('Kunde inte uppdatera vara. Försök igen.');
                return false;
            }
        });
    }

    /**
     * Stegar mängden ett steg uppåt i varans egen enhet: 1 st, 0,5 l, 50 g.
     * En vara utan angiven mängd får sitt första steg.
     * @param {string} listId
     * @param {string} itemId
     */
    async increaseQuantity(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item) return;
        const step = stepForUnit(item.unit ?? '');
        await this.#setQuantity(listId, itemId, item, sanitizeQuantity((item.quantity ?? 0) + step));
    }

    /**
     * Ett steg nedåt. Under ett helt steg finns ingen meningsfull mängd kvar,
     * så då tas mängden bort helt — samma tillstånd som en vara man skrev in
     * utan mängd. Ett tryck på plus ger tillbaka den.
     * @param {string} listId
     * @param {string} itemId
     */
    async decreaseQuantity(listId, itemId) {
        const list = this.getList(listId);
        if (!list) return;
        const item = list.items.find(i => i.itemId === itemId);
        if (!item || item.quantity == null) return;
        const step = stepForUnit(item.unit ?? '');
        await this.#setQuantity(listId, itemId, item, sanitizeQuantity(item.quantity - step));
    }

    /**
     * @param {string} listId
     * @param {string} itemId
     * @param {ShoppingItem} item
     * @param {number | null} newQty
     */
    async #setQuantity(listId, itemId, item, newQty) {
        const prevQty = item.quantity ?? null;
        if (newQty === prevQty) return;
        item.quantity = newQty;
        await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/items/${itemId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity: newQty })
                });
                if (!res.ok) throw new Error();
            } catch {
                item.quantity = prevQty;
                notificationContext.show('Kunde inte uppdatera mängden. Försök igen.');
            }
        });
    }

    /** @param {string} listId */
    async clearBought(listId) {
        const list = this.getList(listId);
        if (!list) return;
        const boughtItems = list.items.filter(i => i.bought);
        if (boughtItems.length === 0) return;
        // Save to history before clearing so the user can review what was bought.
        this.#addToHistory(listId, boughtItems);
        // Optimistic update.
        list.items = list.items.filter(i => !i.bought);
        await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/items?bought=true`, { method: 'DELETE' });
                if (!res.ok) throw new Error();
            } catch {
                // Restore both the items and the history entry on failure.
                list.items = [...list.items, ...boughtItems];
                this.#removeLastHistory(listId);
                notificationContext.show('Kunde inte rensa köpta varor. Försök igen.');
            }
        });
    }

    /**
     * Bulk-imports items from a template into a list with optimistic update.
     * @param {string} listId
     * @param {{ name: string, spec: string, quantity: number | null, unit?: string, category: string }[]} items
     * @param {number} [scale] Skalfaktor för recept — 1 för mallar.
     * @param {string} [addedBy] Vem som importerar. Servern sätter samma värde;
     *   utan det här dyker raderna upp utan namn och får det först när svaret
     *   landar, i listor där "visa vem som la till" är påslaget.
     */
    async importItems(listId, items, scale = 1, addedBy = '') {
        const list = this.getList(listId);
        if (!list) return false;
        const tempIds = /** @type {Set<string>} */ (new Set());
        const optimisticItems = items.map(i => {
            const itemId = crypto.randomUUID();
            tempIds.add(itemId);
            // Samma avrundning som servern kör — den bor i $lib/units just för
            // att de två inte ska kunna glida isär och få talen att hoppa när
            // svaret landar. Skalfaktorn klamras inuti scaleQuantity, så en
            // orimlig faktor ger samma tal här som där.
            const unit = normalizeUnit(i.unit);
            return { ...i, itemId, bought: false, unit, addedBy, quantity: scaleQuantity(i.quantity, unit, scale) };
        });
        list.items = [...list.items, ...optimisticItems];
        return await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items, scale })
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                // Replace temp IDs with the real IDs assigned by the server
                list.items = [...list.items.filter(i => !tempIds.has(i.itemId)), ...data.items];
                return true;
            } catch {
                list.items = list.items.filter(i => !tempIds.has(i.itemId));
                notificationContext.show('Kunde inte importera varor. Försök igen.');
                return false;
            }
        });
    }

    /** @param {string} listId */
    async clearAll(listId) {
        const list = this.getList(listId);
        if (!list) return;
        const prevItems = [...list.items];
        // Optimistic update.
        list.items = [];
        await this.#mutating(listId, async () => {
            try {
                const res = await fetch(`/api/lists/${listId}/items`, { method: 'DELETE' });
                if (!res.ok) throw new Error();
            } catch {
                list.items = prevItems;
                notificationContext.show('Kunde inte tömma listan. Försök igen.');
            }
        });
    }

    // Prepends a new history entry and keeps at most 3 entries per list.
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

    // Removes the most recent history entry — used when a clearBought rollback occurs.
    /** @param {string} listId */
    #removeLastHistory(listId) {
        const existing = this.recentlyBought[listId] ?? [];
        this.recentlyBought = { ...this.recentlyBought, [listId]: existing.slice(1) };
        this.#saveHistory();
    }

    // Persists purchase history to localStorage so it survives page reloads.
    #saveHistory() {
        if (browser) {
            try {
                localStorage.setItem('mazeshopper_recentlyBought', JSON.stringify(this.recentlyBought));
            } catch { /* ignore storage quota errors */ }
        }
    }
}

export const shoppingContext = new ShoppingContext();
