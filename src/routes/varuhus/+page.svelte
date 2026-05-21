<svelte:head><title>Varuhus – MazeShopper</title></svelte:head>

<script>
    import { storeContext } from "$lib/context/store-context.svelte";
    import StoreEditor from "$lib/components/StoreEditor.svelte";

    let newStore = $state('');
    /** @type {number | null} */
    let selectedIndex = $state(null);
    let confirmDelete = $state(false);

    const selected = $derived(selectedIndex !== null ? storeContext.stores[selectedIndex] : null);

    async function addStore() {
        const name = newStore.trim();
        if (!name) return;
        await storeContext.addStore(name);
        newStore = '';
    }

    /**
     * @param {{ positions: {[k: string]: {x: number, y: number}}, route: string[] }} layout
     */
    async function onSave(layout) {
        if (selectedIndex === null) return;
        await storeContext.setStoreLayout(selectedIndex, layout.positions, layout.route);
    }

    async function deleteStore() {
        if (selectedIndex === null) return;
        await storeContext.removeStore(selectedIndex);
        selectedIndex = null;
        confirmDelete = false;
    }

    function goBack() {
        selectedIndex = null;
        confirmDelete = false;
    }
</script>

<div class="page">

{#if selectedIndex !== null && selected}
    <!-- Detail view -->
    <div class="detail-header">
        <button class="back" onclick={goBack}>← Varuhus</button>
        <h1>{selected.name}</h1>
        {#if confirmDelete}
            <span class="confirm-inline">
                <span>Ta bort?</span>
                <button class="btn-confirm-danger" onclick={deleteStore}>Ja</button>
                <button class="btn-cancel" onclick={() => confirmDelete = false}>Nej</button>
            </span>
        {:else}
            <button class="btn-delete" onclick={() => confirmDelete = true}>Ta bort</button>
        {/if}
    </div>

    <div class="editor-card">
        <StoreEditor
            store={selected}
            onSave={(/** @type {Parameters<typeof onSave>[0]} */ layout) => onSave(layout)}
        />
    </div>

{:else}
    <!-- Grid view -->
    <h1>Varuhus</h1>
    <p class="subtitle">Spara din butiks hyllordning så att listan sorteras efter din rutt.</p>

    <div class="new-store-card">
        <input
            type="text"
            placeholder="Lägg till varuhus"
            bind:value={newStore}
            onkeydown={(e) => e.key === 'Enter' && addStore()}
        />
        <button onclick={addStore}>+ Lägg till</button>
    </div>

    {#if storeContext.stores.length === 0}
        <p class="empty-hint">
            Varuhus låter dig ange i vilken ordning hyllorna ligger — så att varulistan sorteras efter din rutt när du handlar.
        </p>
    {:else}
        <div class="stores-grid">
            {#each storeContext.stores as store, index}
                <button class="store-card" onclick={() => selectedIndex = index}>
                    <span class="store-name">{store.name}</span>
                </button>
            {/each}
        </div>
    {/if}
{/if}

</div>

<style>
    .page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    h1 { margin: 0; font-size: 1.5rem; }

    .subtitle {
        margin: 0;
        color: #6b7280;
        font-size: 0.9em;
    }

    /* Grid view */
    .new-store-card {
        display: flex;
        gap: 0.5rem;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1rem;
    }

    .new-store-card input {
        flex: 1;
        padding: 0.55rem 0.8rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
    }

    .new-store-card input:focus { border-color: #f97316; }

    .new-store-card button {
        padding: 0.55rem 1rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .new-store-card button:hover { opacity: 0.9; }

    .empty-hint {
        font-size: 0.88em;
        color: #9ca3af;
        margin: 0;
        line-height: 1.6;
    }

    .stores-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 1rem;
    }

    .store-card {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 120px;
        border-radius: 12px;
        border: 2px solid #e5e7eb;
        background: #fff;
        padding: 1rem;
        cursor: pointer;
        text-align: center;
        transition: border-color 0.15s, box-shadow 0.15s;
        font-size: 1rem;
    }

    .store-card:hover {
        border-color: #9ca3af;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .store-name {
        font-size: 1.05em;
        font-weight: 600;
        color: #111827;
        word-break: break-word;
    }

    /* Detail view */
    .detail-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .detail-header h1 {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .back {
        background: none;
        border: none;
        color: #6b7280;
        font-size: 0.95em;
        cursor: pointer;
        padding: 0;
        min-height: unset;
        white-space: nowrap;
    }

    .back:hover { color: #111; }

    .btn-delete {
        font-size: 0.8em;
        color: #dc2626;
        background: none;
        border: 1px solid #fca5a5;
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
        min-height: unset;
    }

    .btn-delete:hover { background: #fef2f2; }

    .confirm-inline {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.82em;
        color: #dc2626;
        font-weight: 600;
    }

    .btn-confirm-danger {
        padding: 0.2rem 0.55rem;
        background: #dc2626;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        min-height: unset;
    }

    .btn-confirm-danger:hover { background: #b91c1c; }

    .btn-cancel {
        padding: 0.2rem 0.55rem;
        background: #fff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.85em;
        cursor: pointer;
        min-height: unset;
    }

    .btn-cancel:hover { background: #f3f4f6; }

    .editor-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        padding: 1.25rem;
    }
</style>
