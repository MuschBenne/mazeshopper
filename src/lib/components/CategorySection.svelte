<script>
    import { shoppingContext } from '$lib/context/shopping-context.svelte';

    /**
     * @type {{
     *   category: { name: string, color: string },
     *   items: import('$lib/context/shopping-context.svelte').ShoppingItem[],
     *   shoppingMode: boolean,
     *   listId: string
     * }}
     */
    let { category, items, shoppingMode, listId } = $props();

    let collapsed = $state(false);

    /** Items sorted so unbought come first in shopping mode */
    const displayItems = $derived.by(() => {
        if (!shoppingMode) return items;
        return [...items].sort((a, b) => {
            if (a.bought === b.bought) return 0;
            return a.bought ? 1 : -1;
        });
    });
</script>

<button class="category-header" onclick={() => (collapsed = !collapsed)}>
    <span class="category-dot" style:background={category.color}></span>
    <span class="category-arrow">{collapsed ? '▶' : '▼'}</span>
    {category.name}
    <span class="category-count">({items.length})</span>
</button>

{#if !collapsed}
    <ul>
        {#each displayItems as item (item.itemId)}
            <li class:bought={item.bought}>
                <span class="item-name" style:text-decoration={item.bought ? 'line-through' : 'none'}>
                    {item.name}{item.spec ? ` – ${item.spec}` : ''}
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
                        <button onclick={() => shoppingContext.removeItem(listId, item.itemId)}>🗑️</button>
                    {/if}
                </div>
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
        border-bottom: 1px solid #f3f4f6;
        padding: 0.7rem 1.25rem;
        font-size: 0.95em;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        color: #374151;
        min-height: unset;
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

    li.bought .item-name { color: #9ca3af; }

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

    .btn-bought {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid #d1d5db;
        background: #fff;
        cursor: pointer;
        font-size: 1.1em;
        color: #16a34a;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, border-color 0.15s;
        flex-shrink: 0;
        min-height: unset;
        min-width: unset;
    }

    .btn-bought:hover { border-color: #16a34a; background: #f0fdf4; }

    .btn-bought.bought {
        background: #16a34a;
        border-color: #16a34a;
        color: #fff;
    }

    /* Shopping mode overrides */
    :global(.shopping-mode) .category-header {
        padding: 0.85rem 1.25rem;
        font-size: 1em;
        background: #fafafa;
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
