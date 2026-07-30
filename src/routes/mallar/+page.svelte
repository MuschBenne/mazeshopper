<svelte:head><title>Mallar – MazeShopper</title></svelte:head>

<script>
    import { templateContext } from '$lib/context/template-context.svelte';
    import { categoryContext } from '$lib/context/category-context.svelte';
    import { notificationContext } from '$lib/context/notification-context.svelte';
    import { shoppingContext } from '$lib/context/shopping-context.svelte';
    import AmountField from '$lib/components/AmountField.svelte';
    import { formatAmount, formatQuantity, parseLeadingAmount, parseQuantityInput } from '$lib/units';
    import { collectSpecSuggestions } from '$lib/suggestions';

    let { data } = $props();

    // Seedas före första render så mallarna finns direkt, istället för att
    // hämtas efter hydrering.
    $effect.pre(() => {
        templateContext.seed(data.templates);
    });

    // null = list view, string = editing a specific template
    /** @type {string | null} */
    let selectedId = $state(null);

    const selected = $derived(selectedId ? templateContext.getTemplate(selectedId) : null);

    // "Ny mall" form
    let newTemplateName = $state('');
    let creatingTemplate = $state(false);
    /** @type {'template' | 'recipe'} */
    let newTemplateKind = $state('template');

    // Add-item form (inside editor)
    let newItemName = $state('');
    let newItemSpec = $state('');
    // Rå text, inte ett tal: "12 msk" ska gå att skriva, och tomt ska förbli
    // tomt. Plus- och minusknapparna som stod här förut klarade varken det ena
    // eller det andra.
    let newItemAmount = $state('');
    let newItemUnit = $state('');
    let newItemCategory = $state('');
    let addingItem = $state(false);

    // Inline rename
    let renamingId = $state('');
    let renameValue = $state('');

    let confirmDelete = $state(false);

    // Paletten är platt, så utan filter blir väljaren en vägg av alla
    // kategorier. Samma gruppval som på listsidan, och samma minne av senast
    // använda grupp — väljer du Bygg här står nästa nya lista också på Bygg.
    /** @type {string | null} */
    let groupChoice = $state(null);
    let lastUsedGroup = $state('');

    $effect(() => {
        lastUsedGroup = localStorage.getItem('mazeshopper_lastGroup') ?? '';
    });

    // En mall med varor i ställer in sig själv efter innehållet.
    const derivedGroup = $derived.by(() => {
        for (const item of selected?.items ?? []) {
            const group = categoryContext.groupOf(item.category);
            if (group) return group;
        }
        return null;
    });

    const groups = $derived(categoryContext.groups);

    const activeGroup = $derived(
        groupChoice ?? derivedGroup ?? (groups.includes(lastUsedGroup) ? lastUsedGroup : groups[0] ?? '')
    );

    const editorCategories = $derived(
        !activeGroup
            ? categoryContext.categories
            // Ogrupperade kategorier hör hemma överallt och följer alltid med.
            : categoryContext.categories.filter(c => c.group === activeGroup || !c.group)
    );

    /** @param {string} group */
    function chooseGroup(group) {
        groupChoice = group;
        if (group) localStorage.setItem('mazeshopper_lastGroup', group);
    }

    // En vara som redan har en kategori utanför den valda gruppen ska ändå gå
    // att se och behålla när man redigerar den.
    /** @param {string} current */
    function categoriesWith(current) {
        if (!current || editorCategories.some(c => c.name === current)) return editorCategories;
        const extra = categoryContext.categories.filter(c => c.name === current);
        return [...editorCategories, ...extra];
    }

    // Inline item edit
    /** @type {string | null} */
    let editingItemId = $state(null);
    let editItemName = $state('');
    let editItemSpec = $state('');
    let editItemAmount = $state('');
    let editItemUnit = $state('');
    let editItemCategory = $state('');

    // Förslag till spec-fältet ur allt användaren redan skrivit.
    const specSuggestions = $derived(
        collectSpecSuggestions(shoppingContext.lists, templateContext.templates)
    );

    async function createTemplate() {
        const name = newTemplateName.trim();
        if (!name) return;
        creatingTemplate = true;
        const id = await templateContext.createTemplate(name, newTemplateKind);
        creatingTemplate = false;
        newTemplateName = '';
        if (id) selectedId = id;
    }

    // "3 dl grädde" i varunamnet delas upp i namn, mängd och enhet — men bara
    // när mängdfältet står tomt, annars vinner det man skrivit där. Fälten
    // fylls i synligt så en feltolkning går att rätta innan varan sparas.
    //
    // Returnerar true när uppdelningen behöver granskas först. En utskriven
    // enhet är entydig och varan går in direkt — ett recept skrivs in ingrediens
    // efter ingrediens, och där kostar ett extra tryck per rad. Ett ensamt tal
    // ("2 mjölk") kan höra till namnet, och då stannar vi.
    function absorbAmountShortcut() {
        if (newItemAmount.trim()) return false;
        const parsed = parseLeadingAmount(newItemName);
        if (!parsed) return false;
        newItemName = parsed.name;
        newItemAmount = formatQuantity(parsed.quantity);
        newItemUnit = parsed.unit;
        return parsed.unit === '';
    }

    async function addItem() {
        if (!selectedId) return;
        // Kräver uppdelningen granskning stannar vi — nästa Enter lägger till.
        if (absorbAmountShortcut()) return;
        // Kategori är valfri här likaväl som i listan — varor utan kategori
        // hamnar i "Utan kategori" när mallen importeras.
        if (!newItemName.trim()) return;
        addingItem = true;
        const ok = await templateContext.addItem(
            selectedId,
            newItemName.trim(),
            newItemSpec.trim(),
            parseQuantityInput(newItemAmount),
            newItemCategory,
            newItemUnit
        );
        addingItem = false;
        if (ok) {
            newItemName = '';
            newItemSpec = '';
            newItemAmount = '';
            newItemUnit = '';
        }
    }

    /** @param {import('$lib/context/template-context.svelte').TemplateItem} item */
    function startEditItem(item) {
        editingItemId = item.itemId;
        editItemName = item.name;
        editItemSpec = item.spec;
        editItemAmount = item.quantity == null ? '' : formatQuantity(item.quantity);
        editItemUnit = item.unit ?? '';
        editItemCategory = item.category;
    }

    async function saveEditItem() {
        if (!selectedId || !editingItemId || !editItemName.trim()) return;
        await templateContext.updateItem(selectedId, editingItemId, {
            name: editItemName.trim(),
            spec: editItemSpec.trim(),
            quantity: parseQuantityInput(editItemAmount),
            unit: editItemUnit,
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

    const isRecipe = $derived(selected?.kind === 'recipe');

    // Tillagningen sparas när fältet lämnas, inte vid varje tangenttryck.
    let instructionsDraft = $state('');
    let sourceUrlDraft = $state('');
    let detailsOpen = $state(false);

    $effect(() => {
        instructionsDraft = selected?.instructions ?? '';
        sourceUrlDraft = selected?.sourceUrl ?? '';
    });

    const MAX_INSTRUCTIONS = 1500;
    const instructionsLeft = $derived(MAX_INSTRUCTIONS - instructionsDraft.length);

    async function saveInstructions() {
        if (!selectedId || instructionsDraft === (selected?.instructions ?? '')) return;
        await templateContext.updateRecipeDetails(selectedId, { instructions: instructionsDraft });
    }

    async function saveSourceUrl() {
        if (!selectedId || sourceUrlDraft === (selected?.sourceUrl ?? '')) return;
        const ok = await templateContext.updateRecipeDetails(selectedId, { sourceUrl: sourceUrlDraft });
        // Servern kastar adresser som inte är http(s), så spegla tillbaka det
        // som faktiskt sparades i stället för att låta fältet ljuga.
        if (ok) sourceUrlDraft = selected?.sourceUrl ?? '';
    }

    // location finns inte under SSR — fältet fylls i vid hydrering.
    let origin = $state('');
    $effect(() => { origin = location.origin; });

    async function toggleShare() {
        if (!selectedId || !selected) return;
        await templateContext.setShared(selectedId, !selected.shareToken);
    }

    async function copyShareLink() {
        if (!selected?.shareToken) return;
        const url = `${location.origin}/r/${selected.shareToken}`;
        try {
            await navigator.clipboard.writeText(url);
            notificationContext.show('Länken är kopierad.', 'success');
        } catch {
            // Utan klippbordsbehörighet är länken ändå synlig i fältet bredvid.
            notificationContext.show('Kunde inte kopiera. Markera länken och kopiera manuellt.');
        }
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

        {#if isRecipe}
            <div class="recipe-bar">
                <label for="servings">Portioner</label>
                <button class="qty-btn" onclick={() => templateContext.setServings(selected.id, Math.max(1, (selected.servings ?? 4) - 1))}>−</button>
                <span class="qty-value" id="servings">{selected.servings}</span>
                <button class="qty-btn" onclick={() => templateContext.setServings(selected.id, Math.min(99, (selected.servings ?? 4) + 1))}>+</button>
                <span class="recipe-hint">Mängderna räknas om mot det här talet vid import.</span>
            </div>
        {/if}

        {#if isRecipe}
            <div class="details-block">
                <button class="details-toggle" onclick={() => detailsOpen = !detailsOpen} aria-expanded={detailsOpen}>
                    {detailsOpen ? 'Dölj' : (selected.instructions || selected.sourceUrl ? 'Visa tillagning' : 'Lägg till tillagning')}
                </button>

                {#if detailsOpen}
                    <label class="details-label" for="instructions">Så här gör du <span class="optional">valfritt</span></label>
                    <textarea
                        id="instructions"
                        class="instructions-input"
                        rows="6"
                        maxlength={MAX_INSTRUCTIONS}
                        placeholder="Kort beskrivning av tillagningen. Syns för den du delar receptet med, aldrig i inköpslistan."
                        bind:value={instructionsDraft}
                        onblur={saveInstructions}
                    ></textarea>
                    <span class="char-count" class:tight={instructionsLeft < 150}>{instructionsLeft} tecken kvar</span>

                    <label class="details-label" for="source-url">Länk till källan <span class="optional">valfritt</span></label>
                    <input
                        id="source-url"
                        class="source-input"
                        type="url"
                        inputmode="url"
                        placeholder="https://…"
                        bind:value={sourceUrlDraft}
                        onblur={saveSourceUrl}
                    />
                {/if}
            </div>
        {/if}

        <div class="share-row">
            {#if selected.shareToken}
                <input class="share-link" readonly value="{origin}/r/{selected.shareToken}" onclick={(e) => e.currentTarget.select()} />
                <button class="btn-copy" onclick={copyShareLink}>Kopiera</button>
                <button class="btn-unshare" onclick={toggleShare}>Sluta dela</button>
            {:else}
                <button class="btn-share-link" onclick={toggleShare}>
                    Skapa delningslänk
                </button>
                <span class="recipe-hint">Vem som helst med länken kan läsa och spara en egen kopia.</span>
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
                                    <AmountField bind:amount={editItemAmount} bind:unit={editItemUnit} onEnter={saveEditItem} />
                                    <input
                                        class="edit-input"
                                        bind:value={editItemSpec}
                                        placeholder="Specifikation (valfritt)"
                                        list="spec-suggestions"
                                        onkeydown={(e) => { if (e.key === 'Enter') saveEditItem(); else if (e.key === 'Escape') editingItemId = null; }}
                                    />
                                    <div class="category-picker">
                                        {#each categoriesWith(editItemCategory) as cat}
                                            <button
                                                class="category-chip"
                                                class:selected={editItemCategory === cat.name}
                                                style="--chip-color: {cat.color}"
                                                onclick={() => editItemCategory = editItemCategory === cat.name ? '' : cat.name}
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
                                        {#if formatAmount(item.quantity, item.unit)}<span class="item-qty">{formatAmount(item.quantity, item.unit)}</span>{/if}
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
            <input
                bind:value={newItemName}
                placeholder="Vara"
                onblur={absorbAmountShortcut}
                onkeydown={(e) => e.key === 'Enter' && addItem()}
            />
            <AmountField bind:amount={newItemAmount} bind:unit={newItemUnit} onEnter={addItem} />
            <input
                bind:value={newItemSpec}
                placeholder="Specifikation (valfritt)"
                list="spec-suggestions"
                onkeydown={(e) => e.key === 'Enter' && addItem()}
            />
            <datalist id="spec-suggestions">
                {#each specSuggestions as suggestion (suggestion)}
                    <option value={suggestion}></option>
                {/each}
            </datalist>
            {#if groups.length > 1}
                <select
                    class="group-select"
                    aria-label="Kategorigrupp"
                    value={activeGroup}
                    onchange={(e) => chooseGroup(e.currentTarget.value)}
                >
                    {#each groups as group}
                        <option value={group}>{group}</option>
                    {/each}
                    <option value="">Alla kategorier</option>
                </select>
            {/if}
            <div class="category-picker">
                {#each editorCategories as cat}
                    <button
                        class="category-chip"
                        class:selected={newItemCategory === cat.name}
                        style="--chip-color: {cat.color}"
                        onclick={() => newItemCategory = newItemCategory === cat.name ? '' : cat.name}
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
                    placeholder={newTemplateKind === 'recipe' ? 'Namn på nytt recept' : 'Namn på ny mall'}
                    onkeydown={(e) => e.key === 'Enter' && createTemplate()}
                />
                <select bind:value={newTemplateKind} class="kind-select" aria-label="Typ">
                    <option value="template">Mall</option>
                    <option value="recipe">Recept</option>
                </select>
                <button class="btn-create" onclick={createTemplate} disabled={creatingTemplate || !newTemplateName.trim()}>
                    {creatingTemplate ? '…' : newTemplateKind === 'recipe' ? 'Skapa recept' : 'Skapa mall'}
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
                        <span class="template-count">
                            {t.items.length} {t.items.length === 1 ? 'vara' : 'varor'}
                            {#if t.kind === 'recipe'}· {t.servings} port.{/if}
                        </span>
                        {#if t.kind === 'recipe'}<span class="kind-badge">Recept</span>{/if}
                    </button>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    h1 { margin: 0; font-size: 1.5rem; }

    .kind-badge {
        font-size: 0.68em;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--violet-text);
        background: var(--violet-light);
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
    }

    .details-block {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .details-toggle {
        align-self: flex-start;
        padding: 0.4rem 0.8rem;
        border: 1px dashed var(--border-input);
        border-radius: var(--radius-sm);
        background: none;
        color: var(--text-muted);
        font-size: var(--text-sm);
        cursor: pointer;
        min-height: unset;
    }

    .details-toggle:hover { background: var(--bg-elevated); }

    .details-label {
        margin-top: 0.35rem;
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-secondary);
    }

    .optional {
        font-weight: 400;
        color: var(--text-faint);
    }

    .instructions-input,
    .source-input {
        width: 100%;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-sm);
        background: var(--bg-surface);
        color: var(--text-primary);
        font-size: var(--text-base);
        font-family: inherit;
        resize: vertical;
    }

    .char-count {
        align-self: flex-end;
        font-size: var(--text-xs);
        color: var(--text-faint);
    }

    .char-count.tight { color: var(--warning-text); }

    .recipe-bar,
    .share-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        font-size: 0.85em;
        color: var(--text-secondary);
    }

    .recipe-hint { color: var(--text-faint); font-size: 0.95em; }

    .share-link {
        flex: 1;
        min-width: 12rem;
        padding: 0.4rem 0.6rem;
        border: 1px solid var(--border-input);
        border-radius: 6px;
        background: var(--bg-elevated);
        color: var(--text-muted);
        font-size: 0.85em;
    }

    .btn-copy,
    .btn-unshare,
    .btn-share-link {
        padding: 0.4rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: 6px;
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: 0.85em;
        cursor: pointer;
        min-height: unset;
    }

    .btn-copy:hover,
    .btn-unshare:hover,
    .btn-share-link:hover { background: var(--bg-elevated); }

    .btn-unshare { color: var(--danger-text); border-color: var(--danger-border); }

    .subtitle {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.9em;
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
        border-radius: var(--radius-md);
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .create-row input:focus { border-color: var(--color-primary); }

    .btn-create {
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

    .btn-create:hover:not(:disabled) { opacity: 0.9; }
    .btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

    .kind-select {
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-md);
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
        border-radius: var(--radius-lg);
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
        border-radius: var(--radius-md);
        font-size: 1.1em;
        font-weight: 700;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .rename-input:focus { border-color: var(--color-primary); }

    .btn-rename {
        background: none;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
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
        border-radius: var(--radius-sm);
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
        border-radius: var(--radius-sm);
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
        border-radius: var(--radius-pill);
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
        border-radius: var(--radius-sm);
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
        border-radius: var(--radius-md);
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .add-card input:focus { border-color: var(--color-primary); }

    /* Kvar för portionsraden. Varornas antal stegas inte längre med knappar —
       tolv tryck för "12 msk" höll inte, och decimaler gick inte alls. */
    .qty-btn {
        width: 32px;
        height: 32px;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-sm);
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






    .btn-add {
        padding: 0.6rem;
        background: var(--gradient-brand);
        color: #fff;
        border: none;
        border-radius: var(--radius-md);
        font-size: 0.95em;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
    }

    .btn-add:hover:not(:disabled) { opacity: 0.9; }
    .btn-add:disabled { opacity: 0.6; cursor: not-allowed; }

</style>
