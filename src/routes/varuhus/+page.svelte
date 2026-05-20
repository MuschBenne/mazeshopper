<svelte:head><title>Varuhus – MazeShopper</title></svelte:head>

<script>
    // Page for managing grocery stores and their category layouts.
    // Each store can have a drag-and-drop map that determines the aisle order
    // used to sort items on the shopping list.
    import { storeContext } from "$lib/context/store-context.svelte";
    import StoreEditor from "$lib/components/StoreEditor.svelte";

    let newStore = $state('');
    // Only one store's editor is open at a time — tracks which one by index.
    /** @type {number | null} */
    let expandedStore = $state(null);

    async function addStore() {
        await storeContext.addStore(newStore);
        newStore = '';
    }

    /**
     * @param {number} index
     * @param {{ positions: {[k: string]: {x: number, y: number}}, route: string[] }} layout
     */
    async function onSave(index, layout) {
        await storeContext.setStoreLayout(index, layout.positions, layout.route);
    }

</script>

<div class="page">
    <h1>Varuhus</h1>

    <div class="card">
        <div class="add-row">
            <input
                type="text"
                placeholder="Lägg till varuhus"
                bind:value={newStore}
                onkeydown={(e) => e.key === 'Enter' && addStore()}
            />
            <button onclick={addStore}>Lägg till</button>
        </div>

        {#if storeContext.stores.length === 0}
            <p class="empty-state">
                Varuhus låter dig ange i vilken ordning hyllorna ligger i din butik — så att varulistan sorteras efter din rutt när du handlar. Lägg till ett varuhus ovan för att komma igång.
            </p>
        {:else}
            <ul>
                {#each storeContext.stores as store, index}
                    <li class="store-item">
                        <div class="store-header">
                            <span class="store-name">{store.name}</span>
                            <div class="store-actions">
                                <button
                                    class="btn-layout"
                                    class:active={expandedStore === index}
                                    onclick={() => expandedStore = expandedStore === index ? null : index}
                                >
                                    {expandedStore === index ? 'Stäng' : 'Redigera rutt'}
                                </button>
                                <button class="btn-remove" onclick={() => storeContext.removeStore(index)}>Ta bort</button>
                            </div>
                        </div>

                        {#if expandedStore === index}
                            <StoreEditor
                                {store}
                                onSave={(/** @type {Parameters<typeof onSave>[1]} */ layout) => onSave(index, layout)}
                            />
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>

<style>
    .page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
    }

    .card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        padding: 1.25rem;
    }

    .add-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .add-row input {
        flex: 1;
        padding: 0.6rem 0.9rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        outline: none;
        transition: border-color 0.15s;
    }

    .add-row input:focus { border-color: #f97316; }

    .add-row button {
        padding: 0.4rem 1rem;
        border: none;
        border-radius: 6px;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        font-weight: 600;
        font-size: 0.9em;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .add-row button:hover { opacity: 0.88; }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .store-item {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.75rem;
        background: #fafafa;
    }

    .store-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .store-name {
        flex: 1;
        font-weight: 600;
        min-width: 0;
    }

    .store-actions {
        display: flex;
        gap: 0.4rem;
        flex-shrink: 0;
    }

    .btn-layout {
        padding: 0.3rem 0.65rem;
        border: 1px solid #d1d5db;
        border-radius: 5px;
        background: #fff;
        cursor: pointer;
        font-size: 0.88em;
        white-space: nowrap;
    }

    .btn-layout.active {
        background: #f97316;
        color: #fff;
        border-color: #f97316;
    }

    .btn-remove {
        padding: 0.3rem 0.65rem;
        border: 1px solid #fca5a5;
        border-radius: 5px;
        background: #fff;
        color: #dc2626;
        cursor: pointer;
        font-size: 0.88em;
        white-space: nowrap;
    }

    .btn-remove:hover { background: #fef2f2; }

    .empty-state {
        font-size: 0.88em;
        color: #6b7280;
        line-height: 1.6;
        margin: 0;
        padding: 0.25rem 0;
    }
</style>
