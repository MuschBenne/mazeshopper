<script>
    // Renders all items belonging to a single category, with collapse, edit, and shopping-mode support.
    import { shoppingContext } from '$lib/context/shopping-context.svelte';
    import { slide } from 'svelte/transition';
    import { flip } from 'svelte/animate';

    /**
     * @type {{
     *   category: { name: string, color: string },
     *   categories: { id: string, name: string, color: string }[],
     *   items: import('$lib/context/shopping-context.svelte').ShoppingItem[],
     *   shoppingMode: boolean,
     *   listId: string,
     *   showAddedBy?: boolean
     * }}
     */
    let { category, categories, items, shoppingMode, listId, showAddedBy = false } = $props();

    let collapsed = $state(false);

    // Tracks which item (if any) is currently being edited inline.
    /** @type {string | null} */
    let editingItemId = $state(null);
    let editName = $state('');
    let editSpec = $state('');
    let editCategory = $state('');

    // Items are displayed in their original insertion order — no re-sorting on check-off.
    const displayItems = $derived(items);

    // Populates the inline edit form with the item's current values.
    /** @param {import('$lib/context/shopping-context.svelte').ShoppingItem} item */
    function startEdit(item) {
        editingItemId = item.itemId;
        editName = item.name;
        editSpec = item.spec;
        editCategory = item.category;
    }

    async function saveEdit() {
        if (!editingItemId || editName.trim().length === 0) return;
        await shoppingContext.editItem(listId, editingItemId, editName, editSpec, editCategory);
        editingItemId = null;
    }

    function cancelEdit() {
        editingItemId = null;
    }
</script>

<button
    class="category-header"
    onclick={() => (collapsed = !collapsed)}
    aria-expanded={!collapsed}
    aria-controls="category-items-{category.name}"
>
    <span class="category-dot" style:background={category.color}></span>
    <span class="category-arrow">{collapsed ? '▶' : '▼'}</span>
    {category.name}
    <span class="category-count">({items.length})</span>
</button>

{#if !collapsed}
    <ul id="category-items-{category.name}" transition:slide={{ duration: 180 }}>
        {#each displayItems as item (item.itemId)}
            <li class:bought={item.bought} animate:flip={{ duration: 220 }} transition:slide={{ duration: 180 }}>
                {#if editingItemId === item.itemId}
                    <div class="edit-form">
                        <input
                            class="edit-input"
                            bind:value={editName}
                            placeholder="Vara"
                            onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') cancelEdit(); }}
                        />
                        <input
                            class="edit-input"
                            bind:value={editSpec}
                            placeholder="Specifikation (valfritt)"
                            onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') cancelEdit(); }}
                        />
                        {#if categories.length > 0}
                            <div class="category-picker">
                                {#each categories as cat (cat.name)}
                                    <button
                                        type="button"
                                        class="category-chip"
                                        class:selected={editCategory === cat.name}
                                        style="--chip-color: {cat.color}"
                                        onclick={() => editCategory = cat.name}
                                    >{cat.name}</button>
                                {/each}
                            </div>
                        {/if}
                        <div class="edit-actions">
                            <button class="btn-save" onclick={saveEdit}>Spara</button>
                            <button class="btn-cancel" onclick={cancelEdit}>Avbryt</button>
                        </div>
                    </div>
                {:else}
                    <span class="item-name" style:text-decoration={item.bought ? 'line-through' : 'none'}>
                        {item.name}
                        {#if item.spec}<span class="item-spec">{item.spec}</span>{/if}
                        {#if showAddedBy && item.addedBy}<span class="item-added-by">{item.addedBy}</span>{/if}
                    </span>
                    <div class="quantity-controls">
                        {#if !shoppingMode}
                            <button onclick={() => shoppingContext.decreaseQuantity(listId, item.itemId)}>-</button>
                        {/if}
                        <span class="quantity">{item.quantity}</span>
                        {#if !shoppingMode}
                            <button onclick={() => shoppingContext.increaseQuantity(listId, item.itemId)}>+</button>
                        {/if}
                        {#if shoppingMode}
                            <button
                                class="btn-bought"
                                class:bought={item.bought}
                                onclick={() => shoppingContext.toggleBought(listId, item.itemId)}
                            >{item.bought ? '✓' : ''}</button>
                        {/if}
                        {#if !shoppingMode}
                            <button class="btn-edit" aria-label="Redigera {item.name}" onclick={() => startEdit(item)}>✏️</button>
                            <button aria-label="Ta bort {item.name}" onclick={() => shoppingContext.removeItem(listId, item.itemId)}>🗑️</button>
                        {/if}
                    </div>
                {/if}
            </li>
        {/each}
    </ul>
{/if}

<style>
    .category-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        background: none;
        border: none;
        border-bottom: 1px solid var(--border-subtle);
        padding: 0.7rem 1.25rem;
        font-size: 0.95em;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        color: var(--text-secondary);
        min-height: unset;
    }

    .category-header:hover { background: var(--bg-hover); }

    .category-dot {
        width: 13px;
        height: 13px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0,0,0,0.1);
    }

    .category-arrow {
        font-size: 0.65em;
        color: var(--text-faint);
    }

    .category-count {
        font-weight: 400;
        font-size: 0.85em;
        color: var(--text-faint);
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
        border-bottom: 1px solid var(--border-faint);
        font-size: 0.95em;
        flex-wrap: wrap;
    }

    li:last-child { border-bottom: none; }

    .item-name {
        color: var(--text-primary);
        flex: 1;
        min-width: 0;
        word-break: break-word;
    }

    .item-spec {
        display: block;
        font-size: 0.82em;
        color: var(--text-faint);
        font-weight: 400;
        margin-top: 0.1rem;
    }

    .item-added-by {
        display: block;
        font-size: 0.75em;
        color: var(--violet-text);
        font-weight: 400;
        margin-top: 0.1rem;
        opacity: 0.8;
    }

    li.bought .item-name { color: var(--text-faint); }

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
        border: 1px solid var(--border);
        background: var(--bg-surface);
        border-radius: 6px;
        padding: 0.2rem 0.5rem;
        cursor: pointer;
        font-size: 0.9em;
        color: var(--text-secondary);
        min-height: 36px;
        min-width: 36px;
    }

    .quantity-controls button:hover { background: var(--bg-elevated); }

    .btn-bought {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid var(--border-input);
        background: var(--bg-surface);
        cursor: pointer;
        font-size: 1.1em;
        color: var(--success-text);
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.08s, border-color 0.08s;
        flex-shrink: 0;
        min-height: unset;
        min-width: unset;
    }

    .btn-bought:hover { border-color: var(--success-text); background: var(--success-bg); }

    .btn-bought.bought {
        background: var(--success-text);
        border-color: var(--success-text);
        color: #fff;
    }

    .btn-bought.bought:hover { background: var(--success-text); border-color: var(--success-text); }

    .edit-form {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        flex: 1;
        padding: 0.25rem 0;
    }

    .edit-input {
        padding: 0.4rem 0.6rem;
        border: 1px solid var(--border-input);
        border-radius: 6px;
        font-size: 0.9em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .edit-input:focus { border-color: #f97316; }

    .edit-actions {
        display: flex;
        gap: 0.4rem;
    }

    .btn-edit {
        font-size: 0.85em;
        min-height: 36px;
        min-width: 36px;
    }

    .category-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        padding-top: 0.1rem;
    }

    .category-chip {
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        border: 1.5px solid color-mix(in srgb, var(--chip-color, #e5e7eb) 60%, var(--text-faint));
        background: var(--chip-color, #f3f4f6);
        cursor: pointer;
        font-size: 0.8em;
        font-weight: 500;
        color: #374151;
        opacity: 0.75;
        transition: opacity 0.1s, box-shadow 0.1s;
        min-height: unset;
        min-width: unset;
    }

    .category-chip:hover { opacity: 1; }

    .category-chip.selected {
        opacity: 1;
        box-shadow: 0 0 0 2px var(--text-secondary);
        font-weight: 700;
    }

    /* Shopping mode overrides */
    :global(.shopping-mode) .category-header {
        padding: 0.85rem 1.25rem;
        font-size: 1em;
        background: var(--bg-hover);
    }

    :global(.shopping-mode) li {
        padding: 1rem 1.25rem;
        font-size: 1.05em;
        min-height: 56px;
    }

    :global(.shopping-mode) .btn-bought {
        width: 44px;
        height: 44px;
        font-size: 1.3em;
    }

    @media (max-width: 400px) {
        li { padding: 0.65rem 0.75rem; }
    }
</style>
