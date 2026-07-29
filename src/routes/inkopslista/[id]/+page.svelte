<script>
    // Detail page for a single shopping list.
    // Supports two modes: edit mode (add/remove/edit items) and shopping mode (check off items).
    import { shoppingContext } from "$lib/context/shopping-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { storeContext } from "$lib/context/store-context.svelte";
    import SharePanel from "$lib/components/SharePanel.svelte";
    import CategorySection from "$lib/components/CategorySection.svelte";
    import ImportModal from "$lib/components/ImportModal.svelte";
    import { untrack } from 'svelte';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { fade, slide, fly } from 'svelte/transition';

    let { data } = $props();

    const id = $derived(page.params.id ?? '');

    // Listan kommer med från server-load — seedas före första render så sidan
    // visas direkt istället för att vänta på layoutens /api/lists-hämtning.
    //
    // seedList() läser lists för att hitta rätt plats. Utan untrack blir lists ett
    // beroende för effekten, och då skulle varje senare ändring — en avbockning,
    // en SSE-uppdatering — väcka effekten och skriva tillbaka server-snapshotten.
    // Seedningen ska bara ske när server-datan faktiskt är ny.
    $effect.pre(() => {
        const seed = data.list;
        if (seed) untrack(() => shoppingContext.seedList(seed));
    });

    // Faller tillbaka på server-datan: under SSR och fram till första flush efter
    // hydrering är contexten tom, och utan fallback renderas "Listan hittades
    // inte" trots att listan finns.
    const seededList = $derived(
        /** @type {import('$lib/context/shopping-context.svelte').ShoppingList | null} */ (data.list ?? null)
    );
    const list = $derived(shoppingContext.getList(id) ?? seededList);
    const username = $derived(authContext.user?.username ?? '');
    // Only the owner can delete the list or share it with others.
    const isOwner = $derived(list?.owner === username);
    const isShared = $derived((list?.sharedWith?.length ?? 0) > 0);

    let newItem = $state('');
    let spec = $state('');
    /** @type {HTMLInputElement | null} */
    let itemInputEl = $state(null);
    let selectedCategory = $state('');
    let showImportModal = $state(false);
    let shoppingMode = $state(false);
    let showSharePanel = $state(false);
    let search = $state('');
    let showHistory = $state(false);
    let sseConnected = $state(false);
    let sseHasConnected = $state(false);
    let categoryError = $state(false);
    let confirmDeleteList = $state(false);
    let confirmClearAll = $state(false);
    let confirmLeaveList = $state(false);
    let showAddedBy = $state(false);

    // Persist the last-used category per list in sessionStorage so it's
    // pre-selected when the user navigates back to the same list.
    // If the profile only has one category (e.g. Generisk lista), auto-select it.
    $effect(() => {
        if (!browser) return;
        const saved = sessionStorage.getItem(`lastCategory_${id}`);
        if (saved) {
            selectedCategory = saved;
        } else if (profileCategories.length === 1) {
            selectedCategory = profileCategories[0].name;
        } else {
            selectedCategory = '';
        }
    });

    $effect(() => {
        if (!browser) return;
        const saved = localStorage.getItem(`mazeshopper_showAddedBy_${id}`);
        if (saved === 'true') showAddedBy = true;
    });

    $effect(() => {
        if (!browser) return;
        localStorage.setItem(`mazeshopper_showAddedBy_${id}`, String(showAddedBy));
    });

    $effect(() => {
        if (browser && selectedCategory) {
            sessionStorage.setItem(`lastCategory_${id}`, selectedCategory);
        }
    });

    // Connect to the SSE stream for this list so all collaborators see changes in real-time.
    // EventSource reconnects automatically on error; we just track connection state for the UI.
    $effect(() => {
        if (!browser || !id) return;
        const es = new EventSource(`/api/lists/${id}/stream`);
        es.onopen = () => { sseConnected = true; sseHasConnected = true; };
        es.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.deleted) { goto('/inkopslista'); return; }
            shoppingContext.applyUpdate(data);
        };
        es.onerror = () => { sseConnected = false; };
        return () => es.close();
    });

    // Servern stänger strömmen med jämna mellanrum (funktioner har en maxlivslängd),
    // så korta avbrott är normala och löser sig på ett ögonblick. Vänta därför in
    // återanslutningen innan varningen visas — annars blinkar den mitt i handlingen.
    let showOffline = $state(false);
    $effect(() => {
        if (!sseHasConnected || sseConnected) {
            showOffline = false;
            return;
        }
        const timer = setTimeout(() => { showOffline = true; }, 6000);
        return () => clearTimeout(timer);
    });

    const boughtCount = $derived(list?.items.filter(i => i.bought).length ?? 0);
    const totalCount = $derived(list?.items.length ?? 0);
    const progressPct = $derived(totalCount > 0 ? Math.round((boughtCount / totalCount) * 100) : 0);

    // Handelsläget behöver synas utanför den här sidan: header och nav ligger i
    // layouten och går inte att nå härifrån. Attributet på <html> låter dem
    // gömma sig, så att hela skärmen tillhör listan när man står i butiken.
    $effect(() => {
        if (!browser || !shoppingMode) return;
        document.documentElement.dataset.shopping = 'true';
        return () => { delete document.documentElement.dataset.shopping; };
    });

    // Skärmen ska inte slockna mitt i en handlingsrunda. Webbläsaren släpper
    // låset när fliken döljs, så det måste tas om när man kommer tillbaka.
    $effect(() => {
        if (!browser || !shoppingMode) return;
        const wakeLock = /** @type {any} */ (navigator).wakeLock;
        if (!wakeLock) return;

        /** @type {any} */
        let lock = null;
        let cancelled = false;

        const acquire = async () => {
            if (cancelled || lock || document.visibilityState !== 'visible') return;
            try {
                const held = await wakeLock.request('screen');
                if (cancelled) held.release().catch(() => {});
                else lock = held;
            } catch { /* kan nekas vid t.ex. låg batterinivå — handlingen fungerar ändå */ }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') acquire();
            else lock = null; // redan släppt av webbläsaren
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        acquire();

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            lock?.release().catch(() => {});
        };
    });

    // Profile categories come from the server load — covers both owned and shared lists.
    const profileCategories = $derived(
        /** @type {{ id: string, name: string, color: string }[]} */ (data.profileCategories ?? [])
    );

    const sortedCategories = $derived.by(() => {
        const store = storeContext.selectedStore;
        // Rutten är namnbaserad, och kategorier som saknas i den sorteras sist
        // (se Infinity nedan). En rutt från en annan profil är därför harmlös.
        // Villkoret som krävde samma profil gjorde att den man delar en lista
        // med aldrig fick någon sortering: mottagarens varuhus tillhör
        // mottagarens egna profiler, så det var alltid falskt.
        const base = (!store || Object.keys(store.categoryOrder).length === 0)
            ? profileCategories
            : [...profileCategories].sort((a, b) => {
                const pa = store.categoryOrder[a.name] ?? Infinity;
                const pb = store.categoryOrder[b.name] ?? Infinity;
                return pa - pb;
            });

        if (!list) return base;
        // A shared list may contain items with categories not in the profile.
        // Append any unknown categories so those items are still visible.
        const knownNames = new Set(base.map(c => c.name));
        const extraNames = [...new Set(list.items.map(i => i.category))].filter(n => n && !knownNames.has(n));
        if (extraNames.length === 0) return base;
        // Prefixas så ett kategorinamn aldrig kan krocka med pseudokategorins id.
        const extras = extraNames.map(name => ({ id: `extra:${name}`, name, color: '#e2e8f0' }));
        return [...base, ...extras];
    });

    // Varor kan sakna kategori — t.ex. importerade från en mall där kategori är
    // valfritt. Utan en egen hink filtrerades de bort ur alla sektioner och blev
    // osynliga, trots att de räknades i "X av Y varor köpta".
    //
    // Namnet får inte vara "Övrigt": samtliga standardprofiler har redan en
    // riktig kategori med det namnet, och två likadana rubriker vore omöjliga
    // att skilja åt.
    const UNCATEGORIZED = { id: '__uncategorized__', name: 'Utan kategori', color: '#e2e8f0' };

    // Filters the item list by the search query, matching on both name and spec.
    const filteredItems = $derived.by(() => {
        if (!list) return [];
        const q = search.trim().toLowerCase();
        if (!q) return list.items;
        return list.items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.spec.toLowerCase().includes(q)
        );
    });

    // Grupperar varorna i ett enda svep istället för en filtrering per kategori,
    // som annars körs om vid varje bock-av.
    const sections = $derived.by(() => {
        /** @type {Map<string, typeof filteredItems>} */
        const byCategory = new Map();
        for (const item of filteredItems) {
            const key = item.category || UNCATEGORIZED.id;
            const bucket = byCategory.get(key);
            if (bucket) bucket.push(item);
            else byCategory.set(key, [item]);
        }

        const result = [];
        for (const category of sortedCategories) {
            const items = byCategory.get(category.name);
            if (items?.length) result.push({ category, items });
        }
        const uncategorized = byCategory.get(UNCATEGORIZED.id);
        if (uncategorized?.length) result.push({ category: UNCATEGORIZED, items: uncategorized });
        return result;
    });

    const listHistory = $derived(shoppingContext.recentlyBought[id] ?? []);

    async function addItem() {
        if (selectedCategory === '') {
            categoryError = true;
            return;
        }
        categoryError = false;
        const name = newItem.trim();
        if (name.length === 0) return;

        // Varan läggs in optimistiskt i listan, så fälten töms direkt istället för
        // att låsas medan servern svarar. Det gör att flera varor kan matas in i
        // följd utan att vänta. Vid fel rullas varan tillbaka och en toast visas.
        const itemSpec = spec.trim();
        newItem = '';
        spec = '';
        itemInputEl?.focus();
        const ok = await shoppingContext.addItem(id, name, itemSpec, selectedCategory, username);
        // Ge tillbaka inmatningen vid fel, annars ber toasten användaren försöka
        // igen med tomma fält. Skriv bara över om inget nytt hunnit skrivas.
        if (!ok && newItem === '' && spec === '') {
            newItem = name;
            spec = itemSpec;
        }
    }

    async function deleteList() {
        const ok = await shoppingContext.deleteList(id);
        if (ok) goto('/inkopslista');
        else confirmDeleteList = false;
    }

    async function leaveList() {
        const ok = await shoppingContext.leaveList(id, username);
        if (ok) goto('/inkopslista');
        else confirmLeaveList = false;
    }

    /** @param {string} dateStr */
    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
</script>

<svelte:head><title>{list?.name ? `${list.name} – MazeShopper` : 'MazeShopper'}</title></svelte:head>

{#if !list}
    <div class="page">
        <p>Listan hittades inte. <a href="/inkopslista">Tillbaka</a></p>
    </div>
{:else}
    <div class="page" class:shopping-mode={shoppingMode}>

        <!-- Header -->
        <div class="list-header">
            {#if !shoppingMode}
                <a class="back" href="/inkopslista">← Listor</a>
            {/if}
            <h1>{list.name}</h1>
            <div class="header-actions">
                {#if !shoppingMode && isOwner}
                    <button class="btn-share" onclick={() => { showSharePanel = !showSharePanel; }}>
                        Dela
                    </button>
                {/if}
                {#if !shoppingMode && isOwner}
                    {#if confirmDeleteList}
                        <span class="confirm-inline">
                            <span>Ta bort?</span>
                            <button class="btn-confirm-sm btn-confirm-sm--danger" onclick={deleteList}>Ja</button>
                            <button class="btn-cancel" onclick={() => confirmDeleteList = false}>Nej</button>
                        </span>
                    {:else}
                        <button class="btn-delete-list" onclick={() => confirmDeleteList = true}>Ta bort</button>
                    {/if}
                {/if}
                {#if isShared}
                    <button
                        class="btn-added-by"
                        class:active={showAddedBy}
                        onclick={() => (showAddedBy = !showAddedBy)}
                        title="Visa vem som lade till varorna"
                    >Tillagd av</button>
                {/if}
                {#if !shoppingMode}
                    <!-- Avsluta-knappen bor nere vid tummen under handlingen. -->
                    <button
                        class="btn-shopping-mode"
                        onclick={() => { shoppingMode = true; showSharePanel = false; }}
                    >Handla</button>
                {/if}
            </div>
        </div>

        {#if !isOwner && !shoppingMode}
            <div class="shared-notice-row">
                <p class="shared-notice">Delad lista av <strong>{list.owner}</strong></p>
                {#if confirmLeaveList}
                    <span class="confirm-inline">
                        <span>Lämna listan?</span>
                        <button class="btn-confirm-sm btn-confirm-sm--danger" onclick={leaveList}>Ja</button>
                        <button class="btn-cancel" onclick={() => confirmLeaveList = false}>Nej</button>
                    </span>
                {:else}
                    <button class="btn-leave-list" onclick={() => confirmLeaveList = true}>Lämna lista</button>
                {/if}
            </div>
        {/if}

        <!-- Share panel -->
        {#if showSharePanel && isOwner && !shoppingMode}
            <div transition:fly={{ y: -6, duration: 200 }}>
                <SharePanel {list} listId={id} {username} onClose={() => (showSharePanel = false)} />
            </div>
        {/if}

        <!-- Offline indicator: shown when the SSE stream stays down past the grace period -->
        {#if showOffline}
            <div class="offline-badge" role="alert" transition:fade={{ duration: 250 }}>Ingen anslutning – listan uppdateras inte</div>
        {/if}

        <!-- Shopping mode: store selector + actions -->
        {#if shoppingMode}
            <!-- Förloppet är den enda återkopplingen under handlingen och låg
                 tidigare gömt under en rad grå text. Fäst det överst istället. -->
            <div
                class="shopping-topbar"
                role="progressbar"
                aria-label="Handlingsförlopp"
                aria-valuenow={progressPct}
                aria-valuemin="0"
                aria-valuemax="100"
            >
                <div class="shopping-topbar-fill" style="width: {progressPct}%"></div>
            </div>

            <button
                class="btn-exit-shopping"
                onclick={() => { shoppingMode = false; showSharePanel = false; }}
            >Avsluta handling</button>

            {#if storeContext.stores.length > 0}
                <div class="store-selector">
                    <span class="store-label">Varuhus:</span>
                    <div class="store-chips">
                        {#each storeContext.stores as store, i}
                            <button
                                class="store-chip"
                                class:selected={storeContext.selectedStoreIndex === i}
                                onclick={() => storeContext.selectStore(storeContext.selectedStoreIndex === i ? null : store.id)}
                            >{store.name}</button>
                        {/each}
                    </div>
                </div>
            {/if}
            {#if totalCount > 0}
                <p class="progress-text">{boughtCount} av {totalCount} varor köpta</p>
            {/if}
            <div class="list-actions">
                <button
                    class="btn-clear-bought"
                    onclick={() => shoppingContext.clearBought(id)}
                    disabled={!list.items.some(i => i.bought)}
                >
                    Rensa köpta varor
                </button>
                {#if confirmClearAll}
                    <span class="confirm-inline">
                        <span>Töm allt?</span>
                        <button class="btn-confirm-sm btn-confirm-sm--danger" onclick={() => { shoppingContext.clearAll(id); confirmClearAll = false; }}>Ja</button>
                        <button class="btn-cancel" onclick={() => confirmClearAll = false}>Nej</button>
                    </span>
                {:else}
                    <button
                        class="btn-clear-all"
                        onclick={() => confirmClearAll = true}
                        disabled={list.items.length === 0}
                    >
                        Töm hela listan
                    </button>
                {/if}
            </div>
        {/if}

        <!-- Edit mode: add item form -->
        {#if !shoppingMode}
            <div class="card add-card">
                <input
                    bind:this={itemInputEl}
                    bind:value={newItem}
                    placeholder="Vara"
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <input
                    bind:value={spec}
                    placeholder="Specifikation (valfritt)"
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <div class="category-picker" class:picker-error={categoryError} class:picker-hint={newItem.trim().length > 0 && !selectedCategory && !categoryError}>
                    {#each profileCategories as category}
                        <button
                            class="category-chip"
                            class:selected={selectedCategory === category.name}
                            style="--chip-color: {category.color}"
                            onclick={() => { selectedCategory = category.name; categoryError = false; }}
                        >
                            {category.name}
                        </button>
                    {/each}
                </div>
                {#if categoryError}
                    <p class="field-error" role="alert">Välj en kategori innan du lägger till en vara.</p>
                {/if}
                <button class="btn-add" onclick={addItem}>Lägg till vara</button>
                <button class="btn-import-template" onclick={() => showImportModal = true}>
                    Importera mall
                </button>
            </div>
        {/if}

        {#if showImportModal}
            <ImportModal
                onImport={(items) => shoppingContext.importItems(id, items)}
                onClose={() => showImportModal = false}
                {profileCategories}
                listProfileId={list.profileId}
            />
        {/if}

        <!-- Search -->
        {#if list.items.length > 4}
            <div class="search-row" transition:slide={{ duration: 150 }}>
                <input
                    bind:value={search}
                    placeholder="Sök vara…"
                    class="search-input"
                />
                {#if search}
                    <button class="btn-clear-search" onclick={() => (search = '')}>×</button>
                {/if}
            </div>
        {/if}

        <!-- Items list -->
        <div class="card items-card">
            {#if filteredItems.length === 0 && list.items.length > 0}
                <p class="empty-search">Inga varor matchar "{search}"</p>
            {:else if list.items.length === 0}
                <p class="empty-list">Listan är tom. Lägg till varor ovan.</p>
            {:else}
                {#each sections as section (section.category.id)}
                    <CategorySection
                        category={section.category}
                        categories={profileCategories}
                        items={section.items}
                        {shoppingMode}
                        listId={id}
                        {showAddedBy}
                    />
                {/each}
            {/if}
        </div>

        <!-- Recently bought history (edit mode only) -->
        {#if !shoppingMode && listHistory.length > 0}
            <div class="card history-card">
                <button class="history-toggle" onclick={() => (showHistory = !showHistory)}>
                    <span>Senast inhandlat</span>
                    <span class="history-arrow">{showHistory ? '▼' : '▶'}</span>
                </button>
                {#if showHistory}
                    <div class="history-entries">
                        {#each listHistory as entry}
                            <div class="history-entry">
                                <span class="history-date">{formatDate(entry.clearedAt)}</span>
                                <span class="history-items">
                                    {entry.items.map(i => i.name + (i.quantity > 1 ? ` ×${i.quantity}` : '')).join(', ')}
                                </span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

    </div>
{/if}

<style>
    .page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow-card);
        padding: 1.25rem;
    }

    /* Header */
    .list-header {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .list-header h1 {
        margin: 0;
        flex: 1;
        font-size: 1.5rem;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .header-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-shrink: 0;
    }

    .back {
        text-decoration: none;
        color: var(--text-muted);
        font-size: 0.95em;
        white-space: nowrap;
    }

    .back:hover { color: var(--text-primary); }

    .btn-share {
        font-size: 0.8em;
        color: var(--violet-text);
        background: none;
        border: 1px solid var(--violet-border);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
    }

    .btn-share:hover { background: var(--violet-light); }

    .btn-delete-list {
        font-size: 0.8em;
        color: var(--danger-text);
        background: none;
        border: 1px solid var(--danger-border);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
    }

    .btn-delete-list:hover { background: var(--danger-bg); }

    .btn-added-by {
        font-size: 0.8em;
        color: var(--text-secondary);
        background: none;
        border: 1px solid var(--border-input);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .btn-added-by:hover { background: var(--bg-elevated); border-color: var(--text-muted); }

    .btn-added-by.active {
        color: var(--violet-text);
        border-color: var(--violet-border);
        background: var(--violet-light);
    }

    .btn-shopping-mode {
        font-size: 0.85rem;
        font-weight: 600;
        background: none;
        color: var(--text-secondary);
        border: 1.5px solid var(--border);
        border-radius: 8px;
        padding: 0.28rem 0.75rem;
        cursor: pointer;
        line-height: 1.4;
        white-space: nowrap;
        transition: background 0.15s, border-color 0.15s;
    }

    .btn-shopping-mode:hover { background: var(--bg-elevated); }

    .shared-notice-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .shared-notice {
        font-size: 0.85em;
        color: var(--violet-text);
        background: var(--violet-light);
        border-radius: 8px;
        padding: 0.5rem 0.9rem;
        margin: 0;
    }

    .btn-leave-list {
        font-size: 0.82em;
        padding: 0.35rem 0.75rem;
        background: none;
        border: 1px solid var(--danger-text);
        color: var(--danger-text);
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
    }

    .btn-leave-list:hover {
        background: var(--danger-bg);
    }

    .offline-badge {
        background: var(--warning-bg);
        border: 1px solid var(--warning-border);
        border-radius: 8px;
        color: var(--warning-text);
        font-size: 0.82em;
        padding: 0.45rem 0.9rem;
        text-align: center;
    }

    /* Store selector */
    .store-selector {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.9em;
    }

    .store-label {
        color: var(--text-muted);
        white-space: nowrap;
        flex-shrink: 0;
    }

    .store-chips {
        display: flex;
        gap: 0.4rem;
        overflow-x: auto;
        padding-bottom: 2px;
        scrollbar-width: none;
    }

    .store-chips::-webkit-scrollbar { display: none; }

    .store-chip {
        padding: 0.3rem 0.75rem;
        border-radius: 999px;
        border: 1.5px solid var(--border-input);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: 0.85em;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.12s, border-color 0.12s, color 0.12s;
        min-height: unset;
    }

    .store-chip:hover { border-color: #f97316; color: #f97316; }

    .store-chip.selected {
        background: #f97316;
        border-color: #f97316;
        color: #fff;
        font-weight: 600;
    }

    /* Progress indicator */
    .progress-text {
        margin: 0;
        font-size: 0.82em;
        color: var(--text-muted);
    }

    /* Fäst överst i handelsläget, där appskalet är borttaget. */
    .shopping-topbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 6px;
        background: var(--border);
        z-index: 90;
    }

    .shopping-topbar-fill {
        height: 100%;
        background: linear-gradient(90deg, #f97316, #c026d3);
        transition: width 0.4s ease;
    }

    /* Nås med tummen; hamnar ovanför hemknappsområdet på telefoner. */
    .btn-exit-shopping {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem));
        z-index: 95;
        min-height: 44px;
        padding: 0.6rem 1.5rem;
        border: none;
        border-radius: 999px;
        background: var(--text-primary);
        color: var(--bg-surface);
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.22);
    }

    /* List actions */
    .list-actions {
        display: flex;
        gap: 0.5rem;
    }

    .btn-clear-bought, .btn-clear-all {
        padding: 0.3rem 0.75rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85em;
        border: 1px solid;
        background: var(--bg-surface);
    }

    .btn-clear-bought { color: var(--warning-text); border-color: var(--warning-border); }
    .btn-clear-bought:hover:not(:disabled) { background: var(--warning-bg); }

    .btn-clear-all { color: var(--danger-text); border-color: var(--danger-border); }
    .btn-clear-all:hover:not(:disabled) { background: var(--danger-bg); }

    .btn-clear-bought:disabled, .btn-clear-all:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .confirm-inline {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.82em;
        color: var(--danger-text);
        font-weight: 600;
    }

    .btn-confirm-sm {
        padding: 0.2rem 0.55rem;
        border: none;
        border-radius: 6px;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        min-height: unset;
    }

    .btn-confirm-sm--danger { background: var(--danger-text); color: #fff; }
    .btn-confirm-sm--danger:hover { background: var(--danger-text-hover); }

    /* Add item form */
    .add-card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .add-card input {
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .add-card input:focus { border-color: #f97316; }

    .category-picker {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.4rem;
        overflow-x: auto;
        padding: 3px 2px;
        scrollbar-width: none;
    }

    .category-picker::-webkit-scrollbar { display: none; }

    .category-chip {
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        border: 1.5px solid color-mix(in srgb, var(--chip-color, #e5e7eb) 60%, var(--text-faint));
        background: var(--chip-color, #f3f4f6);
        cursor: pointer;
        font-size: 0.82em;
        font-weight: 500;
        color: #374151;
        opacity: 0.8;
        transition: opacity 0.1s, box-shadow 0.1s;
    }

    .category-chip:hover { opacity: 1; }

    .category-chip.selected {
        opacity: 1;
        box-shadow: 0 0 0 2px var(--text-secondary);
        font-weight: 700;
    }

    .picker-error { outline: 1.5px solid var(--danger-text); border-radius: 6px; padding: 0.25rem; }
    .picker-hint { outline: 1.5px solid #f97316; border-radius: 6px; padding: 0.25rem; }

    .field-error {
        margin: 0;
        font-size: 0.82em;
        color: var(--danger-text);
    }

    .btn-add {
        padding: 0.6rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.95em;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
    }

    .btn-add:hover:not(:disabled) { opacity: 0.9; }
    .btn-add:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-import-template {
        padding: 0.5rem;
        background: none;
        border: 1px dashed var(--border-input);
        border-radius: 8px;
        font-size: 0.88em;
        color: var(--text-muted);
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s, background 0.15s;
    }

    .btn-import-template:hover {
        border-color: #f97316;
        color: #f97316;
        background: var(--bg-elevated);
    }

    /* Search */
    .search-row {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-input {
        width: 100%;
        padding: 0.55rem 2.2rem 0.55rem 0.9rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.9em;
        outline: none;
        background: var(--bg-surface);
        color: var(--text-primary);
        transition: border-color 0.15s;
    }

    .search-input:focus { border-color: #f97316; }

    .btn-clear-search {
        position: absolute;
        right: 0.5rem;
        background: none;
        border: none;
        font-size: 1.1em;
        color: var(--text-faint);
        cursor: pointer;
        min-height: unset;
        padding: 0 0.25rem;
        line-height: 1;
    }

    .btn-clear-search:hover { color: var(--text-secondary); }

    /* Items card */
    .items-card {
        padding: 0;
        overflow: hidden;
        border-radius: 12px;
    }

    .empty-list, .empty-search {
        text-align: center;
        color: var(--text-faint);
        font-size: 0.9em;
        padding: 2rem 1rem;
        margin: 0;
    }

    /* History */
    .history-card {
        padding: 0;
        overflow: hidden;
    }

    .history-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        background: none;
        border: none;
        padding: 0.85rem 1.25rem;
        font-size: 0.9em;
        font-weight: 600;
        color: var(--text-muted);
        cursor: pointer;
        text-align: left;
        min-height: unset;
    }

    .history-toggle:hover { background: var(--bg-hover); color: var(--text-secondary); }

    .history-arrow {
        font-size: 0.65em;
        color: var(--text-faint);
    }

    .history-entries {
        display: flex;
        flex-direction: column;
        gap: 0;
        border-top: 1px solid var(--border-subtle);
    }

    .history-entry {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.75rem 1.25rem;
        border-bottom: 1px solid var(--border-faint);
        font-size: 0.85em;
    }

    .history-entry:last-child { border-bottom: none; }

    .history-date {
        color: var(--text-faint);
        font-size: 0.8em;
    }

    .history-items {
        color: var(--text-secondary);
        line-height: 1.5;
    }

    @media (max-width: 500px) {
        .list-header {
            flex-wrap: wrap;
            gap: 0.4rem;
        }
        .header-actions {
            width: 100%;
            justify-content: flex-end;
        }
    }

    /* Shopping mode overrides */
    .page.shopping-mode {
        /* Plats för den fästa förloppsraden överst och avsluta-knappen nederst. */
        padding: 1rem 0.5rem calc(4.5rem + env(safe-area-inset-bottom));
    }

    /* Hela skärmen tillhör listan här, så knapparna får full träffyta. */
    .page.shopping-mode :global(button) {
        min-height: 44px;
    }

    .page.shopping-mode .list-header h1 {
        font-size: 1.25rem;
    }

    .page.shopping-mode .items-card {
        border-radius: 16px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }

    .page.shopping-mode .store-selector {
        font-size: 1em;
    }
</style>
