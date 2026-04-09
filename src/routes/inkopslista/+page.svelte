<script>
    import { shoppingContext } from "$lib/context/shopping-context.svelte";
    import { settingContext } from "$lib/context/setting-context.svelte";
    import { storeContext } from "$lib/context/store-context.svelte";

    let newItem = $state('');
    let spec = $state('');
    let selectedCategory = $state('');

    function addItem() {
        if (selectedCategory === '') {
            alert('Välj en kategori innan du lägger till en vara.');
            return;
        }
        if (newItem.trim().length === 0) return;
        shoppingContext.addItem(newItem, spec, selectedCategory);
        newItem = '';
        spec = '';
    }

    /**
     * Returns categories sorted by the selected store's priority order.
     * Categories without a priority keep their original relative order, placed after prioritized ones.
     */
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
</script>

<h1>Inköpslista</h1>

<div class="shopping-list">
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
    <select bind:value={selectedCategory} onkeydown={(e) => e.key === 'Enter' && addItem()}>
        <option value="">Välj kategori</option>
        {#each settingContext.categories as category}
            <option value={category.name}>{category.name}</option>
        {/each}
    </select>
    <button onclick={addItem}>Lägg till vara</button>

    <div class="list-actions">
        <button
            class="btn-clear-bought"
            onclick={() => shoppingContext.clearBought()}
            disabled={!shoppingContext.items.some(i => i.bought)}
        >
            Rensa köpta varor
        </button>
        <button
            class="btn-clear-all"
            onclick={() => {
                if (confirm('Är du säker? Hela listan raderas.')) {
                    shoppingContext.clearAll();
                }
            }}
            disabled={shoppingContext.items.length === 0}
        >
            Töm hela listan
        </button>
    </div>

    {#each sortedCategories as category}
        {@const categoryItems = shoppingContext.items.filter(item => item.category === category.name)}

        {#if categoryItems.length > 0}
            {@const collapsed = collapsedCategories.has(category.name)}
            <button class="category-header" onclick={() => toggleCategory(category.name)}>
                <span class="category-arrow" class:collapsed>{collapsed ? '▶' : '▼'}</span>
                {category.name}
                <span class="category-count">({categoryItems.length})</span>
            </button>
            {#if !collapsed}
                <ul>
                    {#each categoryItems as item}
                        {@const index = shoppingContext.items.findIndex(i => i === item)}
                        <li>
                            <span class="item-name" style:text-decoration={item.bought ? 'line-through' : 'none'}>
                                {item.name}{item.spec ? ` – ${item.spec}` : ''}
                            </span>
                            <div class="quantity-controls">
                                <button onclick={() => shoppingContext.decreaseQuantity(index)}>-</button>
                                <span class="quantity">{item.quantity}</span>
                                <button onclick={() => shoppingContext.increaseQuantity(index)}>+</button>
                                <button onclick={() => shoppingContext.toggleBought(index)}>{item.bought ? '⭕' : '🛒'}</button>
                                <button onclick={() => shoppingContext.removeItem(index)}>🗑️</button>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        {/if}
    {/each}
</div>

<style>
    .store-selector {
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .list-actions {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0;
    }

    .btn-clear-bought, .btn-clear-all {
        padding: 0.3rem 0.75rem;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.9em;
        border: 1px solid;
    }

    .btn-clear-bought {
        background: #fff;
        color: #d97706;
        border-color: #fcd34d;
    }

    .btn-clear-bought:hover:not(:disabled) {
        background: #fffbeb;
    }

    .btn-clear-all {
        background: #fff;
        color: #dc2626;
        border-color: #fca5a5;
    }

    .btn-clear-all:hover:not(:disabled) {
        background: #fef2f2;
    }

    .btn-clear-bought:disabled, .btn-clear-all:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .category-header {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
        background: none;
        border: none;
        border-bottom: 1px solid #e5e7eb;
        padding: 0.5rem 0;
        margin-top: 1rem;
        font-size: 1.1em;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        color: inherit;
    }

    .category-header:hover {
        color: #555;
    }

    .category-arrow {
        font-size: 0.75em;
        transition: transform 0.15s;
    }

    .category-count {
        font-weight: 400;
        font-size: 0.85em;
        color: #888;
        margin-left: auto;
    }
</style>
