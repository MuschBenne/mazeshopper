<script>
    // Knapp i två varianter. Primär (grön) är huvudhandlingen — det som tar
    // användaren framåt — och ska bara finnas en av per vy. Renderas som <a>
    // när href finns, så navigering förblir en riktig länk.

    /**
     * @type {{
     *   variant?: 'primary' | 'secondary',
     *   href?: string,
     *   type?: 'button' | 'submit',
     *   disabled?: boolean,
     *   onclick?: (e: MouseEvent) => void,
     *   before?: import('svelte').Snippet,
     *   after?: import('svelte').Snippet,
     *   children: import('svelte').Snippet,
     *   [key: string]: any
     * }}
     */
    let { variant = 'primary', href, type = 'button', disabled = false, onclick, before, after, children, ...rest } = $props();
</script>

{#if href}
    <a class="btn btn-{variant}" {href} {...rest}>
        {@render before?.()}
        <span>{@render children()}</span>
        {@render after?.()}
    </a>
{:else}
    <button class="btn btn-{variant}" {type} {disabled} {onclick} {...rest}>
        {@render before?.()}
        <span>{@render children()}</span>
        {@render after?.()}
    </button>
{/if}

<style>
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        height: 52px;
        min-height: 52px;
        padding: 0 1.25rem;
        border-radius: 12px;
        font-family: var(--font-sans);
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
        transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }

    .btn-primary {
        background: var(--color-green);
        border: 1px solid var(--color-green);
        color: #fff;
        font-size: 16px;
        font-weight: 700;
    }

    .btn-primary:hover:not(:disabled),
    .btn-primary:active:not(:disabled) {
        background: var(--color-green-dark);
        border-color: var(--color-green-dark);
    }

    .btn-secondary {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-ink);
        font-size: 15px;
        font-weight: 600;
    }

    .btn-secondary:hover:not(:disabled) { background: var(--bg-elevated); }

    .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
</style>
