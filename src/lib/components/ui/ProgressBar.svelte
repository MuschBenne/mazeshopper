<script>
    // Förlopp för handlingen. Utan segments en vanlig stapel (6px). Med
    // segments en stapel per avdelning i ruttordning: klar, aktuell, kommande.

    /**
     * @type {{
     *   value: number,
     *   max: number,
     *   label: string,
     *   segments?: ('done' | 'current' | 'upcoming')[]
     * }}
     */
    let { value, max, label, segments } = $props();

    const pct = $derived(max > 0 ? Math.round((value / max) * 100) : 0);
</script>

<div
    class="progress"
    class:segmented={segments}
    role="progressbar"
    aria-label={label}
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={max}
>
    {#if segments}
        {#each segments as state, i (i)}
            <span class="segment {state}"></span>
        {/each}
    {:else}
        <span class="fill" style:width="{pct}%"></span>
    {/if}
</div>

<style>
    .progress {
        height: 6px;
        border-radius: 3px;
        background: var(--color-line);
        overflow: hidden;
    }

    .fill {
        display: block;
        height: 100%;
        background: var(--color-green);
        border-radius: 3px;
        transition: width var(--dur-slow) var(--ease-out);
    }

    .segmented {
        display: flex;
        gap: 4px;
        height: 4px;
        background: none;
        border-radius: 0;
    }

    .segment {
        flex: 1;
        height: 100%;
        border-radius: 2px;
        background: var(--color-line);
        transition: background var(--dur-base) var(--ease-out);
    }

    .segment.done { background: var(--color-green); }
    .segment.current { background: var(--color-ink); }
</style>
