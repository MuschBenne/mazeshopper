<script>
    // Bock för en vara. En riktig knapp med aria-pressed, så skärmläsare hör
    // både vad den gör ("Bocka av Smör") och om den redan är tryckt. Rutan är
    // 24px men träffytan 44px — man siktar med tummen medan vagnen rullar.
    import Check from '@lucide/svelte/icons/check';

    /** @type {{ checked: boolean, label: string, onclick: () => void }} */
    let { checked, label, onclick } = $props();
</script>

<button type="button" class="checkbox" class:checked aria-pressed={checked} aria-label={label} {onclick}>
    <span class="box">
        {#if checked}<Check size={16} strokeWidth={3} aria-hidden="true" />{/if}
    </span>
</button>

<style>
    .checkbox {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        min-height: 44px;
        margin: -10px;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
        flex-shrink: 0;
    }

    .box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 2px solid var(--color-checkbox);
        border-radius: 6px;
        background: var(--color-surface);
        color: #fff;
        transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }

    .checkbox:hover .box { border-color: var(--color-green); }

    .checked .box {
        background: var(--color-green);
        border-color: var(--color-green);
    }
</style>
