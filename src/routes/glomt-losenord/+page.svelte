<svelte:head><title>Glömt lösenordet – MazeShopper</title></svelte:head>

<script>
    import { authContext } from '$lib/context/auth-context.svelte';

    let email = $state('');
    let submitted = $state(false);
    let loading = $state(false);

    async function submit() {
        if (!email.trim()) return;
        loading = true;
        await authContext.requestPasswordReset(email.trim());
        loading = false;
        submitted = true;
    }
</script>

<div class="page">
    <div class="card">
        <a class="back" href="/">← Tillbaka till inloggning</a>
        <h1>Glömt lösenordet?</h1>

        {#if submitted}
            <div class="success">
                <p>Om e-postadressen finns i systemet har vi skickat en återställningslänk dit.</p>
                <p class="hint">Kolla även skräppostmappen. Länken är giltig i 15 minuter.</p>
            </div>
        {:else}
            <p class="desc">Ange din e-postadress så skickar vi en länk för att återställa lösenordet.</p>
            <div class="fields">
                <input
                    type="email"
                    bind:value={email}
                    placeholder="E-postadress"
                    autocomplete="email"
                    onkeydown={(e) => e.key === 'Enter' && submit()}
                    disabled={loading}
                />
                <button class="btn-submit" onclick={submit} disabled={loading || !email.trim()}>
                    {loading ? 'Skickar...' : 'Skicka återställningslänk'}
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

    .back {
        font-size: 0.85em;
        color: #6b7280;
        text-decoration: none;
    }

    .back:hover { color: #f97316; }

    h1 {
        margin: 0;
        font-size: 1.3rem;
        color: #111827;
    }

    .desc {
        margin: 0;
        font-size: 0.9em;
        color: #6b7280;
        line-height: 1.5;
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
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .success p {
        margin: 0;
        font-size: 0.95em;
        color: #111827;
    }

    .hint {
        color: #6b7280 !important;
        font-size: 0.85em !important;
    }
</style>
