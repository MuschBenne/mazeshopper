<script>
    import { templateContext } from '$lib/context/template-context.svelte';
    import { fade } from 'svelte/transition';
    import { fly } from 'svelte/transition';

    /**
     * @type {{
     *   onImport: (items: import('$lib/context/template-context.svelte').TemplateItem[]) => Promise<boolean>,
     *   onClose: () => void,
     *   pickerCategories: { id: string, name: string, color: string }[]
     * }}
     */
    let { onImport, onClose, pickerCategories } = $props();

    /** @type {string | null} */
    let previewId = $state(null);
    const previewTemplate = $derived(previewId ? templateContext.getTemplate(previewId) : null);

    // Which item IDs are selected for import (defaults to all)
    /** @type {Set<string>} */
    let selectedItems = $state(new Set());

    let importing = $state(false);

    /** @param {string} id */
    function selectTemplate(id) {
        previewId = id;
        const t = templateContext.getTemplate(id);
        selectedItems = new Set(t?.items.map(i => i.itemId) ?? []);
    }

    /** @param {string} itemId */
    function toggleItem(itemId) {
        const next = new Set(selectedItems);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        selectedItems = next;
    }

    function toggleAll() {
        if (!previewTemplate) return;
        if (selectedItems.size === previewTemplate.items.length) {
            selectedItems = new Set();
        } else {
            selectedItems = new Set(previewTemplate.items.map(i => i.itemId));
        }
    }

    async function doImport() {
        if (!previewTemplate || selectedItems.size === 0) return;
        const items = previewTemplate.items.filter(i => selectedItems.has(i.itemId));
        importing = true;
        const ok = await onImport(items);
        importing = false;
        if (ok) onClose();
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={(e) => e.target === e.currentTarget && onClose()} transition:fade={{ duration: 180 }}>
    <div class="modal" transition:fly={{ y: 32, duration: 220 }}>
        <div class="modal-header">
            <h2>{previewId ? 'Välj varor' : 'Välj mall'}</h2>
            <button class="btn-close" onclick={onClose}>×</button>
        </div>

        {#if !previewId}
            <!-- Template list -->
            {#if templateContext.templates.length === 0}
                <p class="empty">Inga mallar skapade ännu. Gå till <a href="/mallar">Mallar</a> för att skapa din första.</p>
            {:else}
                <ul class="template-list">
                    {#each templateContext.templates as t (t.id)}
                        <li>
                            <button class="template-row" onclick={() => selectTemplate(t.id)}>
                                <span class="t-name">{t.name}</span>
                                <span class="t-count">{t.items.length} {t.items.length === 1 ? 'vara' : 'varor'} →</span>
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}
        {:else if previewTemplate}
            <!-- Item selection -->
            <button class="btn-back" onclick={() => { previewId = null; selectedItems = new Set(); }}>← Tillbaka</button>
            <p class="template-title">{previewTemplate.name}</p>

            {#if previewTemplate.items.length === 0}
                <p class="empty">Den här mallen har inga varor.</p>
            {:else}
                <div class="select-all-row">
                    <button class="btn-toggle-all" onclick={toggleAll}>
                        {selectedItems.size === previewTemplate.items.length ? 'Avmarkera alla' : 'Markera alla'}
                    </button>
                    <span class="selected-count">{selectedItems.size} av {previewTemplate.items.length} valda</span>
                </div>
                <ul class="item-list">
                    {#each previewTemplate.items as item (item.itemId)}
                        {@const cat = pickerCategories.find(c => c.name === item.category)}
                        <li>
                            <label class="item-row">
                                <input type="checkbox" checked={selectedItems.has(item.itemId)} onchange={() => toggleItem(item.itemId)} />
                                <span class="item-name">{item.name}{item.spec ? ` – ${item.spec}` : ''}</span>
                                <span class="item-right">
                                    {#if item.quantity > 1}<span class="item-qty">×{item.quantity}</span>{/if}
                                    {#if item.category}
                                        <span class="item-cat-chip" style="--chip-color: {cat?.color ?? '#e2e8f0'}">{item.category}</span>
                                    {/if}
                                </span>
                            </label>
                        </li>
                    {/each}
                </ul>

                <button class="btn-import" onclick={doImport} disabled={importing || selectedItems.size === 0}>
                    {importing ? 'Importerar…' : `Importera ${selectedItems.size} ${selectedItems.size === 1 ? 'vara' : 'varor'}`}
                </button>
            {/if}
        {/if}
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        z-index: 200;
        padding: 0;
    }

    @media (min-width: 520px) {
        .overlay {
            align-items: center;
        }
    }

    .modal {
        background: var(--bg-surface);
        border-radius: 16px 16px 0 0;
        width: 100%;
        max-width: 520px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 -4px 32px rgba(0,0,0,0.15);
    }

    @media (min-width: 520px) {
        .modal {
            border-radius: 16px;
            max-height: 70vh;
        }
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem 0.75rem;
        border-bottom: 1px solid var(--border-subtle);
        flex-shrink: 0;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--text-primary);
    }

    .btn-close {
        background: none;
        border: none;
        font-size: 1.4rem;
        color: var(--text-faint);
        cursor: pointer;
        line-height: 1;
        padding: 0 0.25rem;
        min-height: unset;
    }

    .btn-close:hover { color: var(--text-secondary); }

    .template-list, .item-list {
        list-style: none;
        padding: 0;
        margin: 0;
        overflow-y: auto;
        flex: 1;
    }

    .template-list li {
        border-bottom: 1px solid var(--border-faint);
    }

    .template-list li:last-child { border-bottom: none; }

    .template-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.9rem 1.25rem;
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background 0.1s;
        min-height: unset;
        font-size: 0.95em;
    }

    .template-row:hover { background: var(--bg-hover); }

    .t-name { font-weight: 600; color: var(--text-primary); }

    .t-count {
        font-size: 0.85em;
        color: var(--text-faint);
    }

    .btn-back {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 0.9em;
        cursor: pointer;
        padding: 0.75rem 1.25rem 0;
        min-height: unset;
        text-align: left;
    }

    .btn-back:hover { color: var(--text-primary); }

    .template-title {
        font-weight: 700;
        color: var(--text-primary);
        margin: 0.25rem 1.25rem 0;
        font-size: 1em;
    }

    .select-all-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1.25rem;
        border-bottom: 1px solid var(--border-subtle);
        flex-shrink: 0;
    }

    .btn-toggle-all {
        background: none;
        border: none;
        color: #f97316;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        min-height: unset;
    }

    .btn-toggle-all:hover { color: #ea6c0a; }

    .selected-count {
        font-size: 0.82em;
        color: var(--text-faint);
    }

    .item-list {
        flex: 1;
        overflow-y: auto;
    }

    .item-list li {
        border-bottom: 1px solid var(--border-faint);
    }

    .item-list li:last-child { border-bottom: none; }

    .item-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.7rem 1.25rem;
        cursor: pointer;
        transition: background 0.1s;
        font-size: 0.9em;
    }

    .item-row:hover { background: var(--bg-hover); }

    .item-row input[type="checkbox"] {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        cursor: pointer;
    }

    .item-name {
        flex: 1;
        color: var(--text-primary);
        min-width: 0;
        word-break: break-word;
    }

    .item-right {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        flex-shrink: 0;
    }

    .item-qty {
        font-size: 0.78em;
        color: var(--text-muted);
        background: var(--bg-elevated);
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
    }

    .item-cat-chip {
        font-size: 0.75em;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: var(--chip-color, #e2e8f0);
        color: #374151;
        font-weight: 500;
        border: 1px solid color-mix(in srgb, var(--chip-color, #e2e8f0) 60%, var(--text-faint));
    }

    .btn-import {
        display: block;
        width: calc(100% - 2.5rem);
        margin: 0.75rem 1.25rem 1rem;
        padding: 0.7rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.95em;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
        flex-shrink: 0;
    }

    .btn-import:hover:not(:disabled) { opacity: 0.9; }
    .btn-import:disabled { opacity: 0.5; cursor: not-allowed; }

    .empty {
        text-align: center;
        color: var(--text-faint);
        font-size: 0.9em;
        padding: 2rem 1.25rem;
        margin: 0;
    }

    .empty a { color: #f97316; }
</style>
