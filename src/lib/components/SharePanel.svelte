<script>
    import { shoppingContext } from '$lib/context/shopping-context.svelte';

    /**
     * @type {{
     *   list: { sharedWith: string[], pendingInvites?: string[] },
     *   listId: string,
     *   username: string,
     *   onClose: () => void
     * }}
     */
    let { list, listId, username, onClose } = $props();

    let shareInput = $state('');
    let shareError = $state('');
    let shareSuccess = $state('');

    async function shareList() {
        shareError = '';
        shareSuccess = '';
        const target = shareInput.trim();
        if (!target) return;
        if (target.toLowerCase() === username.toLowerCase()) {
            shareError = 'Du kan inte dela med dig själv.';
            return;
        }
        const result = await shoppingContext.shareList(listId, target);
        if (result === 'already_shared') {
            shareError = `Listan delas redan med ${target}.`;
        } else if (result === 'already_invited') {
            shareError = `${target} har redan fått en inbjudan.`;
        } else if (result === 'user_not_found') {
            shareError = `Användaren "${target}" finns inte.`;
        } else {
            shareSuccess = `Inbjudan skickad till ${target}.`;
            shareInput = '';
        }
    }
</script>

<div class="card share-panel">
    <div class="panel-header">
        <h2>Dela lista</h2>
        <button class="btn-close" onclick={onClose} aria-label="Stäng">×</button>
    </div>

    {#if list.sharedWith.length > 0}
        <div class="collaborators">
            <span class="collab-label">Har åtkomst:</span>
            {#each list.sharedWith as collaborator}
                <span class="collab-chip">
                    {collaborator}
                    <button
                        class="collab-remove"
                        onclick={() => shoppingContext.unshareList(listId, collaborator)}
                        title="Ta bort åtkomst"
                    >×</button>
                </span>
            {/each}
        </div>
    {/if}

    {#if (list.pendingInvites ?? []).length > 0}
        <div class="collaborators">
            <span class="collab-label pending-label">Väntar på svar:</span>
            {#each (list.pendingInvites ?? []) as pending}
                <span class="collab-chip pending-chip">
                    {pending}
                    <button
                        class="collab-remove"
                        onclick={() => shoppingContext.unshareList(listId, pending)}
                        title="Återkalla inbjudan"
                    >×</button>
                </span>
            {/each}
        </div>
    {/if}

    {#if list.sharedWith.length === 0 && (list.pendingInvites ?? []).length === 0}
        <p class="no-collabs">Listan delas inte med någon ännu.</p>
    {/if}

    <div class="share-input-row">
        <input
            bind:value={shareInput}
            placeholder="Användarnamn"
            onkeydown={(e) => e.key === 'Enter' && shareList()}
        />
        <button class="btn-add-share" onclick={shareList}>Bjud in</button>
    </div>
    {#if shareError}<p class="share-msg error">{shareError}</p>{/if}
    {#if shareSuccess}<p class="share-msg success">{shareSuccess}</p>{/if}
</div>

<style>
    .card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow-card);
        padding: 1.25rem;
    }

    .share-panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .panel-header h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .btn-close {
        background: none;
        border: none;
        font-size: 1.3em;
        cursor: pointer;
        color: var(--text-faint);
        line-height: 1;
        padding: 0 0.2rem;
        min-height: unset;
    }

    .btn-close:hover { color: var(--text-secondary); }

    .collaborators {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
    }

    .collab-label {
        font-size: 0.85em;
        color: var(--text-muted);
    }

    .collab-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        background: var(--violet-bg);
        color: var(--violet-text);
        border-radius: 999px;
        padding: 0.2rem 0.6rem;
        font-size: 0.82em;
        font-weight: 500;
    }

    .collab-remove {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--violet-text);
        font-size: 1em;
        line-height: 1;
        padding: 0 0.1rem;
        min-height: unset;
    }

    .collab-remove:hover { color: var(--danger-text); }

    .no-collabs {
        font-size: 0.85em;
        color: var(--text-faint);
        margin: 0;
    }

    .pending-label { color: var(--warning-text); }

    .pending-chip {
        background: var(--warning-bg);
        color: var(--warning-text);
        font-style: italic;
    }

    .share-input-row {
        display: flex;
        gap: 0.5rem;
    }

    .share-input-row input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        font-size: 0.9em;
        outline: none;
        background: var(--bg-surface);
        color: var(--text-primary);
    }

    .share-input-row input:focus { border-color: var(--violet-text); }

    .btn-add-share {
        padding: 0.5rem 1rem;
        background: var(--violet-text);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-add-share:hover { background: var(--violet-text-hover); }

    .share-msg {
        font-size: 0.85em;
        margin: 0;
        padding: 0.4rem 0.7rem;
        border-radius: 6px;
    }

    .share-msg.error { color: var(--danger-text); background: var(--danger-bg); }
    .share-msg.success { color: var(--success-text); background: var(--success-bg); }
</style>
