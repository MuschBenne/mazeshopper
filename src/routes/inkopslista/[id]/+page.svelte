<script>
    // Detail page for a single shopping list.
    // Supports two modes: edit mode (add/remove/edit items) and shopping mode (check off items).
    import { shoppingContext } from "$lib/context/shopping-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { settingContext } from "$lib/context/setting-context.svelte";
    import { storeContext } from "$lib/context/store-context.svelte";
    import SharePanel from "$lib/components/SharePanel.svelte";
    import CategorySection from "$lib/components/CategorySection.svelte";
    import ImportModal from "$lib/components/ImportModal.svelte";
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';

    const id = $derived(page.params.id ?? '');
    const list = $derived(shoppingContext.getList(id));
    const username = $derived(authContext.user?.username ?? '');
    // Only the owner can delete the list or share it with others.
    const isOwner = $derived(list?.owner === username);

    let newItem = $state('');
    let spec = $state('');
    let selectedCategory = $state('');
    let adding = $state(false);
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

    // Persist the last-used category per list in sessionStorage so it's
    // pre-selected when the user navigates back to the same list.
    $effect(() => {
        if (!browser) return;
        const saved = sessionStorage.getItem(`lastCategory_${id}`);
        if (saved) selectedCategory = saved;
        else selectedCategory = '';
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

    const sortedCategories = $derived.by(() => {
        const store = storeContext.selectedStore;
        // If a store with a saved layout is selected, sort categories by aisle order.
        const base = (!store || Object.keys(store.categoryOrder).length === 0)
            ? settingContext.categories
            : [...settingContext.categories].sort((a, b) => {
                const pa = store.categoryOrder[a.name] ?? Infinity;
                const pb = store.categoryOrder[b.name] ?? Infinity;
                return pa - pb;
            });

        if (!list) return base;
        // A shared list may contain items with categories the current user hasn't defined.
        // Append any unknown categories so those items are still visible.
        const knownNames = new Set(base.map(c => c.name));
        const extraNames = [...new Set(list.items.map(i => i.category))].filter(n => n && !knownNames.has(n));
        if (extraNames.length === 0) return base;
        const extras = extraNames.map(name => ({ name, color: '#e2e8f0' }));
        return [...base, ...extras];
    });

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

    const listHistory = $derived(shoppingContext.recentlyBought[id] ?? []);

    async function addItem() {
        if (selectedCategory === '') {
            categoryError = true;
            return;
        }
        categoryError = false;
        if (newItem.trim().length === 0) return;
        adding = true;
        const ok = await shoppingContext.addItem(id, newItem, spec, selectedCategory);
        adding = false;
        if (ok) {
            newItem = '';
            spec = '';
        }
    }

    async function deleteList() {
        await shoppingContext.deleteList(id);
        goto('/inkopslista');
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
                <button
                    class="btn-shopping-mode"
                    class:active={shoppingMode}
                    onclick={() => { shoppingMode = !shoppingMode; showSharePanel = false; }}
                    title={shoppingMode ? 'Avsluta handelsläge' : 'Handelsläge'}
                >
                    {shoppingMode ? '✕' : '🛒'}
                </button>
            </div>
        </div>

        {#if !isOwner && !shoppingMode}
            <p class="shared-notice">Delad lista av <strong>{list.owner}</strong></p>
        {/if}

        <!-- Share panel -->
        {#if showSharePanel && isOwner && !shoppingMode}
            <SharePanel {list} listId={id} {username} onClose={() => (showSharePanel = false)} />
        {/if}

        <!-- Offline indicator: shown after 2+ consecutive poll failures in shopping mode -->
        {#if sseHasConnected && !sseConnected}
            <div class="offline-badge" role="alert">Ingen anslutning – listan uppdateras inte</div>
        {/if}

        <!-- Shopping mode: store selector + actions -->
        {#if shoppingMode}
            <div class="store-selector">
                <label for="store-select">Varuhus:</label>
                <select
                    id="store-select"
                    value={storeContext.selectedStoreIndex ?? ''}
                    onchange={(e) => {
                        const val = /** @type {HTMLSelectElement} */ (e.target).value;
                        storeContext.selectStore(val === '' ? null : parseInt(val));
                    }}
                >
                    <option value="">Inget varuhus valt</option>
                    {#each storeContext.stores as store, i}
                        <option value={i}>{store.name}</option>
                    {/each}
                </select>
            </div>
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
                    bind:value={newItem}
                    placeholder="Vara"
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <input
                    bind:value={spec}
                    placeholder="Specifikation (valfritt)"
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <div class="category-picker" class:picker-error={categoryError}>
                    {#each settingContext.categories as category}
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
                <button class="btn-add" onclick={addItem} disabled={adding}>
                    {adding ? 'Lägger till…' : 'Lägg till vara'}
                </button>
                <button class="btn-import-template" onclick={() => showImportModal = true}>
                    Importera mall
                </button>
            </div>
        {/if}

        {#if showImportModal}
            <ImportModal
                onImport={(items) => shoppingContext.importItems(id, items)}
                onClose={() => showImportModal = false}
            />
        {/if}

        <!-- Search -->
        {#if list.items.length > 4}
            <div class="search-row">
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
                {#each sortedCategories as category}
                    {@const categoryItems = filteredItems.filter(i => i.category === category.name)}
                    {#if categoryItems.length > 0}
                        <CategorySection {category} items={categoryItems} {shoppingMode} listId={id} />
                    {/if}
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
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
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
        color: #6b7280;
        font-size: 0.95em;
        white-space: nowrap;
    }

    .back:hover { color: #111; }

    .btn-share {
        font-size: 0.8em;
        color: #7c3aed;
        background: none;
        border: 1px solid #c4b5fd;
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
    }

    .btn-share:hover { background: #f5f3ff; }

    .btn-delete-list {
        font-size: 0.8em;
        color: #dc2626;
        background: none;
        border: 1px solid #fca5a5;
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
    }

    .btn-delete-list:hover { background: #fef2f2; }

    .btn-shopping-mode {
        font-size: 1rem;
        background: none;
        border: 1.5px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.25rem 0.55rem;
        cursor: pointer;
        line-height: 1.4;
        transition: background 0.15s, border-color 0.15s;
    }

    .btn-shopping-mode:hover { background: #f3f4f6; }

    .btn-shopping-mode.active {
        background: #111827;
        border-color: #111827;
        color: #fff;
        font-weight: 700;
        font-size: 0.85rem;
    }

    .shared-notice {
        font-size: 0.85em;
        color: #7c3aed;
        background: #f5f3ff;
        border-radius: 8px;
        padding: 0.5rem 0.9rem;
        margin: 0;
    }

    .offline-badge {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 8px;
        color: #92400e;
        font-size: 0.82em;
        padding: 0.45rem 0.9rem;
        text-align: center;
    }

    /* Store selector */
    .store-selector {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9em;
        color: #6b7280;
    }

    .store-selector select {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 0.3rem 0.5rem;
        font-size: 0.9em;
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
        background: #fff;
    }

    .btn-clear-bought { color: #d97706; border-color: #fcd34d; }
    .btn-clear-bought:hover:not(:disabled) { background: #fffbeb; }

    .btn-clear-all { color: #dc2626; border-color: #fca5a5; }
    .btn-clear-all:hover:not(:disabled) { background: #fef2f2; }

    .btn-clear-bought:disabled, .btn-clear-all:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .confirm-inline {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.82em;
        color: #dc2626;
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

    .btn-confirm-sm--danger { background: #dc2626; color: #fff; }
    .btn-confirm-sm--danger:hover { background: #b91c1c; }

    /* Add item form */
    .add-card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .add-card input {
        padding: 0.6rem 0.8rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
    }

    .add-card input:focus { border-color: #f97316; }

    .category-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .category-chip {
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        border: 1.5px solid color-mix(in srgb, var(--chip-color, #e5e7eb) 60%, #9ca3af);
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
        box-shadow: 0 0 0 2px #374151;
        font-weight: 700;
    }

    .picker-error { outline: 1.5px solid #dc2626; border-radius: 6px; padding: 0.25rem; }

    .field-error {
        margin: 0;
        font-size: 0.82em;
        color: #dc2626;
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
        border: 1px dashed #d1d5db;
        border-radius: 8px;
        font-size: 0.88em;
        color: #6b7280;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s, background 0.15s;
    }

    .btn-import-template:hover {
        border-color: #f97316;
        color: #f97316;
        background: #fff7ed;
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
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.9em;
        outline: none;
        background: #fff;
        transition: border-color 0.15s;
    }

    .search-input:focus { border-color: #f97316; }

    .btn-clear-search {
        position: absolute;
        right: 0.5rem;
        background: none;
        border: none;
        font-size: 1.1em;
        color: #9ca3af;
        cursor: pointer;
        min-height: unset;
        padding: 0 0.25rem;
        line-height: 1;
    }

    .btn-clear-search:hover { color: #374151; }

    /* Items card */
    .items-card {
        padding: 0;
        overflow: hidden;
    }

    .empty-list, .empty-search {
        text-align: center;
        color: #9ca3af;
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
        color: #6b7280;
        cursor: pointer;
        text-align: left;
        min-height: unset;
    }

    .history-toggle:hover { background: #fafafa; color: #374151; }

    .history-arrow {
        font-size: 0.65em;
        color: #9ca3af;
    }

    .history-entries {
        display: flex;
        flex-direction: column;
        gap: 0;
        border-top: 1px solid #f3f4f6;
    }

    .history-entry {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.75rem 1.25rem;
        border-bottom: 1px solid #f9fafb;
        font-size: 0.85em;
    }

    .history-entry:last-child { border-bottom: none; }

    .history-date {
        color: #9ca3af;
        font-size: 0.8em;
    }

    .history-items {
        color: #374151;
        line-height: 1.5;
    }

    /* Shopping mode overrides */
    .page.shopping-mode {
        padding: 0.75rem 0.5rem;
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
        color: #374151;
    }

    .page.shopping-mode .store-selector select {
        font-size: 1em;
        padding: 0.45rem 0.75rem;
    }
</style>
