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
<p class="subtitle">Skapa och dela inköpslistor med familj eller vänner.</p>

<div class="new-list-card">
    <input
        bind:value={newListName}
        placeholder="Namn på ny lista"
        onkeydown={(e) => e.key === 'Enter' && createList()}
    />
    <button onclick={createList}>+ Skapa lista</button>
</div>

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

{#if myLists.length === 0}
    <p class="empty-hint">Inga listor än — skapa din första ovan.</p>
{:else}
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
    </div>
{/if}
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

    .lists-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 1rem;
    }

    .list-card {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 0.4rem;
        min-height: 120px;
        border-radius: 12px;
        border: 2px solid var(--border);
        background: var(--bg-surface);
        text-decoration: none;
        color: inherit;
        padding: 1rem;
        cursor: pointer;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .list-card:hover {
        border-color: var(--text-faint);
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .list-name {
        font-size: 1.05em;
        font-weight: 600;
        text-align: center;
    }

    .list-count {
        font-size: 0.8em;
        color: var(--text-faint);
    }

    .shared-badge {
        font-size: 0.72em;
        color: var(--violet-text);
        background: var(--violet-light);
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
        text-align: center;
    }

    .new-list-card {
        display: flex;
        gap: 0.5rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
    }

    .new-list-card input {
        flex: 1;
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .new-list-card input:focus { border-color: #f97316; }

    .new-list-card button {
        padding: 0.55rem 1rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .new-list-card button:hover { opacity: 0.9; }

    .invitations-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .inv-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--text-muted);
        margin: 0 0 0.25rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .inv-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: var(--bg-surface);
        border: 1px solid var(--violet-border);
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
        color: var(--violet-text);
    }

    .inv-actions {
        display: flex;
        gap: 0.4rem;
        flex-shrink: 0;
    }

    .btn-accept {
        padding: 0.35rem 0.85rem;
        background: var(--success-text);
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-accept:hover { background: var(--success-text-hover); }

    .btn-decline {
        padding: 0.35rem 0.85rem;
        background: var(--bg-surface);
        color: var(--danger-text);
        border: 1px solid var(--danger-border);
        border-radius: 6px;
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-decline:hover { background: var(--danger-bg); }

    .empty-state {
        text-align: center;
        padding: 2.5rem 1rem 0.5rem;
    }

    .empty-title {
        font-size: 1.05em;
        font-weight: 600;
        color: var(--text-secondary);
        margin: 0 0 0.35rem;
    }

    .empty-hint {
        font-size: 0.88em;
        color: var(--text-faint);
        margin: 0;
    }
</style>
