<script>
	import favicon from '$lib/assets/favicon.svg';

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
    </nav>
</header>
{@render children()}
