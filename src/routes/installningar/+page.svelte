<svelte:head><title>Inställningar – MazeShopper</title></svelte:head>

<script>
    // Settings page — lets the user manage their personal categories and email address.
    import { settingContext } from "$lib/context/setting-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { goto } from '$app/navigation';

    let newCategory = $state('');
    let newColor = $state('#e2e8f0');
    // Edit mode toggles the category list between view-only and edit (remove + recolor).
    let editMode = $state(false);

    let emailInput = $state('');
    let emailStatus = $state(/** @type {'idle'|'saving'|'ok'|'error'} */ ('idle'));
    let emailError = $state('');

    let deleteConfirm = $state(false);
    let deleteStatus = $state(/** @type {'idle'|'deleting'|'error'} */ ('idle'));

    async function addCategory() {
        await settingContext.addCategory(newCategory, newColor);
        newCategory = '';
    }

    async function deleteAccount() {
        deleteStatus = 'deleting';
        const result = await authContext.deleteAccount();
        if (result === 'ok') {
            goto('/');
        } else {
            deleteStatus = 'error';
        }
    }

    async function saveEmail() {
        emailStatus = 'saving';
        emailError = '';
        const result = await authContext.updateEmail(emailInput.trim());
        if (result === 'ok') {
            emailStatus = 'ok';
            emailInput = '';
        } else {
            emailStatus = 'error';
            // Map server error codes to user-friendly Swedish messages.
            emailError = result === 'email_taken' ? 'E-postadressen används redan av ett annat konto.' : 'Ogiltig e-postadress.';
        }
    }
</script>

<div class="page">
    <h1>Inställningar</h1>
    <p class="subtitle">Hantera kategorier, e-postadress och ditt konto.</p>

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
                    <span class="category-name">{category.name}</span>
                    {#if editMode}
                        <div class="move-buttons">
                            <button
                                class="btn-move"
                                onclick={() => settingContext.moveCategory(index, -1)}
                                disabled={index === 0}
                                aria-label="Flytta {category.name} uppåt"
                            >↑</button>
                            <button
                                class="btn-move"
                                onclick={() => settingContext.moveCategory(index, 1)}
                                disabled={index === settingContext.categories.length - 1}
                                aria-label="Flytta {category.name} nedåt"
                            >↓</button>
                        </div>
                    {/if}
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

    <div class="card">
        <h2>E-postadress</h2>
        {#if authContext.user?.email}
            <p class="email-current">Nuvarande: <strong>{authContext.user.email}</strong></p>
        {:else}
            <p class="email-missing">Ditt konto saknar e-postadress. Utan en kan du inte återställa ditt lösenord om du glömmer det.</p>
        {/if}
        <div class="email-row">
            <input
                type="email"
                placeholder={authContext.user?.email ? 'Ny e-postadress' : 'Lägg till e-postadress'}
                bind:value={emailInput}
                onkeydown={(e) => e.key === 'Enter' && emailInput.trim() && saveEmail()}
                disabled={emailStatus === 'saving'}
            />
            <button onclick={saveEmail} disabled={emailStatus === 'saving' || !emailInput.trim()}>
                {emailStatus === 'saving' ? 'Sparar...' : 'Spara'}
            </button>
        </div>
        {#if emailStatus === 'ok'}
            <p class="email-ok">E-postadressen sparades!</p>
        {:else if emailStatus === 'error'}
            <p class="email-err">{emailError}</p>
        {/if}
    </div>

    <div class="card">
        <h2>Min data</h2>
        <p class="export-desc">
            Ladda ner en kopia av all din data (listor, varuhus, kategorier) som en JSON-fil.
        </p>
        <a class="btn-export" href="/api/user/export" download>Exportera min data</a>
    </div>

    <div class="card danger-card">
        <h2>Fara-zon</h2>
        <p class="danger-desc">
            Raderar ditt konto permanent — alla listor du äger, varuhus och inställningar tas bort.
            Listor du delar med andra försvinner enbart för dig.
        </p>
        {#if !deleteConfirm}
            <button class="btn-danger" onclick={() => deleteConfirm = true}>
                Radera mitt konto
            </button>
        {:else}
            <div class="confirm-box">
                <p class="confirm-warning">Är du säker? Det går inte att ångra.</p>
                <div class="confirm-row">
                    <button class="btn-cancel" onclick={() => { deleteConfirm = false; deleteStatus = 'idle'; }} disabled={deleteStatus === 'deleting'}>
                        Avbryt
                    </button>
                    <button class="btn-danger-confirm" onclick={deleteAccount} disabled={deleteStatus === 'deleting'}>
                        {deleteStatus === 'deleting' ? 'Raderar...' : 'Ja, radera permanent'}
                    </button>
                </div>
                {#if deleteStatus === 'error'}
                    <p class="delete-err">Något gick fel. Försök igen.</p>
                {/if}
            </div>
        {/if}
        <p class="privacy-link-note">
            Läs vår <a href="/integritetspolicy" target="_blank">integritetspolicy</a> för information om hur vi hanterar dina uppgifter.
        </p>
    </div>
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
        border: 1px solid var(--border-input);
        background: var(--bg-surface);
        cursor: pointer;
        font-size: 0.9em;
        white-space: nowrap;
    }

    .btn-edit.active {
        background: var(--bg-elevated);
        border-color: var(--text-faint);
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
        border-bottom: 1px solid var(--border-subtle);
        font-size: 0.95em;
    }

    li:last-child { border-bottom: none; }

    .category-name { flex: 1; min-width: 0; }

    .move-buttons {
        display: flex;
        gap: 0.25rem;
        flex-shrink: 0;
    }

    .btn-move {
        width: 1.9rem;
        height: 1.9rem;
        border-radius: 6px;
        border: 1px solid var(--border-input);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: 0.9em;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        min-height: unset;
    }

    .btn-move:hover:not(:disabled) { background: var(--bg-elevated); border-color: var(--text-faint); }
    .btn-move:disabled { opacity: 0.3; cursor: default; }

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
        border: 1px solid var(--border-input);
        padding: 1px;
        cursor: pointer;
        flex-shrink: 0;
        background: none;
    }

    .color-input:hover { border-color: var(--text-faint); }

    .btn-remove {
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
        border: none;
        background: var(--danger-text);
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

    .btn-remove:hover { background: var(--danger-text-hover); }

    .add-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        align-items: center;
    }

    .add-row input[type="text"] { flex: 1; }

    .add-row button {
        padding: 0.4rem 0.9rem;
        border: 1px solid var(--border-input);
        border-radius: 6px;
        background: var(--bg-elevated);
        cursor: pointer;
        white-space: nowrap;
    }

    .btn-reset {
        font-size: 0.85em;
        color: var(--text-muted);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
        min-height: unset;
    }

    .btn-reset:hover { color: var(--text-secondary); }

    .card h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }

    .email-current, .email-missing {
        margin: 0 0 0.75rem;
        font-size: 0.9em;
    }
    .email-missing { color: var(--warning-text); }

    .email-row {
        display: flex;
        gap: 0.5rem;
    }

    .email-row input {
        flex: 1;
        padding: 0.6rem 0.9rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        background: var(--bg-surface);
        color: var(--text-primary);
    }
    .email-row input:focus { border-color: #f97316; }

    .email-row button {
        padding: 0.6rem 1rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
    }
    .email-row button:disabled { opacity: 0.5; cursor: default; }

    .email-ok { margin: 0.5rem 0 0; font-size: 0.9em; color: var(--success-text); }
    .email-err { margin: 0.5rem 0 0; font-size: 0.9em; color: var(--danger-text); }

    .export-desc {
        margin: 0 0 0.9rem;
        font-size: 0.88em;
        color: var(--text-muted);
        line-height: 1.5;
    }

    .btn-export {
        display: inline-block;
        padding: 0.5rem 1.1rem;
        background: var(--bg-surface);
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 500;
        color: var(--text-secondary);
        text-decoration: none;
        transition: background 0.15s;
    }

    .btn-export:hover { background: var(--bg-elevated); }

    .danger-card {
        border-color: var(--danger-border);
        margin-top: 0;
    }

    .danger-card h2 {
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
        color: var(--danger-text);
    }

    .danger-desc {
        margin: 0 0 1rem;
        font-size: 0.88em;
        color: var(--text-muted);
        line-height: 1.5;
    }

    .btn-danger {
        padding: 0.5rem 1.1rem;
        background: var(--bg-surface);
        border: 1px solid var(--danger-text);
        color: var(--danger-text);
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-danger:hover { background: var(--danger-bg); }

    .confirm-box {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .confirm-warning {
        margin: 0;
        font-size: 0.9em;
        font-weight: 600;
        color: var(--danger-text);
    }

    .confirm-row {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
    }

    .btn-cancel {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-input);
        background: var(--bg-surface);
        border-radius: 8px;
        font-size: 0.9em;
        cursor: pointer;
        color: var(--text-secondary);
    }

    .btn-cancel:hover { background: var(--bg-elevated); }
    .btn-cancel:disabled { opacity: 0.5; cursor: default; }

    .btn-danger-confirm {
        padding: 0.5rem 1.1rem;
        background: var(--danger-text);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-danger-confirm:hover { background: var(--danger-text-hover); }
    .btn-danger-confirm:disabled { opacity: 0.6; cursor: default; }

    .delete-err { margin: 0; font-size: 0.85em; color: var(--danger-text); }

    .privacy-link-note {
        margin: 0.9rem 0 0;
        font-size: 0.8em;
        color: var(--text-faint);
    }

    .privacy-link-note a {
        color: var(--text-faint);
        text-decoration: underline;
    }

    .privacy-link-note a:hover { color: var(--text-muted); }
</style>
