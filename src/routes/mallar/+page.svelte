<svelte:head><title>Mallar – MazeShopper</title></svelte:head>

<script>
    import { templateContext } from '$lib/context/template-context.svelte';
    import { listprofileContext } from '$lib/context/listprofile-context.svelte';
    import { notificationContext } from '$lib/context/notification-context.svelte';

    // null = list view, string = editing a specific template
    /** @type {string | null} */
    let selectedId = $state(null);

    const selected = $derived(selectedId ? templateContext.getTemplate(selectedId) : null);

    // "Ny mall" form
    let newTemplateName = $state('');
    let newTemplateProfileId = $state('');
    let creatingTemplate = $state(false);

    $effect(() => {
        if (!newTemplateProfileId && listprofileContext.profiles.length > 0) {
            newTemplateProfileId = listprofileContext.profiles[0].id;
        }
    });

    // Add-item form (inside editor)
    let newItemName = $state('');
    let newItemSpec = $state('');
    let newItemQty = $state(1);
    let newItemCategory = $state('');
    let addingItem = $state(false);

    // Inline rename
    let renamingId = $state('');
    let renameValue = $state('');

    let confirmDelete = $state(false);

    // Profiltilldelning för mallar utan profileId
    let assigningProfileId = $state('');

    const editorCategories = $derived(
        selected?.profileId
            ? (listprofileContext.getProfile(selected.profileId)?.categories ?? [])
            : []
    );

    async function assignProfile() {
        if (!selectedId || !assigningProfileId) return;
        await templateContext.assignProfile(selectedId, assigningProfileId);
        assigningProfileId = '';
    }

    // Inline item edit
    /** @type {string | null} */
    let editingItemId = $state(null);
    let editItemName = $state('');
    let editItemSpec = $state('');
    let editItemQty = $state(1);
    let editItemCategory = $state('');

    async function createTemplate() {
        const name = newTemplateName.trim();
        if (!name) return;
        creatingTemplate = true;
        const id = await templateContext.createTemplate(name, newTemplateProfileId || null);
        creatingTemplate = false;
        newTemplateName = '';
        if (id) selectedId = id;
    }

    async function addItem() {
        if (!selectedId) return;
        if (!newItemCategory) {
            notificationContext.show('Välj en kategori innan du lägger till en vara.');
            return;
        }
        if (!newItemName.trim()) return;
        addingItem = true;
        const ok = await templateContext.addItem(selectedId, newItemName.trim(), newItemSpec.trim(), newItemQty, newItemCategory);
        addingItem = false;
        if (ok) {
            newItemName = '';
            newItemSpec = '';
            newItemQty = 1;
        }
    }

    /** @param {import('$lib/context/template-context.svelte').TemplateItem} item */
    function startEditItem(item) {
        editingItemId = item.itemId;
        editItemName = item.name;
        editItemSpec = item.spec;
        editItemQty = item.quantity;
        editItemCategory = item.category;
    }

    async function saveEditItem() {
        if (!selectedId || !editingItemId || !editItemName.trim()) return;
        await templateContext.updateItem(selectedId, editingItemId, {
            name: editItemName.trim(),
            spec: editItemSpec.trim(),
            quantity: editItemQty,
            category: editItemCategory
        });
        editingItemId = null;
    }

    function startRename(/** @type {import('$lib/context/template-context.svelte').Template} */ t) {
        renamingId = t.id;
        renameValue = t.name;
    }

    async function saveRename() {
        if (!renameValue.trim()) return;
        await templateContext.renameTemplate(renamingId, renameValue.trim());
        renamingId = '';
    }

    async function deleteTemplate() {
        if (!selectedId || !selected) return;
        await templateContext.deleteTemplate(selectedId);
        selectedId = null;
        confirmDelete = false;
    }
</script>

<div class="page">
    {#if selectedId && selected}
        <!-- ── Editor view ── -->
        <div class="editor-header">
            <button class="back" onclick={() => { selectedId = null; editingItemId = null; }}>← Mallar</button>
            <div class="editor-title">
                {#if renamingId === selected.id}
                    <input
                        class="rename-input"
                        bind:value={renameValue}
                        onkeydown={(e) => { if (e.key === 'Enter') saveRename(); else if (e.key === 'Escape') renamingId = ''; }}
                    />
                    <button class="btn-save" onclick={saveRename}>Spara</button>
                    <button class="btn-cancel" onclick={() => renamingId = ''}>Avbryt</button>
                {:else}
                    <h1>{selected.name}</h1>
                    <button class="btn-rename" onclick={() => startRename(selected)}>Byt namn</button>
                {/if}
            </div>
            {#if confirmDelete}
                <div class="confirm-delete">
                    <span>Ta bort?</span>
                    <button class="btn-confirm-delete" onclick={deleteTemplate}>Ja</button>
                    <button class="btn-cancel" onclick={() => confirmDelete = false}>Nej</button>
                </div>
            {:else}
                <button class="btn-delete-template" onclick={() => confirmDelete = true}>Ta bort mall</button>
            {/if}
        </div>

        <!-- Items list -->
        <div class="card items-card">
            {#if selected.items.length === 0}
                <p class="empty">Mallen är tom. Lägg till varor nedan.</p>
            {:else}
                <ul>
                    {#each selected.items as item (item.itemId)}
                        <li>
                            {#if editingItemId === item.itemId}
                                <div class="edit-form">
                                    <input
                                        class="edit-input"
                                        bind:value={editItemName}
                                        placeholder="Vara"
                                        onkeydown={(e) => { if (e.key === 'Enter') saveEditItem(); else if (e.key === 'Escape') editingItemId = null; }}
                                    />
                                    <input
                                        class="edit-input"
                                        bind:value={editItemSpec}
                                        placeholder="Specifikation (valfritt)"
                                        onkeydown={(e) => { if (e.key === 'Enter') saveEditItem(); else if (e.key === 'Escape') editingItemId = null; }}
                                    />
                                    <div class="edit-qty-row">
                                        <label>Antal:</label>
                                        <button class="qty-btn" onclick={() => editItemQty = Math.max(1, editItemQty - 1)}>−</button>
                                        <span class="qty-value">{editItemQty}</span>
                                        <button class="qty-btn" onclick={() => editItemQty = Math.min(9999, editItemQty + 1)}>+</button>
                                    </div>
                                    <div class="category-picker">
                                        {#each editorCategories as cat}
                                            <button
                                                class="category-chip"
                                                class:selected={editItemCategory === cat.name}
                                                style="--chip-color: {cat.color}"
                                                onclick={() => editItemCategory = cat.name}
                                            >{cat.name}</button>
                                        {/each}
                                    </div>
                                    <div class="edit-actions">
                                        <button class="btn-save" onclick={saveEditItem}>Spara</button>
                                        <button class="btn-cancel" onclick={() => editingItemId = null}>Avbryt</button>
                                    </div>
                                </div>
                            {:else}
                                <div class="item-info">
                                    <span class="item-name">{item.name}{item.spec ? ` – ${item.spec}` : ''}</span>
                                    <span class="item-meta">
                                        {#if item.quantity > 1}<span class="item-qty">×{item.quantity}</span>{/if}
                                        {#if item.category}
                                            {@const cat = editorCategories.find(c => c.name === item.category)}
                                            <span class="item-cat-chip" style="--chip-color: {cat?.color ?? '#e2e8f0'}">{item.category}</span>
                                        {/if}
                                    </span>
                                </div>
                                <div class="item-actions">
                                    <button class="btn-edit-item" onclick={() => startEditItem(item)}>Redigera</button>
                                    <button class="btn-remove-item" onclick={() => selectedId && templateContext.removeItem(selectedId, item.itemId)}>Ta bort</button>
                                </div>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>

        <!-- Add item form -->
        <div class="card add-card">
            <p class="add-card-label">Lägg till vara i mallen</p>
            {#if !selected.profileId}
                <div class="no-profile-notice">
                    <p>Tilldela en profil för att välja kategorier.</p>
                    <div class="assign-row">
                        <select bind:value={assigningProfileId} class="profile-select-sm">
                            <option value="">Välj profil…</option>
                            {#each listprofileContext.profiles as profile}
                                <option value={profile.id}>{profile.name}</option>
                            {/each}
                        </select>
                        <button class="btn-assign" onclick={assignProfile} disabled={!assigningProfileId}>Tilldela</button>
                    </div>
                </div>
            {:else}
                <input
                    bind:value={newItemName}
                    placeholder="Vara"
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <input
                    bind:value={newItemSpec}
                    placeholder="Specifikation (valfritt)"
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <div class="qty-row">
                    <label>Antal:</label>
                    <button class="qty-btn" onclick={() => newItemQty = Math.max(1, newItemQty - 1)}>−</button>
                    <span class="qty-value">{newItemQty}</span>
                    <button class="qty-btn" onclick={() => newItemQty = Math.min(9999, newItemQty + 1)}>+</button>
                </div>
                <div class="category-picker">
                    {#each editorCategories as cat}
                        <button
                            class="category-chip"
                            class:selected={newItemCategory === cat.name}
                            style="--chip-color: {cat.color}"
                            onclick={() => newItemCategory = cat.name}
                        >{cat.name}</button>
                    {/each}
                </div>
                <button class="btn-add" onclick={addItem} disabled={addingItem}>
                    {addingItem ? 'Lägger till…' : 'Lägg till vara'}
                </button>
            {/if}
        </div>

    {:else}
        <!-- ── List view ── -->
        <h1>Mallar</h1>
        <p class="subtitle">Spara varugrupper och recept som du kan importera direkt i en inköpslista.</p>

        <div class="card create-card">
            <div class="create-row">
                <input
                    bind:value={newTemplateName}
                    placeholder="Namn på ny mall"
                    onkeydown={(e) => e.key === 'Enter' && createTemplate()}
                />
                {#if listprofileContext.profiles.length > 1}
                    <select bind:value={newTemplateProfileId} class="profile-select">
                        {#each listprofileContext.profiles as profile}
                            <option value={profile.id}>{profile.name}</option>
                        {/each}
                    </select>
                {/if}
                <button class="btn-create" onclick={createTemplate} disabled={creatingTemplate || !newTemplateName.trim()}>
                    {creatingTemplate ? '…' : 'Skapa mall'}
                </button>
            </div>
        </div>

        {#if templateContext.templates.length === 0}
            {#if templateContext.loaded}
                <div class="card empty-card">
                    <p class="empty">Inga mallar än. Skapa din första mall ovan.</p>
                </div>
            {/if}
        {:else}
            <div class="template-list">
                {#each templateContext.templates as t (t.id)}
                    <button class="template-card" onclick={() => { selectedId = t.id; editingItemId = null; }}>
                        <span class="template-name">{t.name}</span>
                        <span class="template-count">{t.items.length} {t.items.length === 1 ? 'vara' : 'varor'}</span>
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
        color: var(--text-muted);
        font-size: 0.9em;
    }

    .card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow-card);
        padding: 1.25rem;
    }

    /* List view */
    .create-card { padding: 1rem; }

    .create-row {
        display: flex;
        gap: 0.5rem;
    }

    .create-row input {
        flex: 1;
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .create-row input:focus { border-color: #f97316; }

    .btn-create {
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

    .btn-create:hover:not(:disabled) { opacity: 0.9; }
    .btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

    .profile-select {
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.95em;
        background: var(--bg-surface);
        color: var(--text-primary);
        outline: none;
        cursor: pointer;
    }

    .template-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 1rem;
        margin-top: 0.5rem;
    }

    .template-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        min-height: 100px;
        background: var(--bg-surface);
        border: 2px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
        cursor: pointer;
        text-align: center;
        transition: border-color 0.15s, box-shadow 0.15s;
        font-size: 1rem;
    }

    .template-card:hover { border-color: var(--text-faint); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

    .template-name { font-weight: 600; color: var(--text-primary); font-size: 1.05em; }

    .template-count {
        font-size: 0.8em;
        color: var(--text-faint);
    }

    .empty-card { padding: 2rem 1.25rem; }

    .empty {
        text-align: center;
        color: var(--text-faint);
        font-size: 0.9em;
        margin: 0;
    }

    /* Editor view */
    .editor-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
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
        text-decoration: none;
    }

    .back:hover { color: var(--text-primary); }

    .editor-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
        min-width: 0;
    }

    .editor-title h1 {
        font-size: 1.4rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .rename-input {
        flex: 1;
        padding: 0.4rem 0.7rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 1.1em;
        font-weight: 700;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .rename-input:focus { border-color: #f97316; }

    .btn-rename {
        background: none;
        border: 1px solid var(--border);
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8em;
        padding: 0.2rem 0.5rem;
        min-height: unset;
        color: var(--text-muted);
    }

    .btn-rename:hover { background: var(--bg-elevated); color: var(--text-secondary); }

    .btn-delete-template {
        font-size: 0.8em;
        color: var(--danger-text);
        background: none;
        border: 1px solid var(--danger-border);
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
        margin-left: auto;
        min-height: unset;
    }

    .btn-delete-template:hover { background: var(--danger-bg); }

    .confirm-delete {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-left: auto;
        font-size: 0.82em;
        color: var(--danger-text);
    }

    @media (max-width: 420px) {
        .create-row {
            flex-direction: column;
        }
        .btn-create {
            width: 100%;
        }
    }

    @media (max-width: 480px) {
        .btn-delete-template, .confirm-delete {
            margin-left: 0;
            flex-basis: 100%;
            justify-content: flex-end;
        }
        .btn-delete-template { align-self: flex-end; }
    }

    .btn-confirm-delete {
        padding: 0.25rem 0.6rem;
        background: var(--danger-text);
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85em;
        font-weight: 600;
        min-height: unset;
    }

    .btn-confirm-delete:hover { background: var(--danger-text-hover); }

    /* Items card */
    .items-card { padding: 0; overflow: hidden; }

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
        padding: 0.7rem 1.25rem;
        border-bottom: 1px solid var(--border-faint);
        font-size: 0.95em;
        flex-wrap: wrap;
    }

    li:last-child { border-bottom: none; }

    .item-info {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        flex: 1;
        min-width: 0;
    }

    .item-name {
        color: var(--text-primary);
        word-break: break-word;
        font-weight: 500;
    }

    .item-meta {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
    }

    .item-qty {
        font-size: 0.8em;
        color: var(--text-muted);
        background: var(--bg-elevated);
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
    }

    .item-cat-chip {
        font-size: 0.78em;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        background: var(--chip-color, #e2e8f0);
        color: #374151;
        font-weight: 500;
        border: 1px solid color-mix(in srgb, var(--chip-color, #e2e8f0) 60%, var(--text-faint));
    }

    .item-actions {
        display: flex;
        gap: 0.25rem;
        flex-shrink: 0;
    }

    .btn-edit-item, .btn-remove-item {
        border: 1px solid var(--border);
        background: var(--bg-surface);
        color: var(--text-secondary);
        border-radius: 6px;
        padding: 0.2rem 0.6rem;
        cursor: pointer;
        font-size: 0.8em;
        min-height: unset;
    }

    .btn-edit-item:hover { background: var(--bg-elevated); }
    .btn-remove-item { color: var(--danger-text); border-color: var(--danger-border); }
    .btn-remove-item:hover { background: var(--danger-bg); }

    /* Inline edit form */
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

    /* Add item form */
    .add-card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .add-card-label {
        margin: 0;
        font-size: 0.85em;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .add-card input {
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .add-card input:focus { border-color: #f97316; }

    .qty-row, .edit-qty-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9em;
        color: var(--text-secondary);
    }

    .qty-btn {
        width: 32px;
        height: 32px;
        border: 1px solid var(--border-input);
        border-radius: 6px;
        background: var(--bg-surface);
        cursor: pointer;
        font-size: 1em;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: unset;
        min-width: unset;
    }

    .qty-btn:hover { background: var(--bg-elevated); }

    .qty-value {
        min-width: 1.8rem;
        text-align: center;
        font-weight: 600;
    }

    .category-picker {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.4rem;
        overflow-x: auto;
        padding: 3px 2px;
        scrollbar-width: none;
    }

    .category-picker::-webkit-scrollbar { display: none; }

    .category-chip {
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        border: 1.5px solid color-mix(in srgb, var(--chip-color, #e5e7eb) 60%, var(--text-faint));
        background: var(--chip-color, #f3f4f6);
        cursor: pointer;
        font-size: 0.82em;
        font-weight: 500;
        color: #374151;
        opacity: 0.8;
        transition: opacity 0.1s, box-shadow 0.1s;
        min-height: unset;
    }

    .category-chip:hover { opacity: 1; }

    .category-chip.selected {
        opacity: 1;
        box-shadow: 0 0 0 2px var(--text-secondary);
        font-weight: 700;
    }

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

    .btn-add:hover:not(:disabled) { opacity: 0.9; }
    .btn-add:disabled { opacity: 0.6; cursor: not-allowed; }

    .no-profile-notice {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .no-profile-notice p {
        margin: 0;
        font-size: 0.88em;
        color: var(--text-muted);
    }

    .assign-row {
        display: flex;
        gap: 0.5rem;
    }

    .profile-select-sm {
        flex: 1;
        padding: 0.45rem 0.7rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.9em;
        background: var(--bg-surface);
        color: var(--text-primary);
        outline: none;
        cursor: pointer;
    }

    .btn-assign {
        padding: 0.45rem 0.9rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.88em;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .btn-assign:hover:not(:disabled) { opacity: 0.9; }
    .btn-assign:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
