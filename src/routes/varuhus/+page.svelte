<svelte:head><title>Varuhus – MazeShopper</title></svelte:head>

<script>
    import { storeContext } from "$lib/context/store-context.svelte";
    import { listprofileContext } from "$lib/context/listprofile-context.svelte";
    import StoreEditor from "$lib/components/StoreEditor.svelte";

    let newStore = $state('');
    let selectedProfileId = $state('');
    /** @type {number | null} */
    let selectedIndex = $state(null);
    let confirmDelete = $state(false);

    const selected = $derived(selectedIndex !== null ? storeContext.stores[selectedIndex] : null);

    // Auto-select the first profile once profiles are loaded.
    $effect(() => {
        if (!selectedProfileId && listprofileContext.profiles.length > 0) {
            selectedProfileId = listprofileContext.profiles[0].id;
        }
    });

    // Categories for the currently selected store, derived from its profile.
    const editorCategories = $derived(
        selected?.profileId
            ? (listprofileContext.getProfile(selected.profileId)?.categories ?? [])
            : []
    );

    async function addStore() {
        const name = newStore.trim();
        if (!name || !selectedProfileId) return;
        // Behåll namnet i fältet om det misslyckades, så användaren kan försöka igen.
        if (await storeContext.addStore(name, selectedProfileId)) newStore = '';
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
        // Stanna kvar i editorn om borttagningen misslyckades — varuhuset finns
        // fortfarande kvar och skulle annars dyka upp igen i listan bakom.
        if (await storeContext.removeStore(selectedIndex)) selectedIndex = null;
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
            categories={editorCategories}
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
        {#if listprofileContext.profiles.length > 1}
            <select bind:value={selectedProfileId} class="profile-select">
                {#each listprofileContext.profiles as profile}
                    <option value={profile.id}>{profile.name}</option>
                {/each}
            </select>
        {/if}
        <button onclick={addStore}>+ Lägg till</button>
    </div>

    {#if storeContext.stores.length === 0}
        {#if storeContext.loaded}
            <p class="empty-hint">
                Varuhus låter dig ange i vilken ordning hyllorna ligger — så att varulistan sorteras efter din rutt när du handlar.
            </p>
        {/if}
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
    h1 { margin: 0; font-size: 1.5rem; }

    .subtitle {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.9em;
    }

    /* Grid view */
    .new-store-card {
        display: flex;
        gap: 0.5rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 1rem;
    }

    .new-store-card input {
        flex: 1;
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-md);
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .new-store-card input:focus { border-color: var(--color-primary); }

    .profile-select {
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-md);
        font-size: 0.95em;
        background: var(--bg-surface);
        color: var(--text-primary);
        outline: none;
        cursor: pointer;
    }

    .new-store-card button {
        padding: 0.55rem 1rem;
        background: var(--gradient-brand);
        color: #fff;
        border: none;
        border-radius: var(--radius-md);
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .new-store-card button:hover { opacity: 0.9; }

    @media (max-width: 420px) {
        .new-store-card {
            flex-direction: column;
        }
        .new-store-card button {
            width: 100%;
        }
    }

    .empty-hint {
        font-size: 0.88em;
        color: var(--text-faint);
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
        border-radius: var(--radius-lg);
        border: 2px solid var(--border);
        background: var(--bg-surface);
        padding: 1rem;
        cursor: pointer;
        text-align: center;
        transition: border-color 0.15s, box-shadow 0.15s;
        font-size: 1rem;
    }

    .store-card:hover {
        border-color: var(--text-faint);
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .store-name {
        font-size: 1.05em;
        font-weight: 600;
        color: var(--text-primary);
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
        color: var(--text-muted);
        font-size: 0.95em;
        cursor: pointer;
        padding: 0;
        min-height: unset;
        white-space: nowrap;
    }

    .back:hover { color: var(--text-primary); }

    .btn-delete {
        font-size: 0.8em;
        color: var(--danger-text);
        background: none;
        border: 1px solid var(--danger-border);
        border-radius: var(--radius-sm);
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
        min-height: unset;
    }

    .btn-delete:hover { background: var(--danger-bg); }

    .confirm-inline {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.82em;
        color: var(--danger-text);
        font-weight: 600;
    }

    .btn-confirm-danger {
        padding: 0.2rem 0.55rem;
        background: var(--danger-text);
        color: #fff;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        min-height: unset;
    }

    .btn-confirm-danger:hover { background: var(--danger-text-hover); }

    .btn-cancel {
        padding: 0.2rem 0.55rem;
        background: var(--bg-surface);
        border: 1px solid var(--border-input);
        border-radius: var(--radius-sm);
        font-size: 0.85em;
        cursor: pointer;
        min-height: unset;
    }

    .btn-cancel:hover { background: var(--bg-elevated); }

    .editor-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        padding: 1.25rem;
    }
</style>
