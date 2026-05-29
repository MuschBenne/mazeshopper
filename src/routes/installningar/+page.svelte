<svelte:head><title>Inställningar – MazeShopper</title></svelte:head>

<script>
    // Settings page — lets the user manage list profiles, email address and account.
    import { listprofileContext } from "$lib/context/listprofile-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { themeContext } from "$lib/context/theme-context.svelte";
    import { goto } from '$app/navigation';

    let emailInput = $state('');
    let emailStatus = $state(/** @type {'idle'|'saving'|'ok'|'error'} */ ('idle'));
    let emailError = $state('');

    let deleteConfirm = $state(false);
    let deleteStatus = $state(/** @type {'idle'|'deleting'|'error'} */ ('idle'));

    // Profile management state
    /** @type {string | null} */
    let expandedProfileId = $state(null);
    /** @type {string | null} */
    let renamingProfileId = $state(null);
    let renameValue = $state('');
    let newProfileName = $state('');
    let showNewProfileForm = $state(false);

    // Per-expanded-profile category editing
    let categoryEditMode = $state(false);
    let newCatName = $state('');
    let newCatColor = $state('#e2e8f0');

    $effect(() => {
        // Read expandedProfileId so this effect re-runs when it changes.
        // eslint-disable-next-line no-unused-expressions
        expandedProfileId;
        categoryEditMode = false;
        newCatName = '';
        newCatColor = '#e2e8f0';
    });

    /** @param {string} id */
    function toggleExpand(id) {
        if (expandedProfileId === id) {
            expandedProfileId = null;
        } else {
            expandedProfileId = id;
            renamingProfileId = null;
        }
    }

    /** @param {string} id */
    function startRename(id) {
        const profile = listprofileContext.getProfile(id);
        if (!profile) return;
        renamingProfileId = id;
        renameValue = profile.name;
    }

    async function confirmRename() {
        if (!renamingProfileId || !renameValue.trim()) return;
        await listprofileContext.renameProfile(renamingProfileId, renameValue.trim());
        renamingProfileId = null;
    }

    async function createProfile() {
        if (!newProfileName.trim()) return;
        const profile = await listprofileContext.createProfile(newProfileName.trim());
        if (profile) {
            newProfileName = '';
            showNewProfileForm = false;
            expandedProfileId = profile.id;
        }
    }

    async function addCategoryToProfile() {
        if (!expandedProfileId || !newCatName.trim()) return;
        await listprofileContext.addCategory(expandedProfileId, newCatName, newCatColor);
        newCatName = '';
        newCatColor = '#e2e8f0';
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
    <p class="subtitle">Hantera listprofiler, e-postadress och ditt konto.</p>

    <div class="card">
        <div class="section-header">
            <h2>Listprofiler</h2>
            <button class="btn-edit" onclick={() => { showNewProfileForm = !showNewProfileForm; }}>
                {showNewProfileForm ? 'Avbryt' : '+ Ny profil'}
            </button>
        </div>

        {#if showNewProfileForm}
            <div class="add-row new-profile-row">
                <input
                    type="text"
                    placeholder="Profilnamn"
                    bind:value={newProfileName}
                    onkeydown={(e) => e.key === 'Enter' && createProfile()}
                />
                <button onclick={createProfile}>Skapa</button>
            </div>
        {/if}

        <ul class="profile-list">
            {#each listprofileContext.profiles as profile}
                {@const isExpanded = expandedProfileId === profile.id}
                <li class="profile-item">
                    <div class="profile-header">
                        <button class="profile-toggle" onclick={() => toggleExpand(profile.id)}>
                            <span class="toggle-arrow">{isExpanded ? '▼' : '▶'}</span>
                            {#if renamingProfileId === profile.id}
                                <input
                                    class="rename-input"
                                    bind:value={renameValue}
                                    onkeydown={(e) => { if (e.key === 'Enter') confirmRename(); else if (e.key === 'Escape') renamingProfileId = null; }}
                                    onclick={(e) => e.stopPropagation()}
                                />
                            {:else}
                                <span class="profile-name">{profile.name}</span>
                                <span class="profile-count">{profile.categories.length} kat.</span>
                            {/if}
                        </button>
                        <div class="profile-actions">
                            {#if renamingProfileId === profile.id}
                                <button class="btn-sm btn-sm--primary" onclick={confirmRename}>Spara</button>
                                <button class="btn-sm" onclick={() => renamingProfileId = null}>Avbryt</button>
                            {:else}
                                <button class="btn-sm" onclick={() => startRename(profile.id)}>Byt namn</button>
                                <button class="btn-sm btn-sm--danger" onclick={() => listprofileContext.deleteProfile(profile.id)}>Ta bort</button>
                            {/if}
                        </div>
                    </div>

                    {#if isExpanded}
                        <div class="profile-body">
                            <div class="cat-section-header">
                                <span class="cat-section-title">Kategorier</span>
                                <button class="btn-edit" class:active={categoryEditMode} onclick={() => categoryEditMode = !categoryEditMode}>
                                    {categoryEditMode ? 'Klar' : 'Ändra'}
                                </button>
                            </div>

                            {#if profile.categories.length > 0}
                                <ul class="cat-list">
                                    {#each profile.categories as cat}
                                        <li class="cat-item">
                                            {#if categoryEditMode}
                                                <button class="btn-remove" onclick={() => listprofileContext.removeCategory(profile.id, cat.id)} aria-label="Ta bort {cat.name}">−</button>
                                                <input
                                                    type="color"
                                                    class="color-input"
                                                    value={cat.color}
                                                    oninput={(e) => listprofileContext.updateCategory(profile.id, cat.id, { color: /** @type {HTMLInputElement} */ (e.target).value })}
                                                    title="Välj färg"
                                                />
                                            {:else}
                                                <span class="dot" style:background={cat.color}></span>
                                            {/if}
                                            <span class="category-name">{cat.name}</span>
                                        </li>
                                    {/each}
                                </ul>
                            {:else}
                                <p class="cat-empty">Inga kategorier än.</p>
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
                                        onkeydown={(e) => e.key === 'Enter' && addCategoryToProfile()}
                                    />
                                    <button onclick={addCategoryToProfile}>Lägg till</button>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </li>
            {/each}
        </ul>
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

    /* Profile list */
    .profile-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .profile-item {
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
    }

    .profile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.6rem 0.75rem;
        background: var(--bg-elevated);
    }

    .profile-toggle {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex: 1;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        padding: 0;
        font-size: 0.95em;
        font-weight: 600;
        color: var(--text-primary);
        min-height: unset;
    }

    .toggle-arrow {
        font-size: 0.6em;
        color: var(--text-faint);
        flex-shrink: 0;
    }

    .profile-name { flex: 1; min-width: 0; }

    .profile-count {
        font-size: 0.78em;
        font-weight: 400;
        color: var(--text-faint);
        white-space: nowrap;
    }

    .profile-actions {
        display: flex;
        gap: 0.3rem;
        flex-shrink: 0;
    }

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
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border-color: transparent;
    }

    .btn-sm--primary:hover { opacity: 0.9; }

    .btn-sm--danger { color: var(--danger-text); border-color: var(--danger-border); }
    .btn-sm--danger:hover { background: var(--danger-bg); }

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

    .rename-input:focus { border-color: #f97316; }

    .profile-body {
        padding: 0.75rem;
        border-top: 1px solid var(--border-subtle);
        background: var(--bg-surface);
    }

    .cat-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .cat-section-title {
        font-size: 0.82em;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

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

    .cat-empty {
        font-size: 0.85em;
        color: var(--text-faint);
        margin: 0 0 0.5rem;
        font-style: italic;
    }

    .new-profile-row {
        margin-bottom: 0.75rem;
    }

    .btn-edit {
        padding: 0.35rem 0.9rem;
        border-radius: 6px;
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

    .theme-desc {
        margin: 0 0 0.85rem;
        font-size: 0.88em;
        color: var(--text-muted);
        line-height: 1.5;
    }

    .theme-toggle {
        display: flex;
        border: 1px solid var(--border-input);
        border-radius: 8px;
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
