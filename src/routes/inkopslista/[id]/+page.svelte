<script>
    import { shoppingContext } from "$lib/context/shopping-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { settingContext } from "$lib/context/setting-context.svelte";
    import { storeContext } from "$lib/context/store-context.svelte";
    import { page } from '$app/state';
    import { goto } from '$app/navigation';

    const id = $derived(page.params.id);
    const list = $derived(shoppingContext.getList(id));
    const username = $derived(authContext.user?.username ?? '');
    const isOwner = $derived(list?.owner === username);

    let newItem = $state('');
    let spec = $state('');
    let selectedCategory = $state('');

    // Share panel state
    let showSharePanel = $state(false);
    let shareInput = $state('');
    let shareError = $state('');
    let shareSuccess = $state('');

    async function addItem() {
        if (selectedCategory === '') {
            alert('Välj en kategori innan du lägger till en vara.');
            return;
        }
        if (newItem.trim().length === 0) return;
        await shoppingContext.addItem(id, newItem, spec, selectedCategory);
        newItem = '';
        spec = '';
    }

    const sortedCategories = $derived.by(() => {
        const store = storeContext.selectedStore;
        if (!store || Object.keys(store.categoryOrder).length === 0) {
            return settingContext.categories;
        }
        const order = store.categoryOrder;
        return [...settingContext.categories].sort((a, b) => {
            const pa = order[a.name] ?? Infinity;
            const pb = order[b.name] ?? Infinity;
            return pa - pb;
        });
    });

    /** @type {Set<string>} */
    let collapsedCategories = $state(new Set());

    /** @param {string} name */
    function toggleCategory(name) {
        const next = new Set(collapsedCategories);
        if (next.has(name)) {
            next.delete(name);
        } else {
            next.add(name);
        }
        collapsedCategories = next;
    }

    async function deleteList() {
        if (confirm(`Är du säker? Listan "${list?.name}" raderas permanent.`)) {
            await shoppingContext.deleteList(id);
            goto('/inkopslista');
        }
    }

    async function shareList() {
        shareError = '';
        shareSuccess = '';
        const target = shareInput.trim();
        if (!target) return;
        if (target.toLowerCase() === username.toLowerCase()) {
            shareError = 'Du kan inte dela med dig själv.';
            return;
        }
        const result = await shoppingContext.shareList(id, target);
        if (result === 'already_shared') {
            shareError = `Listan delas redan med ${target}.`;
        } else if (result === 'already_invited') {
            shareError = `${target} har redan fått en inbjudan.`;
        } else if (result === 'user_not_found') {
            shareError = `Användaren "${target}" finns inte.`;
        } else {
            shareSuccess = `Inbjudan skickad till ${target}.`;
            shareInput = '';
        }
    }
</script>

{#if !list}
    <div class="page">
        <p>Listan hittades inte. <a href="/inkopslista">Tillbaka</a></p>
    </div>
{:else}
    <div class="page">
    <div class="list-header">
        <a class="back" href="/inkopslista">← Listor</a>
        <h1>{list.name}</h1>
        <div class="header-actions">
            {#if isOwner}
                <button class="btn-share" onclick={() => { showSharePanel = !showSharePanel; shareError = ''; shareSuccess = ''; }}>
                    Dela
                </button>
            {/if}
            {#if isOwner}
                <button class="btn-delete-list" onclick={deleteList}>Ta bort</button>
            {/if}
        </div>
    </div>

    {#if !isOwner}
        <p class="shared-notice">Delad lista av <strong>{list.owner}</strong></p>
    {/if}

    {#if showSharePanel && isOwner}
        <div class="card share-panel">
            <h2>Dela lista</h2>

            {#if list.sharedWith.length > 0}
                <div class="collaborators">
                    <span class="collab-label">Har åtkomst:</span>
                    {#each list.sharedWith as collaborator}
                        <span class="collab-chip">
                            {collaborator}
                            <button
                                class="collab-remove"
                                onclick={() => shoppingContext.unshareList(id, collaborator)}
                                title="Ta bort åtkomst"
                            >×</button>
                        </span>
                    {/each}
                </div>
            {/if}

            {#if (list.pendingInvites ?? []).length > 0}
                <div class="collaborators">
                    <span class="collab-label pending-label">Väntar på svar:</span>
                    {#each (list.pendingInvites ?? []) as pending}
                        <span class="collab-chip pending-chip">
                            {pending}
                            <button
                                class="collab-remove"
                                onclick={() => shoppingContext.unshareList(id, pending)}
                                title="Återkalla inbjudan"
                            >×</button>
                        </span>
                    {/each}
                </div>
            {/if}

            {#if list.sharedWith.length === 0 && (list.pendingInvites ?? []).length === 0}
                <p class="no-collabs">Listan delas inte med någon ännu.</p>
            {/if}

            <div class="share-input-row">
                <input
                    bind:value={shareInput}
                    placeholder="Användarnamn"
                    onkeydown={(e) => e.key === 'Enter' && shareList()}
                />
                <button class="btn-add-share" onclick={shareList}>Bjud in</button>
            </div>
            {#if shareError}<p class="share-msg error">{shareError}</p>{/if}
            {#if shareSuccess}<p class="share-msg success">{shareSuccess}</p>{/if}
        </div>
    {/if}

    <div class="card add-card">
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

        <div class="category-picker">
            {#each settingContext.categories as category}
                <button
                    class="category-chip"
                    class:selected={selectedCategory === category.name}
                    style="--chip-color: {category.color}"
                    onclick={() => selectedCategory = category.name}
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                >
                    {category.name}
                </button>
            {/each}
        </div>

        <button class="btn-add" onclick={addItem}>Lägg till vara</button>
    </div>

    <div class="list-actions">
            <button
                class="btn-clear-bought"
                onclick={() => shoppingContext.clearBought(id)}
                disabled={!list.items.some(i => i.bought)}
            >
                Rensa köpta varor
            </button>
            <button
                class="btn-clear-all"
                onclick={() => {
                    if (confirm('Är du säker? Hela listan raderas.')) {
                        shoppingContext.clearAll(id);
                    }
                }}
                disabled={list.items.length === 0}
            >
                Töm hela listan
            </button>
        </div>

    <div class="card items-card">
        {#each sortedCategories as category}
            {@const categoryItems = list.items.filter(item => item.category === category.name)}

            {#if categoryItems.length > 0}
                {@const collapsed = collapsedCategories.has(category.name)}
                <button class="category-header" onclick={() => toggleCategory(category.name)}>
                    <span class="category-dot" style:background={category.color}></span>
                    <span class="category-arrow">{collapsed ? '▶' : '▼'}</span>
                    {category.name}
                    <span class="category-count">({categoryItems.length})</span>
                </button>
                {#if !collapsed}
                    <ul>
                        {#each categoryItems as item}
                            {@const index = list.items.findIndex(i => i === item)}
                            <li>
                                <span class="item-name" style:text-decoration={item.bought ? 'line-through' : 'none'}>
                                    {item.name}{item.spec ? ` – ${item.spec}` : ''}
                                </span>
                                <div class="quantity-controls">
                                    <button onclick={() => shoppingContext.decreaseQuantity(id, index)}>-</button>
                                    <span class="quantity">{item.quantity}</span>
                                    <button onclick={() => shoppingContext.increaseQuantity(id, index)}>+</button>
                                    <button onclick={() => shoppingContext.toggleBought(id, index)}>{item.bought ? '⭕' : '🛒'}</button>
                                    <button onclick={() => shoppingContext.removeItem(id, index)}>🗑️</button>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {/if}
            {/if}
        {/each}
    </div>
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

    .btn-add:hover { opacity: 0.9; }

    .list-header {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .list-header h1 {
        margin: 0;
        flex: 1;
        font-size: 1.5rem;
    }

    .header-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
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

    .shared-notice {
        font-size: 0.85em;
        color: #7c3aed;
        background: #f5f3ff;
        border-radius: 8px;
        padding: 0.5rem 0.9rem;
        margin: 0;
    }

    /* Share panel */
    .share-panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .share-panel h2 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
        font-weight: 600;
    }

    .collaborators {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
    }

    .collab-label {
        font-size: 0.85em;
        color: #6b7280;
    }

    .collab-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        background: #ede9fe;
        color: #5b21b6;
        border-radius: 999px;
        padding: 0.2rem 0.6rem;
        font-size: 0.82em;
        font-weight: 500;
    }

    .collab-remove {
        background: none;
        border: none;
        cursor: pointer;
        color: #7c3aed;
        font-size: 1em;
        line-height: 1;
        padding: 0 0.1rem;
    }

    .collab-remove:hover { color: #dc2626; }

    .no-collabs {
        font-size: 0.85em;
        color: #9ca3af;
        margin: 0;
    }

    .pending-label {
        color: #d97706;
    }

    .pending-chip {
        background: #fef3c7;
        color: #92400e;
        font-style: italic;
    }

    .share-input-row {
        display: flex;
        gap: 0.5rem;
    }

    .share-input-row input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.9em;
        outline: none;
    }

    .share-input-row input:focus { border-color: #a78bfa; }

    .btn-add-share {
        padding: 0.5rem 1rem;
        background: #7c3aed;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-add-share:hover { background: #6d28d9; }

    .share-msg {
        font-size: 0.85em;
        margin: 0;
        padding: 0.4rem 0.7rem;
        border-radius: 6px;
    }

    .share-msg.error { color: #dc2626; background: #fef2f2; }
    .share-msg.success { color: #16a34a; background: #f0fdf4; }

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

    .items-card {
        padding: 0;
        overflow: hidden;
    }

    .category-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        background: none;
        border: none;
        border-bottom: 1px solid #f3f4f6;
        padding: 0.7rem 1.25rem;
        font-size: 0.95em;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        color: #374151;
    }

    .category-header:hover { background: #fafafa; }

    .category-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0,0,0,0.1);
    }

    .category-arrow {
        font-size: 0.65em;
        color: #9ca3af;
    }

    .category-count {
        font-weight: 400;
        font-size: 0.85em;
        color: #9ca3af;
        margin-left: auto;
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.65rem 1.25rem;
        border-bottom: 1px solid #f9fafb;
        font-size: 0.95em;
        flex-wrap: wrap;
    }

    li:last-child { border-bottom: none; }

    .item-name {
        color: #111827;
        flex: 1;
        min-width: 0;
        word-break: break-word;
    }

    .quantity-controls {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 0;
    }

    .quantity {
        min-width: 1.4rem;
        text-align: center;
        font-size: 0.9em;
    }

    .quantity-controls button {
        border: 1px solid #e5e7eb;
        background: #fff;
        border-radius: 6px;
        padding: 0.2rem 0.5rem;
        cursor: pointer;
        font-size: 0.9em;
        color: #374151;
        min-height: 36px;
        min-width: 36px;
    }

    .quantity-controls button:hover { background: #f9fafb; }

    @media (max-width: 400px) {
        li { padding: 0.65rem 0.75rem; }
    }
</style>
