<h1>Welcome to MazeShopper</h1>

<p>MazeShopper is a shopping list application built with SvelteKit.</p>



<script>
    // You can add your Svelte code here
    /**
     * @type {string[]}*/
    let items = ['Potatoes'];
    let newItem = '';
    let count = $state(0);

    function addItem() {
        items = [...items, newItem];
        newItem = '';
    }

    function dec() {
        count -= 1;
    }

    function inc() {
        count += 1;
    }
    
</script>

<button 
  onclick={addItem}>Add Item</button>

<input
  bind:value={newItem} placeholder="New item" 
  onkeydown={(e) => e.key === 'Enter' && addItem()}/>

<ul>
  {#each items as item}
    <li>{item}</li>
  {/each}
</ul>

<div class="potato-counter">
    <button onclick={dec}>Remove potato</button>
    <button onclick={inc}>Add potato</button>
    
    <p>Number of potatoes: {count}</p>
    
    <div class="potatoes">
        {#each Array(count) as _}
            <div>🥔</div>
        {/each}
    </div>
</div>