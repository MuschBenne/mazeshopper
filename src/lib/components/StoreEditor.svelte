<script>
    import { settingContext } from "$lib/context/setting-context.svelte";

    /**
     * @typedef {{x: number, y: number}} Point
     */

    let { store, onSave } = $props();

    const W = 620;
    const H = 400;
    const SW = 118;  // square width
    const SH = 50;   // square height
    const COLS = 4;
    const COL_GAP = 148;
    const ROW_GAP = 80;
    const PAD = 14;

    /** @type {SVGSVGElement | null} */
    let svgEl = $state(null);

    /** @type {{[name: string]: Point}} */
    let positions = $state({});
    /** @type {string[]} */
    let route = $state([]);
    /** @type {'move' | 'route'} */
    let mode = $state('move');

    // Move-mode drag state
    /** @type {string | null} */
    let dragCat = $state(null);
    let dragOff = $state({ x: 0, y: 0 });

    // Route-drawing state
    let isDrawing = $state(false);
    /** @type {Point[]} */
    let drawPts = $state([]);
    /** @type {string[]} */
    let pendingRoute = $state([]);
    /** @type {Point | null} */
    let lastPt = $state(null);

    $effect(() => {
        const cats = settingContext.categories;
        const storedPos = store.positions ?? {};
        const storedOrder = store.categoryOrder ?? {};

        const defaultPos = Object.fromEntries(cats.map((cat, i) => [
            cat.name,
            { x: PAD + (i % COLS) * COL_GAP, y: PAD + Math.floor(i / COLS) * ROW_GAP }
        ]));

        positions = { ...defaultPos, ...storedPos };

        route = cats
            .filter(c => c.name in storedOrder)
            .sort((a, b) => storedOrder[a.name] - storedOrder[b.name])
            .map(c => c.name);
    });

    /** @param {MouseEvent} e @returns {Point} */
    function svgPoint(e) {
        const rect = /** @type {SVGSVGElement} */ (svgEl).getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    /** @param {number} px @param {number} py @returns {string | null} */
    function catNameAt(px, py) {
        const hit = settingContext.categories.find(cat => {
            const p = positions[cat.name];
            return p && px >= p.x && px <= p.x + SW && py >= p.y && py <= p.y + SH;
        });
        return hit?.name ?? null;
    }

    /**
     * Sample along segment to find categories even when mouse moves fast.
     * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
     */
    function checkSegment(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.ceil(dist / 8));
        const added = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const name = catNameAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
            if (name && !pendingRoute.includes(name) && !added.includes(name)) {
                added.push(name);
            }
        }
        if (added.length > 0) pendingRoute = [...pendingRoute, ...added];
    }

    /** @param {MouseEvent} e */
    function onMouseDown(e) {
        if (!svgEl) return;
        const pt = svgPoint(e);

        if (mode === 'move') {
            const name = catNameAt(pt.x, pt.y);
            if (name) {
                e.preventDefault();
                dragCat = name;
                const p = positions[name];
                dragOff = { x: pt.x - p.x, y: pt.y - p.y };
            }
        } else {
            e.preventDefault();
            isDrawing = true;
            drawPts = [pt];
            pendingRoute = [];
            lastPt = pt;
            const name = catNameAt(pt.x, pt.y);
            if (name) pendingRoute = [name];
        }
    }

    /** @param {MouseEvent} e */
    function onMouseMove(e) {
        if (!svgEl) return;
        const pt = svgPoint(e);

        if (mode === 'move' && dragCat) {
            positions = {
                ...positions,
                [dragCat]: {
                    x: Math.max(0, Math.min(W - SW, pt.x - dragOff.x)),
                    y: Math.max(0, Math.min(H - SH, pt.y - dragOff.y))
                }
            };
        }

        if (mode === 'route' && isDrawing) {
            if (lastPt) checkSegment(lastPt.x, lastPt.y, pt.x, pt.y);
            drawPts = [...drawPts, pt];
            lastPt = pt;
        }
    }

    function onMouseUp() {
        if (mode === 'move') {
            dragCat = null;
        }
        if (mode === 'route' && isDrawing) {
            isDrawing = false;
            if (pendingRoute.length > 0) route = pendingRoute;
            drawPts = [];
            pendingRoute = [];
            lastPt = null;
        }
    }

    const routeCenters = $derived(
        route
            .map(name => {
                const p = positions[name];
                return p ? { x: p.x + SW / 2, y: p.y + SH / 2 } : null;
            })
            .filter(/** @param {any} p */ p => p !== null)
    );

    const routePoly = $derived(routeCenters.map(p => `${p.x},${p.y}`).join(' '));
    const drawPoly  = $derived(drawPts.map(p => `${p.x},${p.y}`).join(' '));

    function save() {
        onSave({ positions: { ...positions }, route: [...route] });
    }
</script>

<div class="editor">
    <div class="toolbar">
        <button class:active={mode === 'move'} onclick={() => mode = 'move'}>Flytta rutor</button>
        <button class:active={mode === 'route'} onclick={() => mode = 'route'}>Rita rutt</button>
        <button onclick={() => { route = []; }} disabled={route.length === 0}>Rensa rutt</button>
        <button class="btn-save" onclick={save}>Spara layout</button>
    </div>

    <p class="hint">
        {#if mode === 'move'}
            Dra kategorirutorna för att spegla avdelningarnas placering i butiken.
        {:else}
            Håll nere musknappen och dra en linje genom rutorna i den ordning du handlar.
        {/if}
    </p>

    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg
        bind:this={svgEl}
        width={W}
        height={H}
        class="canvas"
        class:crosshair={mode === 'route'}
        role="img"
        aria-label="Varuhus layout-editor"
        onmousedown={onMouseDown}
        onmousemove={onMouseMove}
        onmouseup={onMouseUp}
        onmouseleave={onMouseUp}
    >
        <!-- Canvas background -->
        <rect width={W} height={H} fill="#f8fafc" rx="4" />

        <!-- Saved route line -->
        {#if routeCenters.length > 1}
            <polyline
                points={routePoly}
                fill="none"
                stroke="#3b82f6"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.55"
            />
            <!-- Arrowhead at end of route -->
            {@const last = routeCenters[routeCenters.length - 1]}
            {@const prev = routeCenters[routeCenters.length - 2]}
            {@const angle = Math.atan2(last.y - prev.y, last.x - prev.x) * 180 / Math.PI}
            <polygon
                points="-9,-5 9,0 -9,5"
                transform={`translate(${last.x},${last.y}) rotate(${angle})`}
                fill="#3b82f6"
                opacity="0.75"
            />
        {/if}

        <!-- In-progress drawing line -->
        {#if isDrawing && drawPts.length > 1}
            <polyline
                points={drawPoly}
                fill="none"
                stroke="#f97316"
                stroke-width="2"
                stroke-dasharray="7,4"
                stroke-linecap="round"
                opacity="0.7"
            />
        {/if}

        <!-- Category squares -->
        {#each settingContext.categories as cat}
            {@const pos = positions[cat.name]}
            {#if pos}
                {@const routeIdx   = route.indexOf(cat.name)}
                {@const isPending  = pendingRoute.includes(cat.name)}
                {@const inRoute    = routeIdx >= 0}
                {@const isGrabbing = dragCat === cat.name}

                <g
                    transform={`translate(${pos.x},${pos.y})`}
                    style:cursor={mode === 'move' ? (isGrabbing ? 'grabbing' : 'grab') : 'crosshair'}
                >
                    <rect
                        width={SW}
                        height={SH}
                        rx="8"
                        fill={isPending ? '#fff7ed' : inRoute ? '#eff6ff' : '#ffffff'}
                        stroke={isPending ? '#f97316' : inRoute ? '#3b82f6' : '#d1d5db'}
                        stroke-width={isPending || inRoute ? 2 : 1}
                    />
                    <text
                        x={SW / 2}
                        y={SH / 2}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        font-size="13"
                        font-family="system-ui, sans-serif"
                        fill="#374151"
                        pointer-events="none"
                        style:user-select="none"
                    >
                        {cat.name.length > 15 ? cat.name.slice(0, 14) + '…' : cat.name}
                    </text>

                    {#if inRoute}
                        <circle cx={SW - 14} cy={14} r={11} fill="#3b82f6" />
                        <text
                            x={SW - 14}
                            y={14}
                            text-anchor="middle"
                            dominant-baseline="middle"
                            font-size="11"
                            font-weight="bold"
                            font-family="system-ui, sans-serif"
                            fill="white"
                            pointer-events="none"
                            style:user-select="none"
                        >{routeIdx + 1}</text>
                    {/if}
                </g>
            {/if}
        {/each}
    </svg>
</div>

<style>
    .editor {
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
    }

    .toolbar {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.4rem;
        align-items: center;
    }

    .toolbar button {
        padding: 0.3rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 5px;
        background: #fff;
        cursor: pointer;
        font-size: 0.9em;
    }

    .toolbar button:hover:not(:disabled) {
        background: #f3f4f6;
    }

    .toolbar button.active {
        background: #3b82f6;
        color: #fff;
        border-color: #3b82f6;
    }

    .toolbar button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .btn-save {
        margin-left: auto;
        background: #16a34a !important;
        color: #fff !important;
        border-color: #16a34a !important;
    }

    .hint {
        font-size: 0.82em;
        color: #6b7280;
        margin: 0 0 0.5rem;
    }

    .canvas {
        display: block;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        max-width: 100%;
        user-select: none;
    }

    .canvas.crosshair {
        cursor: crosshair;
    }
</style>
