<script>
    /**
     * @type {{
     *   store: { categoryOrder: {[k: string]: number} },
     *   categories: { id: string, name: string, color: string }[],
     *   onSave: (layout: { positions: {[k: string]: {x: number, y: number}}, route: string[] }) => Promise<boolean>
     * }}
     */
    let { store, categories, onSave } = $props();

    /** @type {string[]} */
    let route = $state([]);

    $effect(() => {
        const storedOrder = store.categoryOrder ?? {};
        route = categories
            .filter(c => c.name in storedOrder)
            .sort((a, b) => storedOrder[a.name] - storedOrder[b.name])
            .map(c => c.name);
    });

    const available = $derived(
        categories.filter(c => !route.includes(c.name))
    );

    /** @type {Set<string>} */
    let checked = $state(new Set());

    // Drop checked entries that are no longer available (e.g. already added).
    $effect(() => {
        const availableNames = new Set(available.map(c => c.name));
        const stale = [...checked].filter(n => !availableNames.has(n));
        if (stale.length > 0) {
            checked = new Set([...checked].filter(n => availableNames.has(n)));
        }
    });

    /** @param {string} name */
    function toggleChecked(name) {
        const next = new Set(checked);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        checked = next;
    }

    function addSelected() {
        if (checked.size === 0) return;
        const toAdd = available.filter(c => checked.has(c.name)).map(c => c.name);
        route = [...route, ...toAdd];
        checked = new Set();
    }

    function addAll() {
        route = [...route, ...available.map(c => c.name)];
        checked = new Set();
    }

    /** @param {string} name */
    function removeFromRoute(name) {
        route = route.filter(n => n !== name);
    }

    /** @type {number | null} */
    let dragIndex = $state(null);
    /** @type {number | null} */
    let dragOverIndex = $state(null);

    /**
     * @param {DragEvent} e
     * @param {number} index
     */
    function onDragStart(e, index) {
        dragIndex = index;
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    }

    /**
     * @param {DragEvent} e
     * @param {number} index
     */
    function onDragOver(e, index) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        dragOverIndex = index;
    }

    /**
     * @param {DragEvent} e
     * @param {number} index
     */
    function onDrop(e, index) {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) {
            dragIndex = null;
            dragOverIndex = null;
            return;
        }
        const newRoute = [...route];
        const [moved] = newRoute.splice(dragIndex, 1);
        newRoute.splice(index, 0, moved);
        route = newRoute;
        dragIndex = null;
        dragOverIndex = null;
    }

    function onDragEnd() {
        dragIndex = null;
        dragOverIndex = null;
    }

    // Touch drag state — used on mobile where HTML5 drag-and-drop is unavailable.
    /** @type {number | null} */
    let touchDragIndex = $state(null);
    /** @type {number | null} */
    let touchOverIndex = $state(null);
    /** @type {HTMLUListElement | null} */
    let listEl = $state(null);

    /**
     * @param {TouchEvent} e
     * @param {number} index
     */
    function onHandleTouchStart(e, index) {
        e.preventDefault(); // prevent scroll when grabbing the handle
        touchDragIndex = index;
        touchOverIndex = index;
    }

    /** @param {TouchEvent} e */
    function onListTouchMove(e) {
        if (touchDragIndex === null || !listEl) return;
        e.preventDefault();
        const y = e.touches[0].clientY;
        const items = listEl.querySelectorAll('li.route-item');
        let target = items.length - 1;
        for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();
            if (y < rect.top + rect.height / 2) { target = i; break; }
        }
        touchOverIndex = target;
    }

    function onListTouchEnd() {
        if (touchDragIndex !== null && touchOverIndex !== null && touchOverIndex !== touchDragIndex) {
            const newRoute = [...route];
            const [moved] = newRoute.splice(touchDragIndex, 1);
            newRoute.splice(touchOverIndex, 0, moved);
            route = newRoute;
        }
        touchDragIndex = null;
        touchOverIndex = null;
    }

    let saved = $state(false);
    let saving = $state(false);
    /** @type {ReturnType<typeof setTimeout> | null} */
    let savedTimer = null;

    // Kvittensen får bara visas när servern faktiskt tagit emot ordningen.
    // Annars ser en misslyckad sparning identisk ut med en lyckad, och felet
    // upptäcks först nästa gång butiken sorteras.
    async function save() {
        if (saving) return;
        saving = true;
        try {
            if (!await onSave({ positions: {}, route: [...route] })) return;
            saved = true;
            if (savedTimer) clearTimeout(savedTimer);
            savedTimer = setTimeout(() => { saved = false; }, 2000);
        } finally {
            saving = false;
        }
    }

    /** @param {string} name */
    function getCategoryColor(name) {
        return categories.find(c => c.name === name)?.color ?? '#e2e8f0';
    }
</script>

<div class="editor">
    {#if available.length > 0}
        <div class="picker">
            <ul class="picker-list">
                {#each available as cat}
                    {@const isChecked = checked.has(cat.name)}
                    <li>
                        <label class="picker-item" class:is-checked={isChecked}>
                            <input
                                type="checkbox"
                                checked={isChecked}
                                onchange={() => toggleChecked(cat.name)}
                            />
                            <span class="picker-dot" style="background: {cat.color}"></span>
                            <span class="picker-name">{cat.name}</span>
                        </label>
                    </li>
                {/each}
            </ul>
            <div class="picker-actions">
                <button onclick={addSelected} disabled={checked.size === 0}>
                    Lägg till markerade ({checked.size})
                </button>
                <button class="btn-add-all" onclick={addAll}>Lägg till alla</button>
            </div>
        </div>
    {:else if route.length > 0}
        <p class="hint-all-added">Alla kategorier är tillagda i rutten.</p>
    {/if}

    {#if route.length > 0}
        <ul class="route-list" bind:this={listEl}
            ontouchmove={onListTouchMove}
            ontouchend={onListTouchEnd}
        >
            {#each route as name, i}
                {@const color = getCategoryColor(name)}
                {@const isFirst = i === 0}
                {@const isLast = i === route.length - 1}
                <li
                    class="route-item"
                    class:is-dragging={dragIndex === i || touchDragIndex === i}
                    class:drag-over={(dragOverIndex === i && dragIndex !== i) || (touchOverIndex === i && touchDragIndex !== null && touchDragIndex !== i)}
                    draggable="true"
                    ondragstart={(e) => onDragStart(e, i)}
                    ondragover={(e) => onDragOver(e, i)}
                    ondrop={(e) => onDrop(e, i)}
                    ondragend={onDragEnd}
                    style="--cat-color: {color}"
                >
                    <span class="drag-handle" aria-hidden="true"
                        ontouchstart={(e) => onHandleTouchStart(e, i)}
                    >⠿</span>
                    <span class="color-dot" style="background: {color}"></span>
                    <span class="cat-name">{name}</span>
                    <div class="badges">
                        {#if isFirst}
                            <span class="badge badge-start">Ingång</span>
                        {/if}
                        {#if isLast && route.length > 1}
                            <span class="badge badge-end">Utgång</span>
                        {/if}
                    </div>
                    <button
                        class="btn-item-remove"
                        onclick={() => removeFromRoute(name)}
                        aria-label="Ta bort {name} från rutten"
                    >×</button>
                </li>
            {/each}
        </ul>
    {:else}
        <p class="empty-hint">Lägg till kategorier ovan för att bygga din varuhusrutt.</p>
    {/if}

    <div class="save-row">
        <button class="btn-save" class:saved onclick={save} disabled={route.length === 0 || saving}>
            {saved ? '✓ Sparat!' : saving ? 'Sparar…' : 'Spara rutt'}
        </button>
    </div>
</div>

<style>
    .editor {
        margin-top: 0.75rem;
        padding: 0.875rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .picker {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 7px;
        padding: 0.65rem;
    }

    .picker-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
    }

    .picker-item {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.3rem 0.6rem 0.3rem 0.45rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        cursor: pointer;
        font-size: 0.88em;
        background: var(--bg-elevated);
        transition: background 0.12s, border-color 0.12s;
        user-select: none;
    }

    .picker-item:hover { background: var(--bg-hover); border-color: var(--border-input); }

    .picker-item.is-checked {
        background: var(--warning-bg);
        border-color: var(--warning-border);
    }

    .picker-item input[type="checkbox"] {
        width: 14px;
        height: 14px;
        accent-color: var(--color-primary);
        cursor: pointer;
        flex-shrink: 0;
    }

    .picker-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0,0,0,0.1);
    }

    .picker-name {
        color: var(--text-secondary);
        font-weight: 500;
    }

    .picker-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .picker-actions button {
        padding: 0.35rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-sm);
        background: var(--bg-surface);
        cursor: pointer;
        font-size: 0.88em;
        white-space: nowrap;
        transition: background 0.12s;
    }

    .picker-actions button:hover:not(:disabled) { background: var(--bg-elevated); }
    .picker-actions button:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-add-all {
        border-color: var(--warning-border) !important;
        color: var(--warning-text);
        background: var(--warning-bg) !important;
    }

    .btn-add-all:hover:not(:disabled) { opacity: 0.85; }

    .hint-all-added {
        font-size: 0.83em;
        color: var(--text-muted);
        margin: 0;
    }

    .route-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .route-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.65rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-left: 4px solid var(--cat-color, #e2e8f0);
        border-radius: 7px;
        cursor: grab;
        user-select: none;
        transition: box-shadow 0.12s, opacity 0.12s, background 0.12s;
    }

    .route-item:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.08); }

    .route-item.is-dragging {
        opacity: 0.45;
        cursor: grabbing;
    }

    .route-item.drag-over {
        background: var(--warning-bg);
        border-color: var(--warning-border);
        border-left-color: var(--cat-color, #e2e8f0);
        box-shadow: 0 0 0 2px var(--warning-border);
    }

    .drag-handle {
        font-size: 1.1em;
        color: var(--text-faint);
        cursor: grab;
        flex-shrink: 0;
        line-height: 1;
        padding: 0.25rem;
        margin: -0.25rem;
        touch-action: none;
    }

    @media (pointer: coarse) {
        .drag-handle {
            font-size: 1.4em;
            padding: 0.5rem;
            margin: -0.5rem;
        }
    }

    .color-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0,0,0,0.08);
    }

    .cat-name {
        flex: 1;
        font-size: 0.92em;
        font-weight: 500;
        color: var(--text-secondary);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .badges {
        display: flex;
        gap: 0.3rem;
        flex-shrink: 0;
    }

    .badge {
        font-size: 0.72em;
        font-weight: 600;
        padding: 0.15rem 0.45rem;
        border-radius: var(--radius-pill);
        letter-spacing: 0.02em;
    }

    .badge-start {
        background: var(--success-bg);
        color: var(--success-text);
        border: 1px solid var(--success-border);
    }

    .badge-end {
        background: var(--violet-bg);
        color: var(--violet-text);
        border: 1px solid var(--violet-border);
    }

    .btn-item-remove {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border: 1px solid var(--border);
        border-radius: 50%;
        background: var(--bg-elevated);
        color: var(--text-faint);
        font-size: 1em;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
    }

    .btn-item-remove:hover {
        background: var(--danger-bg);
        color: var(--danger-text);
        border-color: var(--danger-border);
    }

    .empty-hint {
        font-size: 0.85em;
        color: var(--text-faint);
        margin: 0;
        text-align: center;
        padding: 0.75rem 0;
    }

    .save-row {
        display: flex;
        justify-content: flex-end;
    }

    .btn-save {
        padding: 0.4rem 1.1rem;
        border: none;
        border-radius: var(--radius-sm);
        background: var(--gradient-brand);
        color: #fff;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
        min-width: 7rem;
        transition: opacity 0.15s;
    }

    .btn-save:hover:not(:disabled) { opacity: 0.88; }
    .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-save.saved { background: var(--success-text); }
</style>
