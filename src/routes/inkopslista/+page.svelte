<svelte:head><title>Mina listor – MazeShopper</title></svelte:head>

<script>
    // Overview page — shows all lists the user owns or has been shared with,
    // plus any pending invitations that need to be accepted or declined.
    import { shoppingContext } from "$lib/context/shopping-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { goto } from '$app/navigation';

    let { data } = $props();

    // Seed lists before first render so they appear immediately without waiting
    // for the background load() triggered by the layout effect.
    $effect.pre(() => {
        shoppingContext.lists = data.lists;
    });

    const username = $derived(authContext.user?.username ?? '');
    // Includes both owned and shared lists for this user.
    const myLists = $derived(shoppingContext.listsForUser(username));
    const pendingInvitations = $derived(shoppingContext.invitations);

    let newListName = $state('');

    // Creates the list and immediately navigates to it so the user can start adding items.
    async function createList() {
        if (newListName.trim().length === 0) return;
        const id = await shoppingContext.createList(newListName, username);
        if (!id) return;
        newListName = '';
        goto(`/inkopslista/${id}`);
    }
</script>

<div class="page">
<h1>Inköpslistor</h1>

{#if pendingInvitations.length > 0}
    <div class="invitations-section">
        <h2 class="inv-title">Inbjudningar</h2>
        {#each pendingInvitations as inv}
            <div class="inv-card">
                <div class="inv-info">
                    <span class="inv-list-name">{inv.listName}</span>
                    <span class="inv-from">Inbjuden av <strong>{inv.fromUser}</strong></span>
                </div>
                <div class="inv-actions">
                    <button class="btn-accept" onclick={() => shoppingContext.acceptInvitation(inv.id)}>Acceptera</button>
                    <button class="btn-decline" onclick={() => shoppingContext.declineInvitation(inv.id)}>Neka</button>
                </div>
            </div>
        {/each}
    </div>
{/if}

<div class="lists-grid">
    {#each myLists as list}
        <a class="list-card" href="/inkopslista/{list.id}">
            <span class="list-name">{list.name}</span>
            <span class="list-count">{list.items.length} varor</span>
            {#if list.owner !== username}
                <span class="shared-badge">Delad av {list.owner}</span>
            {:else if list.sharedWith.length > 0}
                <span class="shared-badge">Delad med {list.sharedWith.length} st</span>
            {/if}
        </a>
    {/each}

    <div class="list-card new-card">
        <input
            bind:value={newListName}
            placeholder="Namn på ny lista"
            onkeydown={(e) => e.key === 'Enter' && createList()}
        />
        <button onclick={createList}>Skapa</button>
    </div>
</div>
</div>

<style>
    .page {
        max-width: 680px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
    }

    .lists-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 1rem;
        margin-top: 1.5rem;
    }

    .list-card {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 0.4rem;
        min-height: 120px;
        border-radius: 12px;
        border: 2px solid #e5e7eb;
        background: #fff;
        text-decoration: none;
        color: inherit;
        padding: 1rem;
        cursor: pointer;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .list-card:hover {
        border-color: #9ca3af;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .list-name {
        font-size: 1.05em;
        font-weight: 600;
        text-align: center;
    }

    .list-count {
        font-size: 0.8em;
        color: #9ca3af;
    }

    .shared-badge {
        font-size: 0.72em;
        color: #7c3aed;
        background: #f5f3ff;
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
        text-align: center;
    }

    .new-card {
        border-style: dashed;
        gap: 0.6rem;
    }

    .new-card input {
        width: 100%;
        text-align: center;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 0.3rem 0.5rem;
        font-size: 0.95em;
    }

    .new-card button {
        padding: 0.3rem 1rem;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: #f9fafb;
        cursor: pointer;
        font-size: 0.9em;
    }

    .new-card button:hover {
        background: #f3f4f6;
    }

    .invitations-section {
        margin-bottom: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .inv-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: #6b7280;
        margin: 0 0 0.25rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .inv-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: #fff;
        border: 1px solid #c4b5fd;
        border-radius: 10px;
        padding: 0.75rem 1rem;
        flex-wrap: wrap;
    }

    .inv-info {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .inv-list-name {
        font-weight: 600;
        font-size: 0.95em;
    }

    .inv-from {
        font-size: 0.8em;
        color: #7c3aed;
    }

    .inv-actions {
        display: flex;
        gap: 0.4rem;
        flex-shrink: 0;
    }

    .btn-accept {
        padding: 0.35rem 0.85rem;
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-accept:hover { background: #15803d; }

    .btn-decline {
        padding: 0.35rem 0.85rem;
        background: #fff;
        color: #dc2626;
        border: 1px solid #fca5a5;
        border-radius: 6px;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-decline:hover { background: #fef2f2; }
</style>
