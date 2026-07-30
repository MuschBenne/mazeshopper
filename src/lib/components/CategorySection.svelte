<script>
    // Renders all items belonging to a single category, with collapse, edit, and shopping-mode support.
    import { shoppingContext } from '$lib/context/shopping-context.svelte';
    import AmountField from '$lib/components/AmountField.svelte';
    import { formatQuantity, formatStepperAmount, parseQuantityInput } from '$lib/units';
    import { slide } from 'svelte/transition';
    import { flip } from 'svelte/animate';

    /**
     * @type {{
     *   category: { id: string, name: string, color: string },
     *   categories: { id: string, name: string, color: string }[],
     *   items: import('$lib/context/shopping-context.svelte').ShoppingItem[],
     *   shoppingMode: boolean,
     *   listId: string,
     *   showAddedBy?: boolean
     * }}
     */
    let { category, categories, items, shoppingMode, listId, showAddedBy = false } = $props();

    // Spec-förslagen ligger i en <datalist> som listsidan renderar en gång —
    // en egen kopia per vara vore samma lista om och om igen.
    const SPEC_DATALIST = 'spec-suggestions';

    let collapsed = $state(false);

    // Tracks which item (if any) is currently being edited inline.
    /** @type {string | null} */
    let editingItemId = $state(null);
    let editName = $state('');
    let editSpec = $state('');
    let editCategory = $state('');
    let editAmount = $state('');
    let editUnit = $state('');

    // Items are displayed in their original insertion order — no re-sorting on check-off.
    const displayItems = $derived(items);

    // Populates the inline edit form with the item's current values.
    /** @param {import('$lib/context/shopping-context.svelte').ShoppingItem} item */
    function startEdit(item) {
        editingItemId = item.itemId;
        editName = item.name;
        editSpec = item.spec;
        editCategory = item.category;
        // Enheten måste gå att rätta här. Annars vore ett feltryck på "kg"
        // permanent — varan skulle behöva tas bort och skrivas in på nytt.
        editAmount = item.quantity == null ? '' : formatQuantity(item.quantity);
        editUnit = item.unit ?? '';
    }

    async function saveEdit() {
        if (!editingItemId || editName.trim().length === 0) return;
        await shoppingContext.editItem(listId, editingItemId, editName, editSpec, editCategory, {
            quantity: parseQuantityInput(editAmount),
            unit: editUnit
        });
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
    aria-controls="category-items-{category.id}"
>
    <span class="category-dot" style:background={category.color}></span>
    <span class="category-arrow">{collapsed ? '▶' : '▼'}</span>
    {category.name}
    <span class="category-count">({items.length})</span>
</button>

{#if !collapsed}
    <ul id="category-items-{category.id}" transition:slide={{ duration: 180 }}>
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
                        <AmountField bind:amount={editAmount} bind:unit={editUnit} onEnter={saveEdit} />
                        <input
                            class="edit-input"
                            bind:value={editSpec}
                            placeholder="Specifikation (valfritt)"
                            list={SPEC_DATALIST}
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
                            <button
                                aria-label="Minska mängden för {item.name}"
                                onclick={() => shoppingContext.decreaseQuantity(listId, item.itemId)}
                            >-</button>
                        {/if}
                        <!-- Tomt när ingen mängd är angiven: "salt" behöver inte
                             stå som "1 salt" för att vara en fullgod rad. Rent
                             tal, ingen ×-form: knapparna omkring säger redan
                             vad talet är, och varor från tiden före enheter ska
                             se ut som de alltid gjort. -->
                        <span class="quantity">{formatStepperAmount(item.quantity, item.unit)}</span>
                        {#if !shoppingMode}
                            <button
                                aria-label="Öka mängden för {item.name}"
                                onclick={() => shoppingContext.increaseQuantity(listId, item.itemId)}
                            >+</button>
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
        /* Rymmer "3,5 dl" utan att knapparna flyttar sig när mängden ändras. */
        min-width: 3.2rem;
        text-align: center;
        font-size: 0.9em;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .quantity-controls button {
        border: 1px solid var(--border);
        background: var(--bg-surface);
        border-radius: var(--radius-sm);
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
        border-radius: var(--radius-sm);
        font-size: 0.9em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .edit-input:focus { border-color: var(--color-primary); }

    .edit-actions {
        display: flex;
        gap: 0.4rem;
    }

    .btn-edit {
        font-size: 0.85em;
        min-height: 36px;
        min-width: 36px;
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
