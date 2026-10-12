<script>
    // En rad i listan: bock, namn, mängd under. Ingen kortbakgrund — raderna
    // ligger direkt på papperet med en tunn linje emellan, som på ett kvitto.
    //
    // Bocken visas bara när onToggle finns (handelsläget). I redigeringsläget
    // tar trailing-snippeten hand om stegknappar, redigera och ta bort.
    import Checkbox from './Checkbox.svelte';

    /**
     * @type {{
     *   name: string,
     *   checked?: boolean,
     *   onToggle?: () => void,
     *   amount?: string,
     *   large?: boolean,
     *   meta?: import('svelte').Snippet,
     *   trailing?: import('svelte').Snippet
     * }}
     */
    let { name, checked = false, onToggle, amount = '', large = false, meta, trailing } = $props();
</script>

<div class="item-row" class:checked class:large>
    {#if onToggle}
        <!-- Etiketten är densamma i båda lägena; aria-pressed säger om den är ibockad. -->
        <Checkbox {checked} label="Bocka av {name}" onclick={onToggle} />
    {/if}
    <div class="body">
        <span class="name">{name}</span>
        {#if amount || meta}
            <span class="meta">
                {#if amount}<span class="amount mono">{amount}</span>{/if}
                {@render meta?.()}
            </span>
        {/if}
    </div>
    {#if trailing}
        <div class="trailing">{@render trailing()}</div>
    {/if}
</div>

<style>
    .item-row {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        min-height: 56px;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--color-line);
    }

    .item-row.large { min-height: 64px; }

    .body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .name {
        font-size: 16px;
        font-weight: 500;
        color: var(--color-ink);
        word-break: break-word;
    }

    .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0 0.5rem;
        font-size: 13px;
        color: var(--color-muted);
    }

    .amount { color: var(--color-ink); }

    .trailing {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 0;
    }

    .checked .name {
        color: var(--color-done);
        text-decoration: line-through;
    }

    .checked .meta,
    .checked .amount { color: var(--color-done); }
</style>
