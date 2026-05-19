<script>
    import { notificationContext } from '$lib/context/notification-context.svelte';
    import { fly, fade } from 'svelte/transition';
</script>

<div class="toast-container">
    {#each notificationContext.toasts as toast (toast.id)}
        <div
            class="toast"
            class:error={toast.type === 'error'}
            class:success={toast.type === 'success'}
            in:fly={{ y: 16, duration: 200 }}
            out:fade={{ duration: 150 }}
        >
            <span>{toast.message}</span>
            <button onclick={() => notificationContext.dismiss(toast.id)} aria-label="Stäng">×</button>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        bottom: max(1.5rem, calc(env(safe-area-inset-bottom) + 0.5rem));
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 999;
        align-items: center;
        pointer-events: none;
    }

    .toast {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 1rem;
        border-radius: 10px;
        font-size: 0.9em;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        pointer-events: all;
        min-width: 220px;
        max-width: 360px;
        white-space: nowrap;
    }

    .toast span {
        flex: 1;
        white-space: normal;
    }

    .toast button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2em;
        line-height: 1;
        padding: 0;
        opacity: 0.5;
        flex-shrink: 0;
        min-height: unset;
    }

    .toast button:hover { opacity: 1; }

    .toast.error {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fca5a5;
    }

    .toast.success {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #86efac;
    }
</style>
