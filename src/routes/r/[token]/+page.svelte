<script>
    import { page } from '$app/state';
    import { notificationContext } from '$lib/context/notification-context.svelte';
    import { goto } from '$app/navigation';
    import { formatAmount, scaleQuantity } from '$lib/units';

    let { data } = $props();

    const recipe = $derived(data.recipe);
    const isRecipe = $derived(recipe.kind === 'recipe');

    // Besökaren kan räkna om mängderna innan de sparar eller handlar efter dem.
    let servings = $state(0);
    $effect(() => { if (servings === 0) servings = recipe.servings ?? 4; });

    const scale = $derived(isRecipe && recipe.servings ? servings / recipe.servings : 1);

    // Samma avrundning och formatering som vid import — den som läser här ska
    // se exakt de mängder som hamnar i listan.
    /** @param {{ quantity: number | null, unit?: string }} item */
    function scaledAmount(item) {
        const unit = item.unit ?? '';
        return formatAmount(scaleQuantity(item.quantity, unit, scale), unit);
    }

    let saving = $state(false);

    async function save() {
        saving = true;
        try {
            const res = await fetch(`/api/templates/shared/${page.params.token}`, { method: 'POST' });
            if (res.ok) {
                notificationContext.show('Sparat bland dina recept.', 'success');
                goto('/mallar');
                return;
            }
            const { error } = await res.json();
            if (error === 'already_yours') notificationContext.show('Det här är redan ditt recept.');
            else if (error === 'too_many_templates') notificationContext.show('Du har nått taket på 50 mallar och recept.');
            else notificationContext.show('Kunde inte spara. Försök igen.');
        } catch {
            notificationContext.show('Kunde inte spara. Kontrollera din anslutning.');
        } finally {
            saving = false;
        }
    }
</script>

<svelte:head><title>{recipe.name} – MazeShopper</title></svelte:head>

<div class="page">
    <div class="head">
        <p class="kicker">{isRecipe ? 'Delat recept' : 'Delad mall'}</p>
        <h1>{recipe.name}</h1>
        <p class="by">Delat av <strong>{data.sharedBy}</strong></p>
    </div>

    {#if isRecipe}
        <div class="servings">
            <span>Portioner</span>
            <button
                class="qty-btn"
                onclick={() => servings = Math.max(1, servings - 1)}
                aria-label="Färre portioner"
            >−</button>
            <span class="servings-value">{servings}</span>
            <button
                class="qty-btn"
                onclick={() => servings = Math.min(99, servings + 1)}
                aria-label="Fler portioner"
            >+</button>
            {#if servings !== recipe.servings}
                <span class="orig">(originalet är {recipe.servings})</span>
            {/if}
        </div>
    {/if}

    <div class="card">
        {#if recipe.items.length === 0}
            <p class="empty">Den här {isRecipe ? 'receptet' : 'mallen'} har inga varor.</p>
        {:else}
            <ul>
                {#each recipe.items as item (item.itemId)}
                    <li>
                        <span class="qty">{scaledAmount(item)}</span>
                        <span class="name">
                            {item.name}
                            {#if item.spec}<span class="spec">{item.spec}</span>{/if}
                        </span>
                        {#if item.category}<span class="cat">{item.category}</span>{/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>

    {#if data.isOwn}
        <p class="note">Det här är ditt eget {isRecipe ? 'recept' : 'mall'}. <a href="/mallar">Öppna i redigeraren</a>.</p>
    {:else if data.isLoggedIn}
        <button class="btn-save-copy" onclick={save} disabled={saving}>
            {saving ? 'Sparar…' : `Spara bland mina ${isRecipe ? 'recept' : 'mallar'}`}
        </button>
        <p class="note">Du får en egen kopia som du kan ändra fritt.</p>
    {:else}
        <a class="btn-save-copy" href="/">Logga in för att spara</a>
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

    .head { display: flex; flex-direction: column; gap: 0.25rem; }

    .kicker {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--violet-text);
    }

    h1 { margin: 0; font-size: 1.5rem; }

    .by { margin: 0; font-size: 0.88em; color: var(--text-muted); }

    .servings {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9em;
        color: var(--text-secondary);
    }

    .servings-value { font-weight: 700; min-width: 1.5rem; text-align: center; }

    .orig { font-size: 0.85em; color: var(--text-faint); }

    .qty-btn {
        width: 32px;
        height: 32px;
        min-height: 32px;
        border: 1px solid var(--border-input);
        border-radius: 8px;
        background: var(--bg-surface);
        color: var(--text-primary);
        font-size: 1.1em;
        line-height: 1;
        cursor: pointer;
    }

    .qty-btn:hover { background: var(--bg-elevated); }

    .card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow-card);
        padding: 0.5rem 0;
    }

    ul { list-style: none; margin: 0; padding: 0; }

    li {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
        padding: 0.6rem 1.25rem;
        border-bottom: 1px solid var(--border-subtle);
    }

    li:last-child { border-bottom: none; }

    .qty {
        flex-shrink: 0;
        min-width: 3.5rem;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        font-size: 0.9em;
        color: var(--text-secondary);
    }

    .name { flex: 1; }

    .spec {
        display: block;
        font-size: 0.82em;
        color: var(--text-faint);
    }

    .cat {
        font-size: 0.72em;
        color: var(--text-muted);
        background: var(--bg-elevated);
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
        white-space: nowrap;
    }

    .empty {
        margin: 0;
        padding: 2rem 1.25rem;
        text-align: center;
        color: var(--text-faint);
        font-size: 0.9em;
    }

    .btn-save-copy {
        align-self: flex-start;
        padding: 0.6rem 1.25rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
    }

    .btn-save-copy:disabled { opacity: 0.6; cursor: default; }

    .note { margin: 0; font-size: 0.82em; color: var(--text-faint); }
</style>
