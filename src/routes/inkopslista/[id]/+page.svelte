<script>
    // Detail page for a single shopping list.
    // Supports two modes: edit mode (add/remove/edit items) and shopping mode (check off items).
    import { shoppingContext } from "$lib/context/shopping-context.svelte";
    import { authContext } from "$lib/context/auth-context.svelte";
    import { storeContext } from "$lib/context/store-context.svelte";
    import SharePanel from "$lib/components/SharePanel.svelte";
    import CategorySection from "$lib/components/CategorySection.svelte";
    import ImportModal from "$lib/components/ImportModal.svelte";
    import AmountField from "$lib/components/AmountField.svelte";
    import Button from "$lib/components/ui/Button.svelte";
    import ProgressBar from "$lib/components/ui/ProgressBar.svelte";
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import MapPin from '@lucide/svelte/icons/map-pin';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import Ellipsis from '@lucide/svelte/icons/ellipsis';
    import Plus from '@lucide/svelte/icons/plus';
    import Search from '@lucide/svelte/icons/search';
    import X from '@lucide/svelte/icons/x';
    import { templateContext } from "$lib/context/template-context.svelte";
    import { parseLeadingAmount, parseQuantityInput, formatQuantity, formatAmount } from "$lib/units";
    import { collectSpecSuggestions } from "$lib/suggestions";
    import { untrack } from 'svelte';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { fade, slide, fly } from 'svelte/transition';

    let { data } = $props();

    const id = $derived(page.params.id ?? '');

    // Listan kommer med från server-load — seedas före första render så sidan
    // visas direkt istället för att vänta på layoutens /api/lists-hämtning.
    //
    // seedList() läser lists för att hitta rätt plats. Utan untrack blir lists ett
    // beroende för effekten, och då skulle varje senare ändring — en avbockning,
    // en SSE-uppdatering — väcka effekten och skriva tillbaka server-snapshotten.
    // Seedningen ska bara ske när server-datan faktiskt är ny.
    $effect.pre(() => {
        const seed = data.list;
        if (seed) untrack(() => shoppingContext.seedList(seed));
    });

    // Faller tillbaka på server-datan: under SSR och fram till första flush efter
    // hydrering är contexten tom, och utan fallback renderas "Listan hittades
    // inte" trots att listan finns.
    const seededList = $derived(
        /** @type {import('$lib/context/shopping-context.svelte').ShoppingList | null} */ (data.list ?? null)
    );
    const list = $derived(shoppingContext.getList(id) ?? seededList);
    const username = $derived(authContext.user?.username ?? '');
    // Only the owner can delete the list or share it with others.
    const isOwner = $derived(list?.owner === username);
    const isShared = $derived((list?.sharedWith?.length ?? 0) > 0);

    let newItem = $state('');
    let spec = $state('');
    // Rå text, inte ett tal: tomt ska förbli tomt och aldrig hoppa till 1.
    let newAmount = $state('');
    let newUnit = $state('');
    /** @type {HTMLInputElement | null} */
    let itemInputEl = $state(null);
    let selectedCategory = $state('');
    let showImportModal = $state(false);
    let shoppingMode = $state(false);
    let showSharePanel = $state(false);
    let search = $state('');
    let showHistory = $state(false);
    let sseConnected = $state(false);
    let sseHasConnected = $state(false);
    let confirmDeleteList = $state(false);
    let confirmClearAll = $state(false);
    let confirmLeaveList = $state(false);
    let showAddedBy = $state(false);

    // Persist the last-used category per list in sessionStorage so it's
    // pre-selected when the user navigates back to the same list.
    // If the profile only has one category (e.g. Generisk lista), auto-select it.
    $effect(() => {
        if (!browser) return;
        const saved = sessionStorage.getItem(`lastCategory_${id}`);
        if (saved) {
            selectedCategory = saved;
        } else if (ownerCategories.length === 1) {
            selectedCategory = ownerCategories[0].name;
        } else {
            selectedCategory = '';
        }
    });

    $effect(() => {
        if (!browser) return;
        const saved = localStorage.getItem(`mazeshopper_showAddedBy_${id}`);
        if (saved === 'true') showAddedBy = true;
    });

    $effect(() => {
        if (!browser) return;
        localStorage.setItem(`mazeshopper_showAddedBy_${id}`, String(showAddedBy));
    });

    $effect(() => {
        if (!browser) return;
        // Avmarkering ska också sparas, annars kommer den bortvalda kategorin
        // tillbaka nästa gång listan öppnas.
        if (selectedCategory) sessionStorage.setItem(`lastCategory_${id}`, selectedCategory);
        else sessionStorage.removeItem(`lastCategory_${id}`);
    });

    // Connect to the SSE stream for this list so all collaborators see changes in real-time.
    // EventSource reconnects automatically on error; we just track connection state for the UI.
    $effect(() => {
        if (!browser || !id) return;
        const es = new EventSource(`/api/lists/${id}/stream`);
        es.onopen = () => { sseConnected = true; sseHasConnected = true; };
        es.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.deleted) { goto('/inkopslista'); return; }
            shoppingContext.applyUpdate(data);
        };
        es.onerror = () => { sseConnected = false; };
        return () => es.close();
    });

    // Servern stänger strömmen med jämna mellanrum (funktioner har en maxlivslängd),
    // så korta avbrott är normala och löser sig på ett ögonblick. Vänta därför in
    // återanslutningen innan varningen visas — annars blinkar den mitt i handlingen.
    let showOffline = $state(false);
    $effect(() => {
        if (!sseHasConnected || sseConnected) {
            showOffline = false;
            return;
        }
        const timer = setTimeout(() => { showOffline = true; }, 6000);
        return () => clearTimeout(timer);
    });

    const boughtCount = $derived(list?.items.filter(i => i.bought).length ?? 0);
    const totalCount = $derived(list?.items.length ?? 0);

    // Handelsläget behöver synas utanför den här sidan: header och nav ligger i
    // layouten och går inte att nå härifrån. Attributet på <html> låter dem
    // gömma sig, så att hela skärmen tillhör listan när man står i butiken.
    $effect(() => {
        if (!browser || !shoppingMode) return;
        document.documentElement.dataset.shopping = 'true';
        return () => { delete document.documentElement.dataset.shopping; };
    });

    // Skärmen ska inte slockna mitt i en handlingsrunda. Webbläsaren släpper
    // låset när fliken döljs, så det måste tas om när man kommer tillbaka.
    $effect(() => {
        if (!browser || !shoppingMode) return;
        const wakeLock = /** @type {any} */ (navigator).wakeLock;
        if (!wakeLock) return;

        /** @type {any} */
        let lock = null;
        let cancelled = false;

        const acquire = async () => {
            if (cancelled || lock || document.visibilityState !== 'visible') return;
            try {
                const held = await wakeLock.request('screen');
                if (cancelled) held.release().catch(() => {});
                else lock = held;
            } catch { /* kan nekas vid t.ex. låg batterinivå — handlingen fungerar ändå */ }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') acquire();
            else lock = null; // redan släppt av webbläsaren
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        acquire();

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            lock?.release().catch(() => {});
        };
    });

    // Kategorierna kommer ur ägarens palett via server-loaden, så alla som
    // delar listan ser samma namn och färger.
    const ownerCategories = $derived(
        /** @type {{ id: string, name: string, color: string, group: string | null }[]} */ (data.categories ?? [])
    );

    // Grupperna som finns representerade i ägarens palett.
    const groups = $derived([...new Set(ownerCategories.map(c => c.group).filter(Boolean))]);

    // Listans grupp härleds från varorna som redan ligger i den, så en lista
    // med innehåll ställer in sig själv.
    const derivedGroup = $derived.by(() => {
        if (!list) return null;
        for (const item of list.items) {
            const group = ownerCategories.find(c => c.name === item.category)?.group;
            if (group) return group;
        }
        return null;
    });

    // Senast använda grupp, delad mellan listor. Gör att en ny tom lista
    // gissar rätt för de allra flesta istället för att fråga.
    let lastUsedGroup = $state('');

    // Explicit val i rullgardinen. Tom sträng betyder "alla kategorier" och
    // vinner därför över härledningen — null betyder "inget val gjort än".
    /** @type {string | null} */
    let groupChoice = $state(null);

    $effect(() => {
        if (!browser) return;
        groupChoice = sessionStorage.getItem(`listGroup_${id}`);
        lastUsedGroup = localStorage.getItem('mazeshopper_lastGroup') ?? '';
    });

    const activeGroup = $derived(
        groupChoice ?? derivedGroup ?? (groups.includes(lastUsedGroup) ? lastUsedGroup : groups[0] ?? '')
    );

    const pickerCategories = $derived(
        !activeGroup
            ? ownerCategories
            // Ogrupperade kategorier är universella och följer alltid med,
            // annars gick "Övrigt" inte att välja så fort ett filter var aktivt.
            : ownerCategories.filter(c => c.group === activeGroup || !c.group)
    );

    /** @param {string} group */
    function chooseGroup(group) {
        groupChoice = group;
        if (!browser) return;
        sessionStorage.setItem(`listGroup_${id}`, group);
        if (group) localStorage.setItem('mazeshopper_lastGroup', group);
    }

    /** @param {{ name: string }} category */
    function pickCategory(category) {
        // Kategori är valfritt, så ett klick på den valda kategorin tar bort
        // valet igen istället för att låsa fast det.
        selectedCategory = selectedCategory === category.name ? '' : category.name;
    }

    const sortedCategories = $derived.by(() => {
        const store = storeContext.selectedStore;
        // Rutten är namnbaserad och kategorier den saknar sorteras sist, så den
        // gäller oavsett var kategorierna kommer ifrån. Villkoret som krävde
        // samma profil gjorde att den man delade en lista med aldrig fick
        // sortering — mottagarens varuhus hörde till mottagarens egna profiler.
        const base = (!store || Object.keys(store.categoryOrder).length === 0)
            ? ownerCategories
            : [...ownerCategories].sort((a, b) => {
                const pa = store.categoryOrder[a.name] ?? Infinity;
                const pb = store.categoryOrder[b.name] ?? Infinity;
                return pa - pb;
            });

        if (!list) return base;
        // A shared list may contain items with categories not in the profile.
        // Append any unknown categories so those items are still visible.
        const knownNames = new Set(base.map(c => c.name));
        const extraNames = [...new Set(list.items.map(i => i.category))].filter(n => n && !knownNames.has(n));
        if (extraNames.length === 0) return base;
        // Prefixas så ett kategorinamn aldrig kan krocka med pseudokategorins id.
        const extras = extraNames.map(name => ({ id: `extra:${name}`, name, color: '#e2e8f0' }));
        return [...base, ...extras];
    });

    // Varor kan sakna kategori — t.ex. importerade från en mall där kategori är
    // valfritt. Utan en egen hink filtrerades de bort ur alla sektioner och blev
    // osynliga, trots att de räknades i "X av Y varor köpta".
    //
    // Namnet får inte vara "Övrigt": samtliga standardprofiler har redan en
    // riktig kategori med det namnet, och två likadana rubriker vore omöjliga
    // att skilja åt.
    const UNCATEGORIZED = { id: '__uncategorized__', name: 'Utan kategori', color: '#e2e8f0' };

    // Filters the item list by the search query, matching on both name and spec.
    const filteredItems = $derived.by(() => {
        if (!list) return [];
        const q = search.trim().toLowerCase();
        if (!q) return list.items;
        return list.items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.spec.toLowerCase().includes(q)
        );
    });

    // Grupperar varorna i ett enda svep istället för en filtrering per kategori,
    // som annars körs om vid varje bock-av.
    const sections = $derived.by(() => {
        /** @type {Map<string, typeof filteredItems>} */
        const byCategory = new Map();
        for (const item of filteredItems) {
            const key = item.category || UNCATEGORIZED.id;
            const bucket = byCategory.get(key);
            if (bucket) bucket.push(item);
            else byCategory.set(key, [item]);
        }

        const result = [];
        for (const category of sortedCategories) {
            const items = byCategory.get(category.name);
            if (items?.length) result.push({ category, items });
        }
        const uncategorized = byCategory.get(UNCATEGORIZED.id);
        if (uncategorized?.length) result.push({ category: UNCATEGORIZED, items: uncategorized });
        return result;
    });

    const listHistory = $derived(shoppingContext.recentlyBought[id] ?? []);

    // Förslag till spec-fältet, hämtade ur det användaren redan skrivit.
    const specSuggestions = $derived(
        collectSpecSuggestions(shoppingContext.lists, templateContext.templates)
    );

    // "3 dl grädde" i varunamnet delas upp i namn, mängd och enhet. Bara när
    // mängdfältet står tomt — har man fyllt i en mängd själv är det den som
    // gäller. Tolkningen är ett hjälpmedel, inget lagringsformat.
    //
    // Returnerar true när uppdelningen behöver granskas innan varan läggs till.
    // Står en enhet utskriven är tolkningen entydig och varan går in direkt:
    // tio ingredienser i rad ska kosta tio tryck, inte tjugo. Ett ensamt tal
    // ("2 mjölk") kan lika gärna höra till namnet, och där är pausen värd sitt
    // tryck — de ifyllda fälten syns och går att rätta.
    function absorbAmountShortcut() {
        if (newAmount.trim()) return false;
        const parsed = parseLeadingAmount(newItem);
        if (!parsed) return false;
        newItem = parsed.name;
        newAmount = formatQuantity(parsed.quantity);
        newUnit = parsed.unit;
        return parsed.unit === '';
    }

    // Kategori är valfri. Varor utan kategori hamnar i "Utan kategori", en hink
    // som redan finns för importerade varor — att kräva ett val innan man får
    // skriva sin första vara var ett steg utan motsvarande nytta.
    async function addItem() {
        // Kräver uppdelningen granskning stannar vi här — de ifyllda fälten
        // ska hinna synas så att en feltolkning går att rätta först.
        if (absorbAmountShortcut()) return;

        const name = newItem.trim();
        if (name.length === 0) return;

        // Varan läggs in optimistiskt i listan, så fälten töms direkt istället för
        // att låsas medan servern svarar. Det gör att flera varor kan matas in i
        // följd utan att vänta. Vid fel rullas varan tillbaka och en toast visas.
        const itemSpec = spec.trim();
        const amount = { quantity: parseQuantityInput(newAmount), unit: newUnit };
        const prevAmount = newAmount;
        newItem = '';
        spec = '';
        // Enheten nollställs med mängden. Skulle "dl" ligga kvar blev nästa vara
        // man skriver en mängd för plötsligt "2 dl bananer".
        newAmount = '';
        newUnit = '';
        itemInputEl?.focus();
        const ok = await shoppingContext.addItem(id, name, itemSpec, selectedCategory, username, amount);
        // Ge tillbaka inmatningen vid fel, annars ber toasten användaren försöka
        // igen med tomma fält. Skriv bara över om inget nytt hunnit skrivas.
        if (!ok && newItem === '' && spec === '' && newAmount === '') {
            newItem = name;
            spec = itemSpec;
            newAmount = prevAmount;
            newUnit = amount.unit;
        }
    }

    async function deleteList() {
        const ok = await shoppingContext.deleteList(id);
        if (ok) goto('/inkopslista');
        else confirmDeleteList = false;
    }

    async function leaveList() {
        const ok = await shoppingContext.leaveList(id, username);
        if (ok) goto('/inkopslista');
        else confirmLeaveList = false;
    }

    // "grädde 3 dl" i historiken. Ett ensamt styck skriver vi inte ut — det
    // säger inget som namnet inte redan säger.
    /** @param {import('$lib/context/shopping-context.svelte').ShoppingItem} item */
    function historyLabel(item) {
        const amount = formatAmount(item.quantity, item.unit);
        return amount && amount !== '1' ? `${item.name} ${amount}` : item.name;
    }

    /** @param {string} dateStr */
    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    // ── Presentation ────────────────────────────────────────────────────────

    const remainingCount = $derived(totalCount - boughtCount);
    const hasRoute = $derived(Object.keys(storeContext.selectedStore?.categoryOrder ?? {}).length > 0);

    // Stoppnumret är avdelningens plats i det valda varuhusets rutt (1, 2, 3 …).
    // Varuhusen sparar ingen riktig gångnumrering, så numret står för ordningen
    // man går i — inte för skylten i taket. Utan rutt visas inget nummer.
    /** @param {{ name: string }} category */
    function stopFor(category) {
        return storeContext.selectedStore?.categoryOrder[category.name] ?? null;
    }

    // Första avdelningen med något kvar att plocka. Allt före den är klart,
    // allt efter är kommande stopp.
    const currentSectionIndex = $derived(
        sections.findIndex(s => s.items.some(i => !i.bought))
    );

    const sectionStates = $derived(
        sections.map((s, i) =>
            s.items.every(item => item.bought) ? 'done'
            : i === currentSectionIndex ? 'current'
            : 'upcoming'
        )
    );
    const doneSections = $derived(sectionStates.filter(st => st === 'done').length);

    // Menyn samlar listans mindre vanliga åtgärder bakom en knapp, så att
    // huvudet bara bär det man behöver medan man handlar.
    let menuOpen = $state(false);
    /** @type {HTMLElement | null} */
    let menuEl = $state(null);

    /** @param {MouseEvent} e */
    function closeMenuOnOutsideClick(e) {
        if (menuOpen && menuEl && !menuEl.contains(/** @type {Node} */ (e.target))) menuOpen = false;
    }

    // "Lägg till" i bottenpanelen: hoppa upp till fältet och börja skriva.
    function focusAddField() {
        itemInputEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        itemInputEl?.focus({ preventScroll: true });
    }

    function startShopping() {
        shoppingMode = true;
        showSharePanel = false;
        menuOpen = false;
    }

    function stopShopping() {
        shoppingMode = false;
        showSharePanel = false;
        menuOpen = false;
    }
</script>

<svelte:head><title>{list?.name ? `${list.name} – MazeShopper` : 'MazeShopper'}</title></svelte:head>

<svelte:window
    onclick={closeMenuOnOutsideClick}
    onkeydown={(e) => { if (e.key === 'Escape') menuOpen = false; }}
/>

{#if !list}
    <div class="page">
        <p>Listan hittades inte. <a href="/inkopslista">Tillbaka</a></p>
    </div>
{:else}
    <div class="page list-page" class:shopping-mode={shoppingMode}>

        <!-- Huvudet ligger fast medan listan scrollar under det. -->
        <div class="list-top">
            <div class="top-row">
                {#if !shoppingMode}
                    <a class="back" href="/inkopslista" aria-label="Tillbaka till listor">
                        <ArrowLeft size={20} aria-hidden="true" />
                    </a>
                {/if}

                {#if storeContext.stores.length > 0}
                    <label class="store-chip">
                        <MapPin size={16} aria-hidden="true" />
                        <span class="sr-only">Varuhus</span>
                        <select
                            value={storeContext.selectedStore?.id ?? ''}
                            onchange={(e) => storeContext.selectStore(e.currentTarget.value || null)}
                        >
                            <option value="">Ingen rutt</option>
                            {#each storeContext.stores as store (store.id)}
                                <option value={store.id}>{store.name}</option>
                            {/each}
                        </select>
                        <ChevronDown size={16} aria-hidden="true" />
                    </label>
                {/if}

                <div class="menu" bind:this={menuEl}>
                    <button
                        class="menu-button"
                        aria-label="Fler val för listan"
                        aria-expanded={menuOpen}
                        aria-controls="list-menu"
                        onclick={() => (menuOpen = !menuOpen)}
                    >
                        <Ellipsis size={22} aria-hidden="true" />
                    </button>

                    {#if menuOpen}
                        <div id="list-menu" class="menu-panel" transition:fly={{ y: -4, duration: 150 }}>
                            {#if !shoppingMode && isOwner}
                                <button class="menu-item" onclick={() => { showSharePanel = !showSharePanel; menuOpen = false; }}>
                                    Dela listan
                                </button>
                            {/if}
                            {#if isShared}
                                <button
                                    class="menu-item"
                                    aria-pressed={showAddedBy}
                                    onclick={() => (showAddedBy = !showAddedBy)}
                                >
                                    Visa vem som lade till
                                    <span class="menu-state">{showAddedBy ? 'På' : 'Av'}</span>
                                </button>
                            {/if}
                            {#if shoppingMode}
                                <button
                                    class="menu-item"
                                    onclick={() => { shoppingContext.clearBought(id); menuOpen = false; }}
                                    disabled={!list.items.some(i => i.bought)}
                                >Rensa köpta varor</button>
                                {#if confirmClearAll}
                                    <div class="menu-confirm">
                                        <span>Töm hela listan?</span>
                                        <button class="btn-confirm-sm btn-confirm-sm--danger" onclick={() => { shoppingContext.clearAll(id); confirmClearAll = false; menuOpen = false; }}>Ja</button>
                                        <button class="btn-cancel" onclick={() => confirmClearAll = false}>Nej</button>
                                    </div>
                                {:else}
                                    <button
                                        class="menu-item menu-item--danger"
                                        onclick={() => confirmClearAll = true}
                                        disabled={list.items.length === 0}
                                    >Töm hela listan</button>
                                {/if}
                            {/if}
                            {#if !shoppingMode && isOwner}
                                {#if confirmDeleteList}
                                    <div class="menu-confirm">
                                        <span>Ta bort listan?</span>
                                        <button class="btn-confirm-sm btn-confirm-sm--danger" onclick={deleteList}>Ja</button>
                                        <button class="btn-cancel" onclick={() => confirmDeleteList = false}>Nej</button>
                                    </div>
                                {:else}
                                    <button class="menu-item menu-item--danger" onclick={() => confirmDeleteList = true}>Ta bort listan</button>
                                {/if}
                            {/if}
                            {#if !shoppingMode && !isOwner}
                                {#if confirmLeaveList}
                                    <div class="menu-confirm">
                                        <span>Lämna listan?</span>
                                        <button class="btn-confirm-sm btn-confirm-sm--danger" onclick={leaveList}>Ja</button>
                                        <button class="btn-cancel" onclick={() => confirmLeaveList = false}>Nej</button>
                                    </div>
                                {:else}
                                    <button class="menu-item menu-item--danger" onclick={() => confirmLeaveList = true}>Lämna listan</button>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <h1>{list.name}</h1>
            <p class="summary">
                <span class="mono">{totalCount} {totalCount === 1 ? 'vara' : 'varor'}</span>
                {#if !isOwner}<span> · delad av <strong>{list.owner}</strong></span>{/if}
            </p>

            {#if totalCount > 0}
                <div class="progress-block">
                    {#if shoppingMode && sections.length > 0}
                        <ProgressBar
                            value={doneSections}
                            max={sections.length}
                            label="Avdelningar klara"
                            segments={sectionStates}
                        />
                    {:else}
                        <ProgressBar value={boughtCount} max={totalCount} label="Varor i korgen" />
                    {/if}
                    <p class="progress-text"><span class="mono">{boughtCount}</span> av <span class="mono">{totalCount}</span> i korgen</p>
                </div>
            {/if}
        </div>

        <!-- Share panel -->
        {#if showSharePanel && isOwner && !shoppingMode}
            <div transition:fly={{ y: -6, duration: 200 }}>
                <SharePanel {list} listId={id} {username} onClose={() => (showSharePanel = false)} />
            </div>
        {/if}

        <!-- Offline indicator: shown when the SSE stream stays down past the grace period -->
        {#if showOffline}
            <div class="offline-badge" role="alert" transition:fade={{ duration: 250 }}>Ingen anslutning – listan uppdateras inte</div>
        {/if}

        <!-- Edit mode: add item form -->
        {#if !shoppingMode}
            <div class="add-card">
                <label class="sr-only" for="new-item">Vara</label>
                <input
                    id="new-item"
                    class="add-input"
                    bind:this={itemInputEl}
                    bind:value={newItem}
                    placeholder="Vara, t.ex. 3 dl grädde"
                    onblur={absorbAmountShortcut}
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <AmountField bind:amount={newAmount} bind:unit={newUnit} onEnter={addItem} />
                <label class="sr-only" for="new-spec">Specifikation</label>
                <input
                    id="new-spec"
                    class="add-input"
                    bind:value={spec}
                    placeholder="Specifikation (valfritt)"
                    list="spec-suggestions"
                    onkeydown={(e) => e.key === 'Enter' && addItem()}
                />
                <datalist id="spec-suggestions">
                    {#each specSuggestions as suggestion (suggestion)}
                        <option value={suggestion}></option>
                    {/each}
                </datalist>
                {#if groups.length > 1}
                    <!-- Rullgardinen talar för sig själv visuellt; etiketten
                         behövs bara för skärmläsare. -->
                    <select
                        class="group-select"
                        aria-label="Kategorigrupp"
                        value={activeGroup}
                        onchange={(e) => chooseGroup(e.currentTarget.value)}
                    >
                        {#each groups as group}
                            <option value={group}>{group}</option>
                        {/each}
                        <option value="">Alla kategorier</option>
                    </select>
                {/if}

                <div class="category-picker">
                    {#each pickerCategories as category}
                        <button
                            class="category-chip"
                            class:selected={selectedCategory === category.name}
                            style="--chip-color: {category.color}"
                            onclick={() => pickCategory(category)}
                        >
                            {category.name}
                        </button>
                    {/each}
                </div>
                <div class="add-actions">
                    <Button variant="secondary" onclick={addItem}>Lägg till vara</Button>
                    <button class="btn-import-template" onclick={() => showImportModal = true}>
                        Importera mall
                    </button>
                </div>
            </div>
        {/if}

        {#if showImportModal}
            <ImportModal
                onImport={(items, scale) => shoppingContext.importItems(id, items, scale, username)}
                onClose={() => showImportModal = false}
                {pickerCategories}
            />
        {/if}

        <!-- Search -->
        {#if list.items.length > 4}
            <div class="search-row" transition:slide={{ duration: 150 }}>
                <Search size={18} aria-hidden="true" />
                <input
                    bind:value={search}
                    placeholder="Sök vara…"
                    aria-label="Sök vara"
                    class="search-input"
                />
                {#if search}
                    <button class="btn-clear-search" aria-label="Rensa sökningen" onclick={() => (search = '')}>
                        <X size={18} aria-hidden="true" />
                    </button>
                {/if}
            </div>
        {/if}

        <!-- Items list -->
        <div class="items">
            {#if filteredItems.length === 0 && list.items.length > 0}
                <p class="empty-search">Inga varor matchar "{search}"</p>
            {:else if list.items.length === 0}
                <p class="empty-list">Listan är tom. Lägg till varor ovan.</p>
            {:else}
                {#each sections as section, i (section.category.id)}
                    <CategorySection
                        category={section.category}
                        categories={pickerCategories}
                        items={section.items}
                        {shoppingMode}
                        listId={id}
                        {showAddedBy}
                        stop={stopFor(section.category)}
                        upcoming={shoppingMode && sectionStates[i] === 'upcoming'}
                    />
                {/each}
            {/if}
        </div>

        <!-- Recently bought history (edit mode only) -->
        {#if !shoppingMode && listHistory.length > 0}
            <div class="history">
                <button class="history-toggle" aria-expanded={showHistory} onclick={() => (showHistory = !showHistory)}>
                    <span class="section-label">Senast inhandlat</span>
                    <span class="history-chevron" class:open={showHistory}><ChevronDown size={18} aria-hidden="true" /></span>
                </button>
                {#if showHistory}
                    <div class="history-entries">
                        {#each listHistory as entry}
                            <div class="history-entry">
                                <span class="history-date mono">{formatDate(entry.clearedAt)}</span>
                                <span class="history-items">
                                    {entry.items.map(historyLabel).join(', ')}
                                </span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Fast bottenpanel. Huvudhandlingen sitter där tummen når den. -->
        <div class="bottom-bar">
            {#if shoppingMode}
                <span class="remaining mono">{remainingCount} kvar</span>
                <Button onclick={stopShopping}>Avsluta handling</Button>
            {:else}
                <Button variant="secondary" onclick={focusAddField}>
                    {#snippet before()}<Plus size={18} aria-hidden="true" />{/snippet}
                    Lägg till
                </Button>
                <Button onclick={startShopping}>
                    {hasRoute ? 'Gå rutten' : 'Handla'}
                </Button>
            {/if}
        </div>

    </div>
{/if}

<style>
    /* ── Huvud ─────────────────────────────────────────────────────────── */

    .list-page {
        gap: 0.75rem;
        /* Plats för bottenpanelen så sista varan inte hamnar bakom den. */
        padding-bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom) + 1.5rem);
    }

    /* Ligger fast under appens huvud (56px). I handelsläget är appens huvud
       borta, och då ligger listans huvud fast högst upp. */
    .list-top {
        position: sticky;
        top: 56px;
        z-index: 50;
        margin: -1.5rem -1rem 0;
        padding: 1rem 1rem 0.75rem;
        background: var(--color-paper);
        border-bottom: 1px solid var(--color-line);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .shopping-mode .list-top {
        top: 0;
        padding-top: max(1rem, env(safe-area-inset-top));
    }

    .top-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
    }

    .back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        margin-left: -0.6rem;
        color: var(--color-ink);
        border-radius: var(--radius-md);
    }

    .back:hover { background: var(--bg-elevated); }

    /* Butiksvalet som en liten skylt. En riktig <select> under ytan, så
       tangentbord och skärmläsare får systemets egen väljare. */
    .store-chip {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        height: 36px;
        max-width: 60%;
        padding: 0 0.75rem;
        border: 1px solid var(--color-line);
        border-radius: var(--radius-pill);
        background: var(--color-surface);
        color: var(--color-ink);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
    }

    .store-chip:hover { border-color: var(--color-border); }

    .store-chip:focus-within {
        outline: 2px solid var(--color-green);
        outline-offset: 2px;
    }

    .store-chip select {
        appearance: none;
        -webkit-appearance: none;
        min-width: 0;
        border: none;
        background: none;
        background-image: none;
        color: inherit;
        font: inherit;
        padding: 0;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Ringen ritas på hela chippet istället. */
    .store-chip select:focus-visible { box-shadow: none; }

    .menu {
        position: relative;
        margin-left: auto;
    }

    .menu-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        margin-right: -0.6rem;
        padding: 0;
        border: none;
        border-radius: var(--radius-md);
        background: none;
        color: var(--color-ink);
        cursor: pointer;
    }

    .menu-button:hover,
    .menu-button[aria-expanded='true'] { background: var(--bg-elevated); }

    .menu-panel {
        position: absolute;
        top: calc(100% + 0.35rem);
        right: -0.6rem;
        z-index: 60;
        min-width: 15rem;
        padding: 0.35rem;
        background: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-modal);
        display: flex;
        flex-direction: column;
    }

    .menu-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: 44px;
        padding: 0 0.75rem;
        border: none;
        border-radius: var(--radius-md);
        background: none;
        color: var(--color-ink);
        font-size: 15px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
    }

    .menu-item:hover:not(:disabled) { background: var(--bg-elevated); }
    .menu-item:disabled { opacity: 0.45; cursor: not-allowed; }
    .menu-item--danger { color: var(--danger-text); }

    .menu-state {
        font-size: 13px;
        color: var(--color-muted);
    }

    .menu-confirm {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 44px;
        padding: 0 0.75rem;
        font-size: 14px;
        font-weight: 600;
        color: var(--danger-text);
    }

    .menu-confirm span { flex: 1; }

    .btn-confirm-sm {
        padding: 0.3rem 0.7rem;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 0.85em;
        font-weight: 600;
        cursor: pointer;
        min-height: unset;
    }

    .btn-confirm-sm--danger { background: var(--danger-text); color: var(--color-surface); }
    .btn-confirm-sm--danger:hover { background: var(--danger-text-hover); }

    .list-top h1 {
        margin: 0.25rem 0 0;
        overflow-wrap: anywhere;
    }

    .shopping-mode .list-top h1 { font-size: 26px; }

    .summary {
        margin: 0;
        font-size: 13px;
        color: var(--color-muted);
    }

    .summary strong { color: var(--color-ink); font-weight: 600; }

    .progress-block {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-top: 0.35rem;
    }

    .progress-text {
        margin: 0;
        font-size: 13px;
        color: var(--color-muted);
    }

    .offline-badge {
        background: var(--warning-bg);
        border: 1px solid var(--warning-border);
        border-radius: var(--radius-md);
        color: var(--warning-text);
        font-size: 13px;
        padding: 0.5rem 0.9rem;
        text-align: center;
    }

    /* ── Lägg till ─────────────────────────────────────────────────────── */

    .add-card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 1rem;
        background: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-lg);
    }

    .add-input {
        padding: 0.7rem 0.85rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 16px;
        outline: none;
        transition: border-color 0.15s;
        background: var(--color-surface);
        color: var(--color-ink);
        /* Hoppar man hit från bottenpanelen ska fältet inte hamna under det
           fasta huvudet. */
        scroll-margin-top: 14rem;
    }

    .add-input:focus { border-color: var(--color-green); }

    .add-actions {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .btn-import-template {
        min-height: 44px;
        padding: 0.5rem;
        background: none;
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-lg);
        font-size: 14px;
        font-weight: 500;
        color: var(--color-muted);
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s, background 0.15s;
    }

    .btn-import-template:hover {
        border-color: var(--color-ink);
        color: var(--color-ink);
    }

    /* ── Sök ───────────────────────────────────────────────────────────── */

    .search-row {
        position: relative;
        display: flex;
        align-items: center;
        color: var(--color-muted);
    }

    .search-row > :global(svg:first-child) {
        position: absolute;
        left: 0.8rem;
        pointer-events: none;
    }

    .search-input {
        width: 100%;
        padding: 0.65rem 2.6rem 0.65rem 2.5rem;
        border: 1px solid var(--color-line);
        border-radius: var(--radius-pill);
        font-size: 16px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-ink);
        transition: border-color 0.15s;
    }

    .search-input:focus { border-color: var(--color-green); }

    .btn-clear-search {
        position: absolute;
        right: 0.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: none;
        color: var(--color-muted);
        cursor: pointer;
    }

    .btn-clear-search:hover { color: var(--color-ink); }

    /* ── Varor ─────────────────────────────────────────────────────────── */

    .items {
        display: flex;
        flex-direction: column;
    }

    .empty-list, .empty-search {
        text-align: center;
        color: var(--color-muted);
        font-size: 15px;
        padding: 2.5rem 1rem;
        margin: 0;
    }

    /* ── Historik ──────────────────────────────────────────────────────── */

    .history { margin-top: 1rem; }

    .history-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        min-height: 44px;
        padding: 0;
        background: none;
        border: none;
        border-bottom: 1px solid var(--color-line);
        color: var(--color-muted);
        cursor: pointer;
        text-align: left;
    }

    .history-toggle:hover { color: var(--color-ink); }

    .history-chevron {
        display: flex;
        transform: rotate(-90deg);
        transition: transform var(--dur-base) var(--ease-out);
    }

    .history-chevron.open { transform: none; }

    .history-entries {
        display: flex;
        flex-direction: column;
    }

    .history-entry {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.75rem 0;
        border-bottom: 1px dashed var(--color-line);
        font-size: 14px;
    }

    .history-entry:last-child { border-bottom: none; }

    .history-date {
        color: var(--color-muted);
        font-size: 12px;
    }

    .history-items {
        color: var(--color-ink);
        line-height: 1.5;
    }

    /* ── Bottenpanel ───────────────────────────────────────────────────── */

    .bottom-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 80;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 12px max(1rem, calc((100% - 680px) / 2 + 1rem)) calc(12px + env(safe-area-inset-bottom));
        background: var(--color-paper);
        border-top: 1px solid var(--color-line);
    }

    /* Huvudhandlingen tar resten av bredden. */
    .bottom-bar > :global(.btn:last-child) { flex: 1; }

    .remaining {
        font-size: 15px;
        font-weight: 600;
        color: var(--color-ink);
        white-space: nowrap;
        padding: 0 0.25rem;
    }

    /* ── Handelsläge ───────────────────────────────────────────────────── */

    /* Hela skärmen tillhör listan här, så knapparna får full träffyta. */
    .page.shopping-mode :global(button) {
        min-height: 44px;
    }
</style>
