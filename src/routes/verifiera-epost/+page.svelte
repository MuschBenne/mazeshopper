<svelte:head><title>Verifiera e-post – MazeShopper</title></svelte:head>

<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { authContext } from '$lib/context/auth-context.svelte';

    let status = $state(/** @type {'verifying'|'ok'|'invalid'|'expired'} */ ('verifying'));

    onMount(async () => {
        const token = page.url.searchParams.get('token') ?? '';
        if (!token) { status = 'invalid'; return; }

        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_email', token })
        });
        const data = await res.json();

        if (data.ok) {
            status = 'ok';
            if (authContext.user) {
                authContext.user = { ...authContext.user, emailVerified: true };
            }
            setTimeout(() => goto(authContext.user ? '/inkopslista' : '/'), 2500);
        } else if (data.error === 'expired') {
            status = 'expired';
        } else {
            status = 'invalid';
        }
    });
</script>

<div class="page-center">
    {#if status === 'verifying'}
        <div class="card">
            <div class="spinner"></div>
            <p>Verifierar din e-postadress…</p>
        </div>
    {:else if status === 'ok'}
        <div class="card success">
            <span class="icon">✓</span>
            <h1>E-postadressen verifierad!</h1>
            <p>Du skickas vidare automatiskt…</p>
        </div>
    {:else if status === 'expired'}
        <div class="card error">
            <h1>Länken har gått ut</h1>
            <p>Verifieringslänken är giltig i 24 timmar. Logga in och begär ett nytt verifieringsmail via bannern högst upp.</p>
            <a href="/" class="btn">Till inloggning</a>
        </div>
    {:else}
        <div class="card error">
            <h1>Ogiltig länk</h1>
            <p>Länken är ogiltig eller har redan använts.</p>
            <a href="/" class="btn">Till inloggning</a>
        </div>
    {/if}
</div>

<style>
    .page-center {
        padding: 2rem 1rem;
    }

    .card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: var(--shadow-modal);
        padding: 2.5rem 2rem;
        max-width: 380px;
        width: 100%;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    .card.success { border-color: var(--success-border); }
    .card.error   { border-color: var(--danger-border); }

    h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    p {
        margin: 0;
        font-size: 0.9em;
        color: var(--text-muted);
        line-height: 1.5;
    }

    .icon {
        font-size: 2.5rem;
        color: var(--success-text);
    }

    .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid var(--border);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .btn {
        display: inline-block;
        margin-top: 0.5rem;
        padding: 0.6rem 1.5rem;
        background: var(--gradient-brand);
        color: #fff;
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: 0.9em;
        text-decoration: none;
    }

    .btn:hover { opacity: 0.9; }
</style>
