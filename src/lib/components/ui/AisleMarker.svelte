<script>
    // Nummerruta för en avdelning, som skylten över en butiksgång. Siffran är
    // avdelningens plats i varuhusets rutt — butikerna sparar ingen riktig
    // gångnumrering. "outline" är för stopp man inte nått än.
    //
    // Rutan är dekorativ; den som använder komponenten skriver ut numret för
    // skärmläsare i sin egen text.

    /** @type {{ value: number | string, variant?: 'solid' | 'outline' }} */
    let { value, variant = 'solid' } = $props();
</script>

<span class="marker mono" class:outline={variant === 'outline'} aria-hidden="true">{value}</span>

<style>
    .marker {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        flex-shrink: 0;
        border-radius: 4px;
        background: var(--color-ink);
        color: var(--color-paper);
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
    }

    .outline {
        background: transparent;
        border: 2px solid var(--color-ink);
        color: var(--color-ink);
    }
</style>
