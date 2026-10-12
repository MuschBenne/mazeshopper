<script>
    // Renders all items belonging to a single category, with collapse, edit, and shopping-mode support.
    import { shoppingContext } from '$lib/context/shopping-context.svelte';
    import AmountField from '$lib/components/AmountField.svelte';
    import ItemRow from '$lib/components/ui/ItemRow.svelte';
    import AisleMarker from '$lib/components/ui/AisleMarker.svelte';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import Minus from '@lucide/svelte/icons/minus';
    import Plus from '@lucide/svelte/icons/plus';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import { formatAmount, formatQuantity, formatStepperAmount, parseQuantityInput } from '$lib/units';
    import { slide } from 'svelte/transition';
    import { flip } from 'svelte/animate';

    /**
     * @type {{
     *   category: { id: string, name: string, color: string },
     *   categories: { id: string, name: string, color: string }[],
     *   items: import('$lib/context/shopping-context.svelte').ShoppingItem[],
     *   shoppingMode: boolean,
     *   listId: string,
     *   showAddedBy?: boolean,
     *   stop?: number | null,
     *   upcoming?: boolean
     * }}
     */
    // stop är avdelningens plats i det valda varuhusets rutt, null utan rutt.
    // upcoming ritar stoppnumret som kontur: ett stopp man inte nått än.
    let { category, categories, items, shoppingMode, listId, showAddedBy = false, stop = null, upcoming = false } = $props();

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
    const boughtCount = $derived(items.filter(i => i.bought).length);

    // Mängden under namnet i handelsläget. En ensam etta skrivs inte ut — den
    // säger inget som namnet inte redan säger (samma regel som historiken).
    /** @param {import('$lib/context/shopping-context.svelte').ShoppingItem} item */
    function shoppingAmount(item) {
        const amount = formatAmount(item.quantity, item.unit);
        return amount === '1' ? '' : amount;
    }

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
    {#if stop !== null}
        <AisleMarker value={stop} variant={upcoming ? 'outline' : 'solid'} />
        <span class="sr-only">Stopp {stop}:</span>
    {:else}
        <span class="category-dot" style:background={category.color}></span>
    {/if}
    <span class="category-name section-label">{category.name}</span>
    <span class="category-count mono" aria-label="{boughtCount} av {items.length} i korgen">{boughtCount}/{items.length}</span>
    <span class="category-chevron" class:collapsed><ChevronDown size={18} aria-hidden="true" /></span>
</button>

{#if !collapsed}
    <ul id="category-items-{category.id}" transition:slide={{ duration: 180 }}>
        {#each displayItems as item (item.itemId)}
            <li animate:flip={{ duration: 220 }} transition:slide={{ duration: 180 }}>
                {#if editingItemId === item.itemId}
                    <div class="edit-form">
                        <input
                            class="edit-input"
                            bind:value={editName}
                            placeholder="Vara"
                            aria-label="Varunamn"
                            onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') cancelEdit(); }}
                        />
                        <AmountField bind:amount={editAmount} bind:unit={editUnit} onEnter={saveEdit} />
                        <input
                            class="edit-input"
                            bind:value={editSpec}
                            placeholder="Specifikation (valfritt)"
                            aria-label="Specifikation"
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
                {:else if shoppingMode}
                    <ItemRow
                        name={item.name}
                        checked={item.bought}
                        onToggle={() => shoppingContext.toggleBought(listId, item.itemId)}
                        amount={shoppingAmount(item)}
                        large
                    >
                        {#snippet meta()}
                            {#if item.spec}<span>{item.spec}</span>{/if}
                            {#if showAddedBy && item.addedBy}<span>av {item.addedBy}</span>{/if}
                        {/snippet}
                    </ItemRow>
                {:else}
                    <ItemRow name={item.name} checked={item.bought}>
                        {#snippet meta()}
                            {#if item.spec}<span>{item.spec}</span>{/if}
                            {#if showAddedBy && item.addedBy}<span>av {item.addedBy}</span>{/if}
                        {/snippet}
                        {#snippet trailing()}
                            <button
                                class="icon-btn"
                                aria-label="Minska mängden för {item.name}"
                                onclick={() => shoppingContext.decreaseQuantity(listId, item.itemId)}
                            ><Minus size={16} aria-hidden="true" /></button>
                            <!-- Tomt när ingen mängd är angiven: "salt" behöver inte
                                 stå som "1 salt" för att vara en fullgod rad. Rent
                                 tal, ingen ×-form: knapparna omkring säger redan
                                 vad talet är, och varor från tiden före enheter ska
                                 se ut som de alltid gjort. -->
                            <span class="quantity mono">{formatStepperAmount(item.quantity, item.unit)}</span>
                            <button
                                class="icon-btn"
                                aria-label="Öka mängden för {item.name}"
                                onclick={() => shoppingContext.increaseQuantity(listId, item.itemId)}
                            ><Plus size={16} aria-hidden="true" /></button>
                            <button class="icon-btn" aria-label="Redigera {item.name}" onclick={() => startEdit(item)}>
                                <Pencil size={16} aria-hidden="true" />
                            </button>
                            <button class="icon-btn" aria-label="Ta bort {item.name}" onclick={() => shoppingContext.removeItem(listId, item.itemId)}>
                                <Trash2 size={16} aria-hidden="true" />
                            </button>
                        {/snippet}
                    </ItemRow>
                {/if}
            </li>
        {/each}
    </ul>
{/if}

<style>
    /* Sektionshuvud: stoppnummer, avdelningens namn som en hyllskylt och hur
       mycket som redan ligger i korgen. */
    .category-header {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        width: 100%;
        background: none;
        border: none;
        border-bottom: 1px solid var(--color-ink);
        padding: 1.5rem 0 0.6rem;
        cursor: pointer;
        text-align: left;
        color: var(--color-ink);
        min-height: 44px;
    }

    .category-dot {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12);
    }

    .category-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .category-count {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-muted);
    }

    .category-chevron {
        display: flex;
        color: var(--color-muted);
        transition: transform var(--dur-base) var(--ease-out);
    }

    .category-chevron.collapsed { transform: rotate(-90deg); }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    li:last-child :global(.item-row) { border-bottom: none; }

    .quantity {
        /* Rymmer "3,5 dl" utan att knapparna flyttar sig när mängden ändras. */
        min-width: 3.2rem;
        text-align: center;
        font-size: 14px;
        white-space: nowrap;
        color: var(--color-ink);
    }

    .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        min-height: 36px;
        padding: 0;
        border: 1px solid var(--color-line);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-ink);
        cursor: pointer;
    }

    .icon-btn:hover { background: var(--bg-elevated); border-color: var(--color-border); }

    .edit-form {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--color-line);
    }

    .edit-input {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 16px;
        outline: none;
        transition: border-color 0.15s;
        background: var(--color-surface);
        color: var(--color-ink);
    }

    .edit-input:focus { border-color: var(--color-green); }

    .edit-actions {
        display: flex;
        gap: 0.4rem;
    }

    @media (max-width: 400px) {
        .icon-btn { width: 32px; }
        .quantity { min-width: 2.6rem; }
    }
</style>
