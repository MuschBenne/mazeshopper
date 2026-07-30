<script>
    // Mängd + enhet. Samma fält i receptredigeraren, i listans tilläggsformulär
    // och i den inbyggda redigeringen — enheten är samma begrepp överallt, och
    // tre kopior av den här raden skulle glida isär.
    import { QUICK_UNITS, MAX_UNIT_LENGTH } from '$lib/units';

    /**
     * `amount` är rå text, inte ett tal: fältet måste kunna stå tomt och
     * innehålla ett halvskrivet "1," medan man skriver. Anroparen tolkar det
     * med parseQuantityInput när varan sparas.
     * @type {{
     *   amount: string,
     *   unit: string,
     *   onEnter?: () => void,
     *   placeholder?: string
     * }}
     */
    let { amount = $bindable(''), unit = $bindable(''), onEnter, placeholder = 'Mängd' } = $props();

    // "annan…" fälls ut på begäran, men måste också stå öppen av sig själv för
    // en vara som redan har en enhet utanför snabbvalen.
    let customOpen = $state(false);
    const isQuickUnit = $derived(QUICK_UNITS.some(u => u.value === unit));
    const showCustom = $derived(customOpen || (unit !== '' && !isQuickUnit));

    /** @param {string} value */
    function pickUnit(value) {
        // Klick på det valda chipet avmarkerar — samma beteende som
        // kategoriväljaren. Styck är frånvaron av enhet och är därför kvar.
        unit = unit === value ? '' : value;
        customOpen = false;
    }

    function toggleCustom() {
        customOpen = !customOpen;
        if (!customOpen) unit = '';
    }

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if (e.key === 'Enter') onEnter?.();
    }
</script>

<div class="amount-row">
    <input
        class="amount-input"
        type="text"
        inputmode="decimal"
        bind:value={amount}
        {placeholder}
        aria-label={placeholder}
        onkeydown={onKeydown}
    />
    <div class="unit-picker">
        {#each QUICK_UNITS as u (u.label)}
            <button
                type="button"
                class="unit-chip"
                class:selected={!showCustom && unit === u.value}
                onclick={() => pickUnit(u.value)}
            >{u.label}</button>
        {/each}
        <button
            type="button"
            class="unit-chip unit-chip-other"
            class:selected={showCustom}
            onclick={toggleCustom}
        >annan…</button>
    </div>
    {#if showCustom}
        <input
            class="unit-custom"
            type="text"
            bind:value={unit}
            maxlength={MAX_UNIT_LENGTH}
            placeholder="egen enhet"
            aria-label="Egen enhet"
            onkeydown={onKeydown}
        />
    {/if}
</div>
