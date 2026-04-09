<script>
    import { storeContext } from "$lib/context/store-context.svelte";
    import StoreEditor from "$lib/components/StoreEditor.svelte";

    let newStore = $state('');
    /** @type {number | null} */
    let expandedStore = $state(null);

    function addStore() {
        storeContext.addStore(newStore);
        newStore = '';
    }

    /**
     * @param {number} index
     * @param {{ positions: {[k: string]: {x: number, y: number}}, route: string[] }} layout
     */
    function onSave(index, layout) {
        storeContext.setStoreLayout(index, layout.positions, layout.route);
    }
</script>

<h1>Varuhus</h1>

<div class="store-list">
    <h2>Mina varuhus</h2>
    <div class="add-row">
        <input
            type="text"
            placeholder="Lägg till varuhus"
            bind:value={newStore}
            onkeydown={(e) => e.key === 'Enter' && addStore()}
        />
        <button onclick={addStore}>Lägg till</button>
    </div>

    <ul>
        {#each storeContext.stores as store, index}
            <li class="store-item">
                <div class="store-header">
                    <span class="store-name">{store.name}</span>
                    <button
                        class="btn-layout"
                        class:active={expandedStore === index}
                        onclick={() => expandedStore = expandedStore === index ? null : index}
                    >
                        {expandedStore === index ? 'Stäng layout' : 'Redigera layout'}
                    </button>
                    <button class="btn-remove" onclick={() => storeContext.removeStore(index)}>Ta bort</button>
                </div>

                {#if expandedStore === index}
                    <StoreEditor
                        {store}
                        onSave={(layout) => onSave(index, layout)}
                    />
                {/if}
            </li>
        {/each}
    </ul>
</div>

<style>
    .add-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .add-row input {
        flex: 1;
    }

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
        padding: 0.6rem 0.75rem;
        background: #fff;
    }

    .store-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .store-name {
        flex: 1;
        font-weight: 600;
    }

    .btn-layout {
        padding: 0.25rem 0.6rem;
        border: 1px solid #d1d5db;
        border-radius: 5px;
        background: #fff;
        cursor: pointer;
        font-size: 0.88em;
    }

    .btn-layout.active {
        background: #3b82f6;
        color: #fff;
        border-color: #3b82f6;
    }

    .btn-remove {
        padding: 0.25rem 0.6rem;
        border: 1px solid #fca5a5;
        border-radius: 5px;
        background: #fff;
        color: #dc2626;
        cursor: pointer;
        font-size: 0.88em;
    }

    .btn-remove:hover {
        background: #fef2f2;
    }
</style>
