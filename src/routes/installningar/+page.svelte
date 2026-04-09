<script>
    import { settingContext } from "$lib/context/setting-context.svelte";

    let newCategory = $state('');
    let editMode = $state(false);

    function addCategory() {
        settingContext.addCategory(newCategory);
        newCategory = '';
    }
</script>

<h1>Inställningar</h1>

<div class="category-list">
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
                <span>{category.name}</span>
            </li>
        {/each}
    </ul>

    {#if editMode}
        <div class="add-row">
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

<style>
    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .section-header h2 {
        margin: 0;
    }

    .btn-edit {
        padding: 0.3rem 0.8rem;
        border-radius: 5px;
        border: 1px solid #d1d5db;
        background: #fff;
        cursor: pointer;
        font-size: 0.9em;
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
        gap: 0.5rem;
        padding: 0.4rem 0;
        border-bottom: 1px solid #f3f4f6;
    }

    .btn-remove {
        width: 1.4rem;
        height: 1.4rem;
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
    }

    .btn-remove:hover {
        background: #b91c1c;
    }

    .add-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .add-row input {
        flex: 1;
    }

    .btn-reset {
        font-size: 0.85em;
        color: #6b7280;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
    }

    .btn-reset:hover {
        color: #374151;
    }
</style>
