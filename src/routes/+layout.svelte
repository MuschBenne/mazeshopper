<script>
    // Root layout — bootstraps all global contexts and renders the sticky header + nav.
    import favicon from '$lib/assets/favicon.svg';
    import { authContext } from '$lib/context/auth-context.svelte';
    import { shoppingContext } from '$lib/context/shopping-context.svelte';
    import { storeContext } from '$lib/context/store-context.svelte';
    import { templateContext } from '$lib/context/template-context.svelte';
    import { categoryContext } from '$lib/context/category-context.svelte';
    import Toast from '$lib/components/Toast.svelte';
    import { themeContext } from '$lib/context/theme-context.svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import "../app.css";

    let { data, children } = $props();

    $effect(() => { themeContext.init(); });

    // Sync the server-side session user into the client-side auth context on every navigation.
    $effect(() => {
        authContext.user = data.user;
    });

    // Kategoripaletten kommer från server-loaden och seedas före de övriga
    // hämtningarna, så sidorna aldrig renderar med en tom kategoriväljare.
    $effect.pre(() => {
        if (data.categories) categoryContext.seed(data.categories);
    });

    // Load all user data when logged in, or clear it when logged out.
    // This runs reactively whenever authContext.user changes.
    $effect(() => {
        if (authContext.user) {
            shoppingContext.load();
            storeContext.load();
            templateContext.load();
            categoryContext.load();
        } else {
            shoppingContext.reset();
            storeContext.reset();
            templateContext.reset();
            categoryContext.reset();
        }
    });

    async function logout() {
        await authContext.logout();
        goto('/');
    }

    let verificationSent = $state(false);
    async function resendVerification() {
        await authContext.resendVerification();
        verificationSent = true;
    }

    // Used to apply the active class on nav links.
    const path = $derived(page.url.pathname);
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<header>
    <a class="brand" href="/">MazeShopper</a>
    {#if authContext.user}
        <div class="user-area">
            <a class="username" href="/installningar" title="Inloggad som {authContext.user.username}">{authContext.user.username}</a>
            <button class="btn-logout" onclick={logout}>Logga ut</button>
        </div>
    {:else}
        <a class="btn-about" href="/om">Om appen</a>
    {/if}
</header>

{#if authContext.user && authContext.user.emailVerified === false}
    <div class="verify-banner" role="alert">
        {#if verificationSent}
            <span>Verifieringsmail skickat! Kolla din inkorg.</span>
        {:else}
            <span>Din e-postadress är inte verifierad. <button class="verify-link" onclick={resendVerification}>Skicka verifieringsmail</button></span>
        {/if}
    </div>
{/if}

{#if authContext.user}
    <div class="nav-wrapper">
        <nav>
            <a href="/inkopslista" class:active={path.startsWith('/inkopslista')}>Inköpslista</a>
            <a href="/mallar" class:active={path.startsWith('/mallar')}>Mallar</a>
            <a href="/varuhus" class:active={path.startsWith('/varuhus')}>Varuhus</a>
            <a href="/installningar" class:active={path.startsWith('/installningar')}>Inställningar</a>
            <a href="/om" class:active={path === '/om'}>Om</a>
        </nav>
    </div>
{/if}

{@render children()}

<Toast />

<style>
    /* Handelsläget ska äga hela skärmen. Listsidan sätter attributet på <html>
       eftersom header och nav ligger här i layouten, utanför dess räckvidd. */
    :global(html[data-shopping='true']) header,
    :global(html[data-shopping='true']) .nav-wrapper,
    :global(html[data-shopping='true']) .verify-banner {
        display: none;
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
        padding: 0 1.25rem;
        height: 56px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .brand {
        font-weight: 800;
        font-size: 1.15rem;
        text-decoration: none;
        background: var(--gradient-brand);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        white-space: nowrap;
    }

    .user-area {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .username {
        font-size: 0.9em;
        color: var(--text-muted);
        text-decoration: none;
        transition: color 0.15s;
    }

    .username:hover { color: var(--color-primary); }

    .btn-logout {
        padding: 0.45rem 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--bg-surface);
        font-size: 0.88em;
        cursor: pointer;
        color: var(--text-secondary);
        min-height: unset;
        white-space: nowrap;
    }

    .btn-logout:hover { background: var(--bg-elevated); }

    .btn-about {
        padding: 0.3rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--bg-surface);
        font-size: 0.85em;
        color: var(--text-secondary);
        text-decoration: none;
        transition: background 0.15s;
    }

    .btn-about:hover { background: var(--bg-elevated); }

    .verify-banner {
        background: var(--verify-bg);
        border-bottom: 1px solid var(--verify-border);
        padding: 0.55rem 1.25rem;
        font-size: 0.85em;
        color: var(--verify-text);
        text-align: center;
    }

    .verify-link {
        background: none;
        border: none;
        padding: 0;
        color: var(--verify-text);
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
        font-size: inherit;
        min-height: unset;
    }

    .verify-link:hover { opacity: 0.75; }

    .nav-wrapper {
        position: relative;
    }

    @media (max-width: 600px) {
        .nav-wrapper::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            bottom: 1px;
            width: 2.5rem;
            background: linear-gradient(to right, transparent, var(--bg-surface));
            pointer-events: none;
        }
    }

    nav {
        display: flex;
        gap: 0;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
        padding: 0 1rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
    }

    nav::-webkit-scrollbar { display: none; }

    nav a {
        display: inline-block;
        padding: 0.7rem 1rem;
        color: var(--text-muted);
        text-decoration: none;
        font-size: 0.9em;
        font-weight: 500;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
    }

    nav a:hover {
        color: var(--text-primary);
        border-bottom-color: var(--border);
    }

    nav a.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
        font-weight: 600;
    }
</style>
