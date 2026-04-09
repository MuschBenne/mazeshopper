<script>
	import favicon from '$lib/assets/favicon.svg';
    import "../app.css";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
    <nav>
        <a href="/">Home</a>
        <a href="/potato">Potato</a>
        <a href="/inkopslista">Shopping List</a>
        <a href="/testing">Testing</a>
        <a href="/varuhus">Varuhus</a>
        <a href="/installningar">Inställningar</a>
    </nav>
</header>
{@render children()}

<style>
    header {
        background-color: rgb(173, 117, 5);
        padding: 1rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    nav a {
        color: rgb(0, 0, 0);
        margin-right: 1rem;
        text-decoration: none;
        font-weight: bold;
    }
    nav a:hover {
        text-decoration: underline;
    }
</style>