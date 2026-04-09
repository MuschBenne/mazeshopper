<script>
    import { authContext } from '$lib/context/auth-context.svelte';
    import { goto } from '$app/navigation';

    if (authContext.user) goto('/inkopslista');

    let mode = $state(/** @type {'login' | 'register'} */ ('login'));
    let username = $state('');
    let password = $state('');
    let error = $state('');

    async function submit() {
        error = '';
        if (!username.trim() || !password) { error = 'Fyll i alla fält.'; return; }

        if (mode === 'login') {
            const result = await authContext.login(username, password);
            if (result === 'not_found') { error = 'Användaren finns inte.'; return; }
            if (result === 'wrong_password') { error = 'Fel lösenord.'; return; }
        } else {
            if (password.length < 4) { error = 'Lösenordet måste vara minst 4 tecken.'; return; }
            const result = await authContext.register(username, password);
            if (result === 'taken') { error = 'Användarnamnet är redan taget.'; return; }
        }

        goto('/inkopslista');
    }
</script>

<div class="hero">
    <div class="hero-text">
        <h1 class="app-title">MazeShopper</h1>
        <p class="app-tagline">Din smarta inköpslista</p>
    </div>

    <div class="auth-card">
        <div class="tabs">
            <button class:active={mode === 'login'} onclick={() => { mode = 'login'; error = ''; }}>Logga in</button>
            <button class:active={mode === 'register'} onclick={() => { mode = 'register'; error = ''; }}>Skapa konto</button>
        </div>

        <div class="fields">
            <input
                bind:value={username}
                placeholder="Användarnamn"
                autocomplete="username"
                onkeydown={(e) => e.key === 'Enter' && submit()}
            />
            <input
                bind:value={password}
                type="password"
                placeholder="Lösenord"
                autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
                onkeydown={(e) => e.key === 'Enter' && submit()}
            />
            {#if error}
                <p class="error">{error}</p>
            {/if}
            <button class="btn-submit" onclick={submit}>
                {mode === 'login' ? 'Logga in' : 'Skapa konto'}
            </button>
        </div>
    </div>
</div>

<style>
    .hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 60px);
        gap: 2rem;
        padding: 2rem 1rem;
    }

    .hero-text {
        text-align: center;
    }

    .app-title {
        font-size: 3rem;
        font-weight: 800;
        margin: 0;
        letter-spacing: -1px;
        background: linear-gradient(135deg, #f97316, #c026d3);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .app-tagline {
        margin: 0.4rem 0 0;
        color: #6b7280;
        font-size: 1.1rem;
    }

    .auth-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.07);
        width: 100%;
        max-width: 360px;
        overflow: hidden;
    }

    .tabs {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
    }

    .tabs button {
        flex: 1;
        padding: 0.85rem;
        background: none;
        border: none;
        font-size: 0.95em;
        font-weight: 500;
        color: #9ca3af;
        cursor: pointer;
        transition: color 0.15s;
    }

    .tabs button.active {
        color: #111;
        border-bottom: 2px solid #f97316;
        margin-bottom: -1px;
    }

    .fields {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.5rem;
    }

    .fields input {
        padding: 0.65rem 0.9rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.95em;
        outline: none;
        transition: border-color 0.15s;
    }

    .fields input:focus {
        border-color: #f97316;
    }

    .error {
        margin: 0;
        font-size: 0.85em;
        color: #dc2626;
    }

    .btn-submit {
        margin-top: 0.25rem;
        padding: 0.7rem;
        background: linear-gradient(135deg, #f97316, #c026d3);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 1em;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
    }

    .btn-submit:hover {
        opacity: 0.9;
    }
</style>
