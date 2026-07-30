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

    /**
     * Flyttar en rad i rutten. Används av både dragningen och pilknapparna, så
     * de två sätten inte kan hamna ur synk med varandra.
     * @param {number} from
     * @param {number} to
     */
    function move(from, to) {
        if (to < 0 || to >= route.length || from === to) return;
        const next = [...route];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        route = next;
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
        move(dragIndex, index);
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
        if (touchDragIndex !== null && touchOverIndex !== null) {
            move(touchDragIndex, touchOverIndex);
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
                    >
                        <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
                            <circle cx="3" cy="3" r="1.4" /><circle cx="9" cy="3" r="1.4" />
                            <circle cx="3" cy="9" r="1.4" /><circle cx="9" cy="9" r="1.4" />
                            <circle cx="3" cy="15" r="1.4" /><circle cx="9" cy="15" r="1.4" />
                        </svg>
                    </span>
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
                    <!-- Pilknapparna är den pålitliga vägen: de kräver ingen
                         sikte, fungerar med tangentbord och läses upp korrekt.
                         Dragningen finns kvar för den som föredrar den. -->
                    <div class="move-buttons">
                        <button
                            class="btn-move"
                            onclick={() => move(i, i - 1)}
                            disabled={isFirst}
                            aria-label="Flytta {name} uppåt"
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 9l4-4 4 4" />
                            </svg>
                        </button>
                        <button
                            class="btn-move"
                            onclick={() => move(i, i + 1)}
                            disabled={isLast}
                            aria-label="Flytta {name} nedåt"
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 5l4 4 4-4" />
                            </svg>
                        </button>
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

    /* Greppet var ett tecken med 4px marginal — runt 20px träffyta, mot
       rekommenderade 44. Ikonen är liten, men ytan runt den är full storlek. */
    .drag-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        min-height: 44px;
        margin: -0.55rem 0 -0.55rem -0.65rem;
        color: var(--text-faint);
        cursor: grab;
        flex-shrink: 0;
        touch-action: none;
    }

    .drag-handle:active { cursor: grabbing; }

    .move-buttons {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        margin: -0.35rem 0;
    }

    .btn-move {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 26px;
        min-height: 26px;
        padding: 0;
        border: none;
        background: none;
        color: var(--text-muted);
        cursor: pointer;
        border-radius: var(--radius-sm);
    }

    .btn-move:hover:not(:disabled) {
        background: var(--bg-elevated);
        color: var(--text-primary);
    }

    .btn-move:disabled {
        opacity: 0.25;
        cursor: default;
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
