<script>
    import { authContext } from '$lib/context/auth-context.svelte';
    import { goto } from '$app/navigation';

    let mode = $state(/** @type {'login' | 'register'} */ ('login'));
    let username = $state('');
    let password = $state('');
    let email = $state('');
    let error = $state('');
    let ageConfirmed = $state(false);
    let showPassword = $state(false);
    let loading = $state(false);

    async function submit() {
        error = '';
        if (!username.trim() || !password) { error = 'Fyll i alla fält.'; return; }

        loading = true;
        try {
            if (mode === 'login') {
                const result = await authContext.login(username, password);
                if (result === 'invalid_credentials') { error = 'Felaktigt användarnamn eller lösenord.'; return; }
                if (result === 'too_many_attempts') { error = 'För många inloggningsförsök. Vänta 15 minuter och försök igen.'; return; }
            } else {
                if (username.trim().length < 2 || username.trim().length > 30) { error = 'Användarnamnet måste vara 2–30 tecken.'; return; }
                if (!email.trim()) { error = 'Fyll i din e-postadress.'; return; }
                if (password.length < 8 || !/[a-zA-ZåäöÅÄÖ]/.test(password) || !/[0-9]/.test(password)) {
                    error = 'Lösenordet måste vara minst 8 tecken och innehålla minst en bokstav och en siffra.'; return;
                }
                if (!ageConfirmed) { error = 'Du måste bekräfta att du är 16 år eller äldre.'; return; }
                const result = await authContext.register(username, password, email);
                if (result === 'taken') { error = 'Användarnamnet är redan taget.'; return; }
                if (result === 'email_taken') { error = 'E-postadressen används redan.'; return; }
                if (result === 'invalid_email') { error = 'Ogiltig e-postadress.'; return; }
                if (result === 'weak_password') { error = 'Lösenordet uppfyller inte kraven.'; return; }
            }
            goto('/inkopslista');
        } finally {
            loading = false;
        }
    }
</script>

<svelte:head><title>MazeShopper</title></svelte:head>

<div class="hero">
    <div class="hero-text">
        <h1 class="app-title">MazeShopper</h1>
        <p class="app-tagline">Din smarta inköpslista</p>
    </div>

    <div class="features">
        <div class="feature">
            <span class="feature-icon">🛒</span>
            <div>
                <strong>Handla smidigt</strong>
                <p>Aktivera handelsläget för en ren vy utan störande knappar — markera varor med ett tryck.</p>
            </div>
        </div>
        <div class="feature">
            <span class="feature-icon">🗺️</span>
            <div>
                <strong>Butiksanpassad ordning</strong>
                <p>Rita din rutt i varuhuset så sorteras listan automatiskt i den ordning du handlar.</p>
            </div>
        </div>
        <div class="feature">
            <span class="feature-icon">👥</span>
            <div>
                <strong>Dela med familjen</strong>
                <p>Bjud in andra användare till din lista — alla ser uppdateringar i realtid.</p>
            </div>
        </div>
    </div>

    <div class="auth-card">
        <div class="tabs">
            <button class:active={mode === 'login'} onclick={() => { mode = 'login'; error = ''; }}>Logga in</button>
            <button class:active={mode === 'register'} onclick={() => { mode = 'register'; error = ''; }}>Skapa konto</button>
        </div>

        <div class="fields">
            <input
                bind:value={username}
                placeholder="Användarnamn"
                autocomplete="username"
                onkeydown={(e) => e.key === 'Enter' && submit()}
            />
            {#if mode === 'register'}
                <input
                    bind:value={email}
                    type="email"
                    placeholder="E-postadress"
                    autocomplete="email"
                    onkeydown={(e) => e.key === 'Enter' && submit()}
                />
            {/if}
            <div class="pw-wrap">
                <input
                    bind:value={password}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Lösenord"
                    autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
                    onkeydown={(e) => e.key === 'Enter' && submit()}
                />
                <button type="button" class="pw-toggle" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}>
                    {#if showPassword}
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {/if}
                </button>
            </div>
            {#if error}
                <p class="error">{error}</p>
            {/if}
            <button class="btn-submit" onclick={submit} disabled={loading}>
                {#if loading}
                    <span class="spinner"></span>
                    {mode === 'login' ? 'Loggar in…' : 'Skapar konto…'}
                {:else}
                    {mode === 'login' ? 'Logga in' : 'Skapa konto'}
                {/if}
            </button>
            {#if mode === 'login'}
                <a class="forgot-link" href="/glomt-losenord">Glömt lösenordet?</a>
            {:else}
                <label class="age-check">
                    <input type="checkbox" bind:checked={ageConfirmed} />
                    Jag är 16 år eller äldre
                </label>
                <p class="policy-note">
                    Genom att skapa ett konto godkänner du vår
                    <a href="/integritetspolicy" target="_blank">integritetspolicy</a>
                    och våra <a href="/anvandardvillkor" target="_blank">användarvillkor</a>.
                </p>
            {/if}
        </div>
    </div>
</div>

<style>
    .hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 60px);
        gap: 2rem;
        padding: 2rem 1rem;
    }

    .hero-text {
        text-align: center;
    }

    .app-title {
        font-size: 3rem;
        font-weight: 800;
        margin: 0;
        letter-spacing: -1px;
        background: linear-gradient(135deg, #f97316, #c026d3);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .app-tagline {
        margin: 0.4rem 0 0;
        color: var(--text-muted);
        font-size: 1.1rem;
    }

    .features {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        width: 100%;
        max-width: 360px;
    }

    .feature {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.9rem 1rem;
        box-shadow: var(--shadow-card);
    }

    .feature-icon {
        font-size: 1.4rem;
        line-height: 1;
        flex-shrink: 0;
        margin-top: 0.1rem;
    }

    .feature strong {
        display: block;
        font-size: 0.92em;
        color: var(--text-primary);
        margin-bottom: 0.15rem;
    }

    .feature p {
        margin: 0;
        font-size: 0.82em;
        color: var(--text-muted);
        line-height: 1.4;
    }

    .auth-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: var(--shadow-modal);
        width: 100%;
        max-width: 360px;
        overflow: hidden;
    }

    .tabs {
        display: flex;
        border-bottom: 1px solid var(--border);
    }

    .tabs button {
        flex: 1;
        padding: 0.85rem;
        background: none;
        border: none;
        font-size: 0.95em;
        font-weight: 500;
        color: var(--text-faint);
        cursor: pointer;
        transition: color 0.15s;
    }

    .tabs button.active {
        color: var(--text-primary);
        border-bottom: 2px solid #f97316;
        margin-bottom: -1px;
    }

    .fields {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.5rem;
    }

    .fields input {
        padding: 0.65rem 0.9rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        width: 100%;
        box-sizing: border-box;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .fields input:focus {
        border-color: #f97316;
    }

    .pw-wrap {
        position: relative;
        display: flex;
        align-items: center;
    }

    .pw-wrap input {
        padding-right: 2.5rem;
    }

    .pw-toggle {
        position: absolute;
        right: 0.6rem;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        color: var(--text-faint);
        display: flex;
        align-items: center;
        line-height: 1;
    }

    .pw-toggle:hover {
        color: var(--text-muted);
    }

    .error {
        margin: 0;
        font-size: 0.85em;
        color: var(--danger-text);
    }

    .btn-submit {
        margin-top: 0.25rem;
        padding: 0.7rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 1em;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
    }

    .btn-submit:hover:not(:disabled) {
        opacity: 0.9;
    }

    .btn-submit:disabled {
        opacity: 0.75;
        cursor: not-allowed;
    }

    .btn-submit {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .spinner {
        width: 1em;
        height: 1em;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        flex-shrink: 0;
    }

    .forgot-link {
        text-align: center;
        font-size: 0.82em;
        color: var(--text-muted);
        text-decoration: none;
    }

    .forgot-link:hover {
        color: #f97316;
        text-decoration: underline;
    }

    .policy-note {
        margin: 0;
        text-align: center;
        font-size: 0.78em;
        color: var(--text-faint);
        line-height: 1.4;
    }

    .policy-note a {
        color: var(--text-faint);
        text-decoration: underline;
    }

    .policy-note a:hover { color: var(--text-muted); }

    .age-check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.88em;
        color: var(--text-secondary);
        cursor: pointer;
        user-select: none;
    }

    .age-check input[type="checkbox"] {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        flex-shrink: 0;
        accent-color: #f97316;
    }
</style>
