<script>
    import favicon from '$lib/assets/favicon.svg';
    import { authContext } from '$lib/context/auth-context.svelte';
    import { shoppingContext } from '$lib/context/shopping-context.svelte';
    import { storeContext } from '$lib/context/store-context.svelte';
    import { settingContext } from '$lib/context/setting-context.svelte';
    import { goto } from '$app/navigation';
    import "../app.css";

    let { data, children } = $props();

    $effect(() => {
        // Sync user from server on every navigation
        authContext.user = data.user;
    });

    $effect(() => {
        if (authContext.user) {
            shoppingContext.load();
            storeContext.load();
            settingContext.load();
        } else {
            shoppingContext.reset();
            storeContext.reset();
            settingContext.reset();
        }
    });

    async function logout() {
        await authContext.logout();
        goto('/');
    }
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<header>
    <a class="brand" href="/">MazeShopper</a>
    {#if authContext.user}
        <div class="user-area">
            <span class="username">{authContext.user.username}</span>
            <button class="btn-logout" onclick={logout}>Logga ut</button>
        </div>
    {:else}
        <a class="btn-about" href="/om">Om appen</a>
    {/if}
</header>

{#if authContext.user}
    <nav>
        <a href="/inkopslista">Inköpslista</a>
        <a href="/varuhus">Varuhus</a>
        <a href="/installningar">Inställningar</a>
    </nav>
{/if}

{@render children()}

<style>
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        border-bottom: 1px solid #e5e7eb;
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
        background: linear-gradient(135deg, #f97316, #c026d3);
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
        color: #6b7280;
    }

    .btn-logout {
        padding: 0.3rem 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #fff;
        font-size: 0.85em;
        cursor: pointer;
        color: #374151;
        min-height: unset;
    }

    .btn-logout:hover { background: #f9fafb; }

    .btn-about {
        padding: 0.3rem 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #fff;
        font-size: 0.85em;
        color: #374151;
        text-decoration: none;
        transition: background 0.15s;
    }

    .btn-about:hover { background: #f9fafb; }

    nav {
        display: flex;
        gap: 0;
        background: #fff;
        border-bottom: 1px solid #e5e7eb;
        padding: 0 1rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
    }

    nav::-webkit-scrollbar { display: none; }

    nav a {
        display: inline-block;
        padding: 0.7rem 1rem;
        color: #6b7280;
        text-decoration: none;
        font-size: 0.9em;
        font-weight: 500;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
    }

    nav a:hover {
        color: #111827;
        border-bottom-color: #e5e7eb;
    }
</style>
