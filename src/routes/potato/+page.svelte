<script>
    import { potatoContext } from "$lib/context/potato-context.svelte";
</script>

<h1>Jag gillar potatis</h1>

<div class="potato-counter">
    <button onclick={() => potatoContext.decrement()}>Remove potato</button>
    <button onclick={() => potatoContext.increment()}>Add potato</button>

    <p>Number of potatoes: {potatoContext.count}</p>

    <div class="potatoes">
        {#each Array(potatoContext.count) as _}
            <div>🥔</div>
        {/each}
    </div>
</div>
