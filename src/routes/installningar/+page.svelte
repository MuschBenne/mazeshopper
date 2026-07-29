<svelte:head><title>Inställningar – MazeShopper</title></svelte:head>

<script>
    // Settings page — lets the user manage the category palette, email address and account.
    import { categoryContext } from "$lib/context/category-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { themeContext } from "$lib/context/theme-context.svelte";
    import { goto } from '$app/navigation';

    let emailInput = $state('');
    let emailStatus = $state(/** @type {'idle'|'saving'|'ok'|'error'} */ ('idle'));
    let emailError = $state('');

    let deleteConfirm = $state(false);
    let deleteStatus = $state(/** @type {'idle'|'deleting'|'error'} */ ('idle'));

    // Kategoripaletten är platt. Gruppen är bara en etikett som filtrerar
    // väljaren och varuhusredigeraren — den refereras inte från någon lista,
    // något varuhus eller någon mall, så den kan aldrig blockera en borttagning.
    let categoryEditMode = $state(false);
    let newCatName = $state('');
    let newCatColor = $state('#e2e8f0');
    let newCatGroup = $state('');

    /** @type {string | null} */
    let filterGroup = $state(null);

    /** @type {string | null} */
    let renamingCatId = $state(null);
    let renameValue = $state('');

    const shownCategories = $derived(
        filterGroup === null
            ? categoryContext.categories
            : categoryContext.categories.filter(c => c.group === filterGroup)
    );

    async function addCategory() {
        if (!newCatName.trim()) return;
        const created = await categoryContext.addCategory(
            newCatName,
            newCatGroup.trim() || filterGroup,
            newCatColor
        );
        if (created) {
            newCatName = '';
            newCatColor = '#e2e8f0';
        }
    }

    /** @param {{ id: string, name: string }} cat */
    function startRename(cat) {
        renamingCatId = cat.id;
        renameValue = cat.name;
    }

    async function confirmRename() {
        if (!renamingCatId || !renameValue.trim()) return;
        // Namnbytet skrivs igenom till varor, mallar och varuhusrutter på
        // servern — namnet är det enda som binder ihop dem.
        await categoryContext.updateCategory(renamingCatId, { name: renameValue.trim() });
        renamingCatId = null;
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
            <button class="btn-edit" class:active={categoryEditMode} onclick={() => categoryEditMode = !categoryEditMode}>
                {categoryEditMode ? 'Klar' : 'Ändra'}
            </button>
        </div>

        {#if categoryContext.groups.length > 0}
            <div class="group-filter">
                <button class="group-chip" class:selected={filterGroup === null} onclick={() => filterGroup = null}>Alla</button>
                {#each categoryContext.groups as group}
                    <button class="group-chip" class:selected={filterGroup === group} onclick={() => filterGroup = group}>{group}</button>
                {/each}
            </div>
        {/if}

        {#if shownCategories.length > 0}
            <ul class="cat-list">
                {#each shownCategories as cat (cat.id)}
                    <li class="cat-item">
                        {#if categoryEditMode}
                            <button class="btn-remove" onclick={() => categoryContext.removeCategory(cat.id)} aria-label="Ta bort {cat.name}">−</button>
                            <input
                                type="color"
                                class="color-input"
                                value={cat.color}
                                oninput={(e) => categoryContext.updateCategory(cat.id, { color: /** @type {HTMLInputElement} */ (e.target).value })}
                                title="Välj färg"
                            />
                        {:else}
                            <span class="dot" style:background={cat.color}></span>
                        {/if}

                        {#if renamingCatId === cat.id}
                            <input
                                class="rename-input"
                                bind:value={renameValue}
                                onkeydown={(e) => { if (e.key === 'Enter') confirmRename(); else if (e.key === 'Escape') renamingCatId = null; }}
                            />
                            <button class="btn-sm btn-sm--primary" onclick={confirmRename}>Spara</button>
                            <button class="btn-sm" onclick={() => renamingCatId = null}>Avbryt</button>
                        {:else}
                            <span class="category-name">{cat.name}</span>
                            {#if categoryEditMode}
                                <select
                                    class="group-select"
                                    aria-label="Grupp för {cat.name}"
                                    value={cat.group ?? ''}
                                    onchange={(e) => categoryContext.updateCategory(cat.id, { group: e.currentTarget.value || null })}
                                >
                                    <option value="">Ingen grupp</option>
                                    {#each categoryContext.groups as group}
                                        <option value={group}>{group}</option>
                                    {/each}
                                    {#if newCatGroup.trim() && !categoryContext.groups.includes(newCatGroup.trim())}
                                        <option value={newCatGroup.trim()}>{newCatGroup.trim()} (ny)</option>
                                    {/if}
                                </select>
                                <button class="btn-sm" onclick={() => startRename(cat)}>Byt namn</button>
                            {:else if cat.group}
                                <span class="cat-group-badge">{cat.group}</span>
                            {/if}
                        {/if}
                    </li>
                {/each}
            </ul>
        {:else}
            <p class="cat-empty">Inga kategorier här än — lägg till en nedan.</p>
        {/if}

        {#if categoryEditMode}
            <div class="add-row">
                <input
                    type="color"
                    class="color-input"
                    bind:value={newCatColor}
                    title="Välj färg för ny kategori"
                />
                <input
                    type="text"
                    placeholder="Ny kategori"
                    bind:value={newCatName}
                    onkeydown={(e) => e.key === 'Enter' && addCategory()}
                />
                <input
                    type="text"
                    class="group-input"
                    placeholder="Grupp (valfritt)"
                    bind:value={newCatGroup}
                    onkeydown={(e) => e.key === 'Enter' && addCategory()}
                />
                <button onclick={addCategory}>Lägg till</button>
            </div>
            <p class="cat-hint">
                Grupper filtrerar bara vilka kategorier som visas — de påverkar ingen lista och kan ändras när som helst.
                Skriv ett nytt gruppnamn i fältet ovan så går det att välja i listorna här.
                Att ta bort en kategori tar inte bort några varor — de hamnar under "Utan kategori".
            </p>
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

    <div class="card">
        <h2>Tema</h2>
        <p class="theme-desc">Välj om appen ska följa enhetens inställning eller alltid visas i ljust eller mörkt läge.</p>
        <div class="theme-toggle" role="group" aria-label="Välj tema">
            {#each [['system', 'System'], ['light', 'Ljust'], ['dark', 'Mörkt']] as [val, label]}
                <button
                    class="theme-btn"
                    class:active={themeContext.theme === val}
                    onclick={() => themeContext.set(/** @type {'system'|'light'|'dark'} */ (val))}
                >{label}</button>
            {/each}
        </div>
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
    h1 { margin: 0; font-size: 1.5rem; }

    .subtitle {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.9em;
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

    /* Profile grid (list view) */





    /* Profile detail view */






    .btn-sm {
        padding: 0.2rem 0.55rem;
        border: 1px solid var(--border-input);
        border-radius: 5px;
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: 0.8em;
        cursor: pointer;
        white-space: nowrap;
        min-height: unset;
    }

    .btn-sm:hover { background: var(--bg-elevated); }

    .btn-sm--primary {
        background: var(--gradient-brand);
        color: #fff;
        border-color: transparent;
    }

    .btn-sm--primary:hover { opacity: 0.9; }


    .rename-input {
        flex: 1;
        padding: 0.2rem 0.4rem;
        border: 1px solid var(--border-input);
        border-radius: 5px;
        font-size: 0.95em;
        background: var(--bg-surface);
        color: var(--text-primary);
        outline: none;
        min-width: 0;
    }

    .rename-input:focus { border-color: var(--color-primary); }



    .cat-list {
        list-style: none;
        padding: 0;
        margin: 0 0 0.5rem;
    }

    .cat-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0;
        border-bottom: 1px solid var(--border-faint);
        font-size: 0.9em;
    }

    .cat-item:last-child { border-bottom: none; }

    .group-filter {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 0.25rem;
    }

    .group-chip {
        padding: 0.3rem 0.7rem;
        border: 1px solid var(--border-input);
        border-radius: 999px;
        background: var(--bg-surface);
        color: var(--text-muted);
        font-size: 0.82em;
        cursor: pointer;
        min-height: unset;
    }

    .group-chip:hover { background: var(--bg-elevated); }

    .group-chip.selected {
        background: var(--text-primary);
        border-color: var(--text-primary);
        color: var(--bg-surface);
        font-weight: 600;
    }

    .group-select {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--border-input);
        border-radius: 6px;
        background: var(--bg-surface);
        color: var(--text-muted);
        font-size: 0.8em;
        cursor: pointer;
        max-width: 9rem;
    }

    .cat-group-badge {
        font-size: 0.72em;
        color: var(--text-muted);
        background: var(--bg-elevated);
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
        white-space: nowrap;
    }

    .group-input { max-width: 10rem; }

    .cat-hint {
        margin: 0;
        font-size: 0.8em;
        color: var(--text-faint);
        line-height: 1.5;
    }

    .cat-empty {
        font-size: 0.85em;
        color: var(--text-faint);
        margin: 0 0 0.5rem;
        font-style: italic;
    }




    .btn-edit {
        padding: 0.35rem 0.9rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-input);
        background: var(--bg-surface);
        color: var(--text-secondary);
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
        border-radius: var(--radius-sm);
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
        border-radius: var(--radius-sm);
        background: var(--bg-elevated);
        cursor: pointer;
        white-space: nowrap;
    }

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
        border-radius: var(--radius-md);
        font-size: 0.95em;
        outline: none;
        background: var(--bg-surface);
        color: var(--text-primary);
    }
    .email-row input:focus { border-color: var(--color-primary); }

    .email-row button {
        padding: 0.6rem 1rem;
        background: var(--gradient-brand);
        color: #fff;
        border: none;
        border-radius: var(--radius-md);
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
        border-radius: var(--radius-md);
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
        border-radius: var(--radius-md);
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
        border-radius: var(--radius-md);
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
        border-radius: var(--radius-md);
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

    .theme-desc {
        margin: 0 0 0.85rem;
        font-size: 0.88em;
        color: var(--text-muted);
        line-height: 1.5;
    }

    .theme-toggle {
        display: flex;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-md);
        overflow: hidden;
        width: fit-content;
    }

    .theme-btn {
        padding: 0.45rem 1.1rem;
        border: none;
        border-right: 1px solid var(--border-input);
        background: var(--bg-surface);
        color: var(--text-muted);
        font-size: 0.9em;
        font-weight: 500;
        cursor: pointer;
        min-height: unset;
        transition: background 0.12s, color 0.12s;
    }

    .theme-btn:last-child { border-right: none; }

    .theme-btn:hover:not(.active) {
        background: var(--bg-elevated);
        color: var(--text-secondary);
    }

    .theme-btn.active {
        background: var(--color-primary);
        color: #fff;
        font-weight: 600;
    }
</style>
