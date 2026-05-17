<svelte:head><title>Mallar – MazeShopper</title></svelte:head>

<script>
    import { templateContext } from '$lib/context/template-context.svelte';
    import { settingContext } from '$lib/context/setting-context.svelte';
    import { notificationContext } from '$lib/context/notification-context.svelte';

    // null = list view, string = editing a specific template
    /** @type {string | null} */
    let selectedId = $state(null);

    const selected = $derived(selectedId ? templateContext.getTemplate(selectedId) : null);

    // "Ny mall" form
    let newTemplateName = $state('');
    let creatingTemplate = $state(false);

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
        const id = await templateContext.createTemplate(name);
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
                                        {#each settingContext.categories as cat}
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
                                            {@const cat = settingContext.categories.find(c => c.name === item.category)}
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
                {#each settingContext.categories as cat}
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
                <button class="btn-create" onclick={createTemplate} disabled={creatingTemplate || !newTemplateName.trim()}>
                    {creatingTemplate ? '…' : 'Skapa mall'}
                </button>
            </div>
        </div>

        {#if templateContext.templates.length === 0}
            <div class="card empty-card">
                <p class="empty">Inga mallar än. Skapa din första mall ovan.</p>
            </div>
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
        color: #6b7280;
        font-size: 0.9em;
    }

    .card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
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
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
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

    .template-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .template-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 1rem 1.25rem;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s, box-shadow 0.15s;
        min-height: unset;
        font-size: 1rem;
    }

    .template-card:hover { background: #fafafa; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }

    .template-name { font-weight: 600; color: #111827; }

    .template-count {
        font-size: 0.82em;
        color: #9ca3af;
        background: #f3f4f6;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
    }

    .empty-card { padding: 2rem 1.25rem; }

    .empty {
        text-align: center;
        color: #9ca3af;
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
        color: #6b7280;
        font-size: 0.95em;
        cursor: pointer;
        padding: 0;
        min-height: unset;
        white-space: nowrap;
        text-decoration: none;
    }

    .back:hover { color: #111; }

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
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 1.1em;
        font-weight: 700;
        outline: none;
        transition: border-color 0.15s;
    }

    .rename-input:focus { border-color: #f97316; }

    .btn-rename {
        background: none;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8em;
        padding: 0.2rem 0.5rem;
        min-height: unset;
        color: #6b7280;
    }

    .btn-rename:hover { background: #f3f4f6; color: #374151; }

    .btn-delete-template {
        font-size: 0.8em;
        color: #dc2626;
        background: none;
        border: 1px solid #fca5a5;
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
        white-space: nowrap;
        margin-left: auto;
        min-height: unset;
    }

    .btn-delete-template:hover { background: #fef2f2; }

    .confirm-delete {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-left: auto;
        font-size: 0.82em;
        color: #dc2626;
    }

    .btn-confirm-delete {
        padding: 0.25rem 0.6rem;
        background: #dc2626;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85em;
        font-weight: 600;
        min-height: unset;
    }

    .btn-confirm-delete:hover { background: #b91c1c; }

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
        border-bottom: 1px solid #f9fafb;
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
        color: #111827;
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
        color: #6b7280;
        background: #f3f4f6;
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
        border: 1px solid color-mix(in srgb, var(--chip-color, #e2e8f0) 60%, #9ca3af);
    }

    .item-actions {
        display: flex;
        gap: 0.25rem;
        flex-shrink: 0;
    }

    .btn-edit-item, .btn-remove-item {
        border: 1px solid #e5e7eb;
        background: #fff;
        border-radius: 6px;
        padding: 0.2rem 0.6rem;
        cursor: pointer;
        font-size: 0.8em;
        min-height: unset;
    }

    .btn-edit-item:hover { background: #f3f4f6; }
    .btn-remove-item:hover { background: #fef2f2; border-color: #fca5a5; }

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
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.9em;
        outline: none;
        transition: border-color 0.15s;
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
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .add-card input {
        padding: 0.6rem 0.8rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
    }

    .add-card input:focus { border-color: #f97316; }

    .qty-row, .edit-qty-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9em;
        color: #374151;
    }

    .qty-btn {
        width: 32px;
        height: 32px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        font-size: 1em;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: unset;
        min-width: unset;
    }

    .qty-btn:hover { background: #f3f4f6; }

    .qty-value {
        min-width: 1.8rem;
        text-align: center;
        font-weight: 600;
    }

    .category-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .category-chip {
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        border: 1.5px solid color-mix(in srgb, var(--chip-color, #e5e7eb) 60%, #9ca3af);
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
        box-shadow: 0 0 0 2px #374151;
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
</style>
