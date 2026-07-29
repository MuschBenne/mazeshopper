<svelte:head><title>Återställ lösenord – MazeShopper</title></svelte:head>

<script>
    import { authContext } from '$lib/context/auth-context.svelte';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';

    const token = $derived(page.url.searchParams.get('token') ?? '');

    let password = $state('');
    let passwordConfirm = $state('');
    let error = $state('');
    let loading = $state(false);
    let done = $state(false);
    let showPassword = $state(false);
    let showPasswordConfirm = $state(false);

    async function submit() {
        error = '';
        if (!password) { error = 'Fyll i ett nytt lösenord.'; return; }
        if (password.length < 8 || !/[a-zA-ZåäöÅÄÖ]/.test(password) || !/[0-9]/.test(password)) {
            error = 'Lösenordet måste vara minst 8 tecken och innehålla minst en bokstav och en siffra.'; return;
        }
        if (password !== passwordConfirm) { error = 'Lösenorden matchar inte.'; return; }

        loading = true;
        const result = await authContext.resetPassword(token, password);
        loading = false;

        if (result === 'ok') {
            done = true;
            setTimeout(() => goto('/'), 2500);
            return;
        }
        if (result === 'expired') { error = 'Länken har gått ut. Begär en ny återställningslänk.'; return; }
        if (result === 'too_short') { error = 'Lösenordet måste vara minst 8 tecken.'; return; }
        error = 'Ogiltig eller redan använd länk. Begär en ny återställningslänk.';
    }
</script>

<div class="page-center">
    <div class="card">
        {#if !token}
            <p class="invalid">Ogiltig länk. <a href="/glomt-losenord">Begär en ny återställningslänk.</a></p>
        {:else if done}
            <div class="success">
                <div class="check">✓</div>
                <h2>Lösenordet är uppdaterat!</h2>
                <p>Du skickas till inloggningssidan...</p>
            </div>
        {:else}
            <h1>Välj nytt lösenord</h1>
            <p class="desc">Lösenordet måste vara minst 8 tecken.</p>
            <div class="fields">
                <div class="pw-wrap">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        bind:value={password}
                        placeholder="Nytt lösenord"
                        autocomplete="new-password"
                        onkeydown={(e) => e.key === 'Enter' && submit()}
                        disabled={loading}
                    />
                    <button type="button" class="pw-toggle" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}>
                        {#if showPassword}
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        {/if}
                    </button>
                </div>
                <div class="pw-wrap">
                    <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        bind:value={passwordConfirm}
                        placeholder="Upprepa lösenordet"
                        autocomplete="new-password"
                        onkeydown={(e) => e.key === 'Enter' && submit()}
                        disabled={loading}
                    />
                    <button type="button" class="pw-toggle" onclick={() => showPasswordConfirm = !showPasswordConfirm} aria-label={showPasswordConfirm ? 'Dölj lösenord' : 'Visa lösenord'}>
                        {#if showPasswordConfirm}
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
                    {loading ? 'Sparar...' : 'Spara nytt lösenord'}
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    .card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: var(--shadow-modal);
        width: 100%;
        max-width: 360px;
        padding: 2rem 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    h1 {
        margin: 0;
        font-size: 1.3rem;
        color: var(--text-primary);
    }

    .desc {
        margin: 0;
        font-size: 0.85em;
        color: var(--text-muted);
    }

    .fields {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .fields input {
        padding: 0.65rem 0.9rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-md);
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        width: 100%;
        box-sizing: border-box;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .fields input:focus { border-color: var(--color-primary); }
    .fields input:disabled { background: var(--bg-elevated); }

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

    .pw-toggle:hover { color: var(--text-muted); }

    .error {
        margin: 0;
        font-size: 0.85em;
        color: var(--danger-text);
    }

    .btn-submit {
        padding: 0.7rem;
        background: var(--gradient-brand);
        color: #fff;
        border: none;
        border-radius: var(--radius-md);
        font-size: 1em;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
    }

    .btn-submit:hover:not(:disabled) { opacity: 0.9; }
    .btn-submit:disabled { opacity: 0.5; cursor: default; }

    .success {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    .check {
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        background: var(--gradient-brand);
        color: #fff;
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .success h2 { margin: 0; font-size: 1.2rem; }
    .success p { margin: 0; font-size: 0.9em; color: var(--text-muted); }

    .invalid {
        font-size: 0.9em;
        color: var(--danger-text);
    }

    .invalid a { color: var(--color-primary); }
</style>
