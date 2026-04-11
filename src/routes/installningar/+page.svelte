<script>
    import { settingContext } from "$lib/context/setting-context.svelte";

    let newCategory = $state('');
    let newColor = $state('#e2e8f0');
    let editMode = $state(false);

    async function addCategory() {
        await settingContext.addCategory(newCategory, newColor);
        newCategory = '';
    }
</script>

<div class="page">
    <h1>Inställningar</h1>

    <div class="card">
        <div class="section-header">
            <h2>Kategorier</h2>
            <button class="btn-edit" class:active={editMode} onclick={() => editMode = !editMode}>
                {editMode ? 'Klar' : 'Ändra kategorier'}
            </button>
        </div>

        <ul>
            {#each settingContext.categories as category, index}
                <li>
                    {#if editMode}
                        <button class="btn-remove" onclick={() => settingContext.removeCategory(index)} aria-label="Ta bort {category.name}">−</button>
                    {/if}
                    {#if editMode}
                        <input
                            type="color"
                            class="color-input"
                            value={category.color}
                            oninput={(e) => settingContext.updateCategoryColor(index, /** @type {HTMLInputElement} */ (e.target).value)}
                            title="Välj färg"
                        />
                    {:else}
                        <span class="dot" style:background={category.color}></span>
                    {/if}
                    <span>{category.name}</span>
                </li>
            {/each}
        </ul>

        {#if editMode}
            <div class="add-row">
                <input
                    type="color"
                    class="color-input"
                    bind:value={newColor}
                    title="Välj färg för ny kategori"
                />
                <input
                    type="text"
                    placeholder="Ny kategori"
                    bind:value={newCategory}
                    onkeydown={(e) => e.key === 'Enter' && addCategory()}
                />
                <button onclick={addCategory}>Lägg till</button>
            </div>
            <button class="btn-reset" onclick={() => settingContext.resetCategories()}>Återställ till standard</button>
        {/if}
    </div>
</div>

<style>
    .page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
    }

    .card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        padding: 1.25rem;
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
        gap: 1rem;
    }

    .section-header h2 {
        margin: 0;
        font-size: 1.1rem;
    }

    .btn-edit {
        padding: 0.35rem 0.9rem;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: #fff;
        cursor: pointer;
        font-size: 0.9em;
        white-space: nowrap;
    }

    .btn-edit.active {
        background: #f3f4f6;
        border-color: #9ca3af;
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0 0 1rem;
    }

    li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: 0.95em;
    }

    li:last-child { border-bottom: none; }

    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0,0,0,0.1);
    }

    .color-input {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        padding: 1px;
        cursor: pointer;
        flex-shrink: 0;
        background: none;
    }

    .color-input:hover { border-color: #9ca3af; }

    .btn-remove {
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
        border: none;
        background: #dc2626;
        color: #fff;
        font-size: 1.1em;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        min-height: unset;
    }

    .btn-remove:hover { background: #b91c1c; }

    .add-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        align-items: center;
    }

    .add-row input[type="text"] { flex: 1; }

    .add-row button {
        padding: 0.4rem 0.9rem;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: #f9fafb;
        cursor: pointer;
        white-space: nowrap;
    }

    .btn-reset {
        font-size: 0.85em;
        color: #6b7280;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
        min-height: unset;
    }

    .btn-reset:hover { color: #374151; }
</style>
