# Panelrapport — frontend och systemarkitektur

**Datum:** 2026-07-29
**Underlag:** kodbasen vid commit `d93d922` (10 328 rader)
**Metod:** fyra agenter analyserade kodbasen oberoende i två par med motsatta utgångspunkter, fick sedan varandras slutsatser och skrev replik. Alla påståenden med filhänvisning nedan är verifierade mot koden.

---

## Innehåll

- [Panel 1 — Frontend](#panel-1--frontend)
- [Panel 2 — Listprofiler, mallar och recept](#panel-2--listprofiler-mallar-och-recept)
- [Verifierade fynd](#verifierade-fynd)
- [Genomförandeplan och brancher](#genomförandeplan-och-brancher)
- [Öppna frågor](#öppna-frågor)

---

## Panel 1 — Frontend

Deltagare: en UX-/interaktionsdesigner och en pragmatisk frontendarkitekt. De började med motsatta prioriteringar — "gör appen vackrare" mot "laga fundamentet först" — och landade i samma ordning efter att båda korrigerat sig på sak.

### Korrigering under diskussionen

Arkitekten hävdade att varje realtidsuppdatering ritar om hela varulistan, och att fler animationer därför skulle förvärra ryckigheten. Designern kontrollerade och visade att det inte stämmer: båda de stora `{#each}`-blocken är nycklade (`CategorySection.svelte:65` på `item.itemId`, `inkopslista/[id]/+page.svelte:433` på `section.category.id`), så DOM-noderna återanvänds och `transition:slide` fyrar inte vid en uppdatering. Arkitekten accepterade rättelsen.

Slutsatsen överlevde ändå, men på en annan grund: problemet är inte renderingskostnaden utan att hela listobjektet ersätts, vilket öppnar för att gammal data skriver över ny.

### Huvudfynd: gränssnittet ljuger på två ställen

**Bockar kan studsa tillbaka.** `toggleBought` uppdaterar lokalt och skickar en PATCH. Servern svarar med hela listdokumentet, som ersätter det lokala (`shopping-context.svelte.js:98-101`). Bockar man av flera varor snabbt kan ett svar som beskriver läget före den andra bocken landa efteråt och nolla den, tills nästa svar rättar det. Ur användarens perspektiv hoppar kryssrutan tillbaka av sig själv. Det inträffar särskilt när två personer handlar samtidigt — appens huvudsakliga användningsfall.

**"Sparat!" är inte sant.** `setStoreLayout` (`store-context.svelte.js:112-123`) kontrollerar aldrig `res.ok`, har ingen rollback och visar ingen felavisering. `StoreEditor.svelte:158` sätter `saved = true` oavsett utfall. En misslyckad sparning av en varuhusrutt är helt osynlig tills butiken sorteras fel nästa gång.

**Skyddsvakt saknas i ena seed-vägen.** `seedAll` räknar upp `#seedGen` (`shopping-context.svelte.js:49`) så att ett `/api/lists`-svar i luften kan förkastas (rad 67, med förklarande kommentar på rad 66). `seedList` (rad 106-110) gör inte det — en äldre serverögonblicksbild kan därför skriva över färskare data.

### Handelsläget

Designerns tyngsta observation, som arkitekten först missade och sedan gav rätt till: handelsläget lämnar kvar hela appskalet. Header och navigation ligger kvar sticky medan användaren står i butiken med telefonen i ena handen. Handelsläget krymper bara padding (`inkopslista/[id]/+page.svelte:966-981`).

Orsaken är strukturell, inte kosmetisk: `shoppingMode` är sidlokal `$state` (`inkopslista/[id]/+page.svelte:50`), så `+layout.svelte` kan omöjligt reagera på det.

### Designsystemet bär ingenting

`app.css` definierar cirka 35 tokens och komplett mörkt läge i två varianter, med no-flash-skript i `app.html`. Men:

- `var(--radius*)` används 2 gånger; cirka 83 hörnradier är hårdkodade
- `#f97316` (varumärkesorange) förekommer i 20 filer trots att `--color-primary` finns — mörkt läge kan därför inte justera fokusfärgen någonstans
- orange/magenta-gradienten är kopierad 19 gånger i 13 filer
- 37 distinkta `font-size`-värden, mest i `em`, vilket kompounderar olika beroende på förälder
- `.page` är deklarerad identiskt i 11 filer
- `aria-live` förekommer 0 gånger — felmeddelanden når aldrig skärmläsare
- `prefers-reduced-motion` förekommer 0 gånger
- `app.css:181-184` har kommentaren "minimum 44px" men sätter 36px, och överskrivs av 33 `min-height: unset`

### Gemensam prioritering

1. **Gör datalagret ärligt** — felhantering och rollback på ruttsparningen, ekodämpning på realtidsuppdateringar, skyddsvakt på `seedList`. Måste komma först; allt annat är kosmetik ovanpå två gränssnitt som ljuger.
2. **Handelsläget som eget helskärmsläge** — dölj header och nav, fixerad förloppsrad, avsluta-knapp med safe-area, `wakeLock`. Buntas med `aria-live` och `prefers-reduced-motion` eftersom samma filer ändå berörs.
3. **Laddordningen** — `/mallar` saknar `+page.server.js` helt, och inbjudningarna hämtas alltid klientsida och knuffar ned listkorten när de landar.
4. **Designtokens och delade klasser** — sist för användaren, men förutsättning för all framtida sidomdesign.

Designern föreslog ursprungligen skeletonladdare men backade när hen såg att fyra av fem sidor redan har server-laddning: rätt fix är laddordningen, inte att dölja väntetiden.

### Vad båda ville vänta med

- Att låta köpta varor sjunka nedåt i listan — blir bra först efter steg 1, annars förstärks studsande bockar visuellt till en rad som åker ned och upp igen
- Omdesign av inställnings- och mallsidorna (815 respektive 814 rader, mest duplicerad CSS) — rita om efter att duplikationen är borta
- Dra-och-släpp-polish i `StoreEditor` — komponenten har en tyst sparningsbugg som måste lagas först

---

## Panel 2 — Listprofiler, mallar och recept

Deltagare: en förespråkare för att bygga vidare på listprofiler och en förespråkare för radikal förenkling. Diskussionen avgjordes tydligt — profilförespråkaren tog tillbaka tre av sina egna huvudargument.

### Kärnobservationen, som båda kom fram till oberoende

Varor lagrar `category` som en textsträng (`api/lists/[id]/items/+server.js`), och varuhusrutter nycklas på kategorinamn (`stores.categoryOrder`). Ingenting joinar på profilens kategori-`id`.

Listprofilen är alltså inte en datamodell — den är en whitelist och en färgpalett. Koden vet redan om det: `sortedCategories` i listvyn har en `extra:`-gren som skapar pseudokategorier för varor vars kategorinamn inte finns i profilen. Fria kategorinamn är redan produktionsverklighet.

### Varför recept fällde avgörandet

Profilförespråkaren hade hävdat att recept passar exakt in i profilmodellen. Hen tog tillbaka det med två skäl:

1. Ett recept spänner per definition över kategorier *inom* Livsmedel. Profilvalet blir ett obligatoriskt val med exakt ett giltigt svar.
2. Ett publikt delbart recept kan inte referera till någons privata profil-`ObjectId`. Recept behöver kategorinamn som mappas mot mottagarens palett vid import — mappning vid importtillfället, inte en bindning i dokumentet.

Motsvarande för varuhus: sorteringen faller redan tillbaka på `Infinity` för okända kategorier (`inkopslista/[id]/+page.svelte:134-136`), så en Ica-rutt utan "VVS" är harmlös i en bygglista. Bindningen `stores.profileId` köper lite och orsakar den värsta buggen vi har.

### Överenskommen målmodell

**Platt kategoripalett per användare, med valfri gruppetikett.** Profiler kollapsar från egna dokument till ett nullable fält på kategorin.

Skillnaden mot dagens modell är strukturell, inte kosmetisk. En etikett har ingen ägare, ingen livscykel och ingen plats i tre andra dokument — vilket gör samtliga fem verifierade fel nedan omöjliga. "Övrigt" finns en gång i stället för fyra. Att byta grupp på en lista blir ett klick i stället för en omöjlighet.

Två invändningar överlevde replikrundan och fick svar:

- **Rutteditorn** skulle bli en vägg av 30 kategorier (`StoreEditor.svelte:22-23` bygger `available` som alla kategorier minus de i rutten). Lösning: filtrera editorn på gruppetiketten.
- **Kallstart** — frekvenssortering ger noll signal på en helt ny lista, precis när valet är svårast. Föreslagen lösning: rendera paletten grupperad och låta listans grupp härledas i stället för att efterfrågas.

  *Utfall:* den första commiten på `refactor/platt-kategoripalett` plattade bara ut datamodellen och lämnade kallstarten olöst — hela paletten visades som en enda vägg av chips. Den grupperade väljaren och den härledda gruppen kom först i en senare commit på samma branch. I slutresultatet gäller: en tom lista visar paletten grupperad under rubriker; gruppen härleds ur de varor som redan ligger i listan, och på en tom lista sätter det första kategorivalet gruppen. Filtret går alltid att slå av med "Visa alla" eller "Byt grupp". Något profilbyte finns inte kvar — det behövs inte när det inte finns några profiler.

### Mallar och recept

Samma collection med ett `kind`-fält (`'template' | 'recipe'`). Ett recept är en namngiven varusamling med portioner. Import får en skalfaktor. Delning via `shareToken` och en publik läsvy; "spara till mina" kopierar dokumentet och mappar kategorinamn mot mottagarens palett.

---

## Verifierade fynd

Följande är kontrollerat direkt i koden, inte enbart rapporterat av en agent.

| # | Fynd | Plats | Konsekvens för användaren |
|---|---|---|---|
| 1 | `store.profileId === list?.profileId` krävs för att applicera rutt | `inkopslista/[id]/+page.svelte:130` | Den man delar en lista med får **aldrig** sin varuhussortering |
| 2 | Ingen `PATCH` på listan | `api/lists/[id]/+server.js` (bara GET, DELETE) | Fel profil på en lista går bara att ångra genom att radera listan |
| 3 | `profileId` typkontrolleras men slås aldrig upp | `api/lists/+server.js:26`, `api/stores/+server.js:24` | Listor och varuhus kan peka på profiler som inte finns. Endast `templates` validerar (`api/templates/+server.js:33-36`) |
| 4 | Kategorinamnbyte uppdaterar bara profildokumentet | `api/listprofiles/[id]/categories/[catId]/+server.js:41-44` | Varor hamnar i pseudokategorier, varuhusrutten slutar gälla för dem |
| 5 | Profilradering kollar listor och varuhus men inte mallar | `api/listprofiles/[id]/+server.js:32-36` | Mall blir kvar med `profileId` som pekar i tomma intet → tom kategoriväljare |
| 6 | `setStoreLayout` saknar `res.ok`, rollback och toast | `store-context.svelte.js:112-123` | "Sparat!" visas på en 500:a; ruttändringen försvinner tyst |
| 7 | `seedList` saknar `#seedGen`-vakten som `seedAll` har | `shopping-context.svelte.js:106-110` | Äldre serverdata kan skriva över färskare |
| 8 | `applyUpdate` ersätter hela listobjektet, ingen ekodämpning | `shopping-context.svelte.js:98-101` | Snabba avbockningar kan studsa tillbaka |
| 9 | `aria-live` finns inte i kodbasen | 0 träffar i `src/` | Felmeddelanden når aldrig skärmläsare |
| 10 | `prefers-reduced-motion` finns inte | 0 träffar i `src/` | Rörelse kan inte stängas av |
| 11 | `refreshList` är död kod | `shopping-context.svelte.js:84` | — men kommentaren på rad 82 påstår att den används för pollning, vilket är källan till att CLAUDE.md är felaktig |
| 12 | `/mallar` saknar `+page.server.js` | `src/routes/mallar/` | Sidan väntar på hydrering innan data hämtas |
| 13 | `var(--radius*)` används 2 gånger | `src/` | ~83 hårdkodade hörnradier |
| 14 | `#f97316` i 20 filer | `src/` | Mörkt läge kan inte justera fokusfärgen |
| 15 | 33 `min-height: unset` | `src/` | Träffytor under rekommenderad storlek, bland annat på destruktiva knappar |

### Dokumentationsfel

CLAUDE.md beskriver pollning var 15:e sekund i handelsläge och ett offlinebanner efter `pollFailures >= 2`. Pollningen är borttagen — SSE är enda kanalen, och `refreshList` anropas ingenstans. Avsnittet "Handelsläge" behöver rättas.

---

## Genomförandeplan och brancher

Varje del låg på egen branch från `main` för att kunna granskas och förkastas oberoende. Alla tio är numera hopslagna på `integration`. Tabellerna nedan beskriver **slutresultatet efter sammanslagningen**, inte den ursprungliga planen.

### Frontend

| Branch | Slutresultat | Fynd |
|---|---|---|
| `fix/realtid-och-sparning` | `setStoreLayout` rullar tillbaka och toastar; SSE-ögonblicksbilder som beskriver ett läge före en egen mutation kastas och stäms av efteråt; `#mutating`-wrappern släpper taget efter 15 s så ett hängande anrop inte låser ute strömmen; `seedList` har generationsvakt | 6, 7, 8 |
| `update/handelslage-helskarm` | `data-shopping` på `<html>` gömmer header, nav och verifieringsbanner; fixerad förloppsrad och avsluta-knapp med safe-area; `wakeLock` återtas vid `visibilitychange`; `aria-live` på Toast; `prefers-reduced-motion`; 44px träffytor i handelsläget | 9, 10 |
| `update/laddordning` | `/mallar` har `+page.server.js`; inbjudningar kommer via server-load; seed-metoderna har vakt mot svar i luften; `refreshList` borttagen; CLAUDE.md rättad om pollningen | 11, 12 |
| `refactor/designtokens` | Tokens i bruk för gradient, radier och färger; `.page`, `.page-doc`, `.page-center` och `.card` delade i `app.css`; tomt tillstånd på listöversikten | 13, 14, 15 |

### Arkitektur

| Branch | Slutresultat | Fynd |
|---|---|---|
| `fix/delad-lista-sortering` | Villkoret `store.profileId === list.profileId` borta — varuhusrutten är namnbaserad och gäller nu även i en delad lista. Profilvalideringen och mallchecken föll bort när profilerna gjorde det; ImportModals profilfiltrering likaså, eftersom mallar inte längre har någon profil | 1, (3, 5 upplösta) |
| `update/avblockera-flodena` | Kategori är valfri, och ett klick på den valda kategorin tar bort valet igen. Profilbytaren och `PATCH /api/lists/[id]` slogs *inte* ihop: fynd 2 handlade om att rätta ett profilval, och under den platta paletten finns inget profilval att rätta | (2 upplöst) |
| `fix/kategorinamnbyte` | Namnbytet kaskaderar till ägarens varor, mallar och varuhusrutter via `renameCategoryEverywhere()` i `lib/server/categories.js`, anropad från `PATCH /api/categories/[id]` | 4 |
| `refactor/platt-kategoripalett` | `users.categories[]` med `group`, `/api/categories`, `category-context`, grupperad väljare med härledd grupp, engångsmigrering i `getUserCategories()`. `listprofiles` läses bara vid migrering; `profileId` finns kvar som oanvänt fält på `lists` och `stores` | — |
| `add/recept` | `kind` på `templates`, portioner, skalfaktor vid import, `shareToken` och publik läsvy på `/r/[token]`, "spara som egen kopia" | — |
| `docs/panelrapport` | Det här dokumentet | — |

`refactor/platt-kategoripalett` var den enda brytande ändringen. Den togs med, vilket gör att fynd 2, 3 och 5 aldrig behövde egna åtgärder — de handlade alla om listprofilens livscykel.

---

## Öppna frågor

**Mätning inför utplattningen.** Hur många användare har fler än en listprofil *med aktiva listor i*? Är svaret "få" är utplattningen självklar. Är svaret "de flesta" bör profiler i stället göras kanoniska med riktiga `categoryId`-referenser. Beslutet bör tas på data. Övriga brancher är rätt oavsett utfall.

**Vad som faktiskt bryts vid utplattning.** Dubbletter av kategorinamn slås ihop — fyra profilers "Övrigt" blir en. En kategori kan tappa sin färg till förmån för en namne. Kategoriväljaren visar fler alternativ innan gruppfiltret slår till. Ingen lista, vara, mall eller rutt tappar innehåll.

**Kvarvarande svaghet i den platta modellen, ärligt redovisad.** I en lista man är inbjuden till kan man inte skriva om ägarens kategoristrängar, så ett namnbyte slår inte igenom där. En kanonisk `categoryId`-modell har inte det problemet, men kräver migrering av allt befintligt innehåll. Panelen bedömde att 15 raders omdöpningsmigrering är rätt avvägning för något man gör sällan.
