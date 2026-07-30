<script>
    import { page } from '$app/state';
    import { goto, invalidateAll } from '$app/navigation';
    import { notificationContext } from '$lib/context/notification-context.svelte';

    let { data } = $props();

    let joining = $state(false);

    // Efter inloggning eller registrering ska man hamna tillbaka här och gå med
    // direkt — annars tappas inbjudan bort i samma stund som kontot skapas.
    const authUrl = $derived(
        (/** @type {'login' | 'register'} */ mode) =>
            `/?mode=${mode}&next=${encodeURIComponent(`/i/${page.params.token}`)}`
    );

    async function join() {
        joining = true;
        try {
            const res = await fetch(`/api/lists/join/${page.params.token}`, { method: 'POST' });
            if (!res.ok) {
                notificationContext.show('Kunde inte gå med i listan. Försök igen.');
                return;
            }
            const { listId } = await res.json();
            await invalidateAll();
            goto(`/inkopslista/${listId}`);
        } catch {
            notificationContext.show('Kunde inte gå med. Kontrollera din anslutning.');
        } finally {
            joining = false;
        }
    }
</script>

<svelte:head><title>Inbjudan till {data.listName} – MazeShopper</title></svelte:head>

<div class="page-center">
    <div class="invite-card">
        <p class="kicker">Du är inbjuden</p>

        <h1>{data.listName}</h1>

        <p class="from">
            <strong>{data.owner}</strong> vill dela sin inköpslista med dig
        </p>

        <div class="facts">
            <span>{data.itemCount} {data.itemCount === 1 ? 'vara' : 'varor'}</span>
            <span class="dot">·</span>
            <span>{data.memberCount} {data.memberCount === 1 ? 'person' : 'personer'}</span>
        </div>

        {#if data.isMember}
            <p class="note">Du är redan med i den här listan.</p>
            <a class="btn-primary" href="/inkopslista/{data.listId}">Öppna listan</a>
        {:else if data.isLoggedIn}
            <button class="btn-primary" onclick={join} disabled={joining}>
                {joining ? 'Går med…' : 'Gå med i listan'}
            </button>
            <p class="note">Ni ser samma lista och kan båda bocka av varor.</p>
        {:else}
            <div class="auth-actions">
                <a class="btn-primary" href={authUrl('register')}>Skapa konto</a>
                <a class="btn-secondary" href={authUrl('login')}>Jag har redan ett konto</a>
            </div>
            <p class="note">Du hamnar tillbaka här direkt efteråt.</p>
        {/if}
    </div>
</div>

<style>
    .invite-card {
        width: 100%;
        max-width: 380px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.6rem;
        padding: 2.25rem 1.75rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: var(--shadow-modal);
    }

    .kicker {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--violet-text);
    }

    h1 {
        margin: 0;
        font-size: 1.6rem;
        line-height: 1.2;
        word-break: break-word;
    }

    .from {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-base);
    }

    .facts {
        display: flex;
        gap: 0.4rem;
        color: var(--text-faint);
        font-size: var(--text-sm);
    }

    .dot { opacity: 0.6; }

    .auth-actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
        margin-top: 0.5rem;
    }

    .btn-primary {
        display: block;
        width: 100%;
        padding: 0.75rem 1.5rem;
        margin-top: 0.5rem;
        background: var(--gradient-brand);
        color: #fff;
        border: none;
        border-radius: var(--radius-md);
        font-size: var(--text-base);
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        min-height: 44px;
    }

    .auth-actions .btn-primary { margin-top: 0; }

    .btn-primary:disabled { opacity: 0.6; cursor: default; }

    .btn-secondary {
        display: block;
        width: 100%;
        padding: 0.7rem 1.5rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: var(--text-sm);
        text-decoration: none;
        min-height: 44px;
    }

    .btn-secondary:hover { background: var(--bg-elevated); }

    .note {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-faint);
        line-height: 1.5;
    }
</style>
