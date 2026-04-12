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

    async function submit() {
        error = '';
        if (!password) { error = 'Fyll i ett nytt lösenord.'; return; }
        if (password.length < 8) { error = 'Lösenordet måste vara minst 8 tecken.'; return; }
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

<div class="page">
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
                <input
                    type="password"
                    bind:value={password}
                    placeholder="Nytt lösenord"
                    autocomplete="new-password"
                    onkeydown={(e) => e.key === 'Enter' && submit()}
                    disabled={loading}
                />
                <input
                    type="password"
                    bind:value={passwordConfirm}
                    placeholder="Upprepa lösenordet"
                    autocomplete="new-password"
                    onkeydown={(e) => e.key === 'Enter' && submit()}
                    disabled={loading}
                />
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
    .page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 56px);
        padding: 1.5rem 1rem;
    }

    .card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.07);
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
        color: #111827;
    }

    .desc {
        margin: 0;
        font-size: 0.85em;
        color: #6b7280;
    }

    .fields {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .fields input {
        padding: 0.65rem 0.9rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
    }

    .fields input:focus { border-color: #f97316; }
    .fields input:disabled { background: #f9fafb; }

    .error {
        margin: 0;
        font-size: 0.85em;
        color: #dc2626;
    }

    .btn-submit {
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
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .success h2 { margin: 0; font-size: 1.2rem; }
    .success p { margin: 0; font-size: 0.9em; color: #6b7280; }

    .invalid {
        font-size: 0.9em;
        color: #dc2626;
    }

    .invalid a { color: #f97316; }
</style>
