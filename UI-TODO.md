# UI-förbättringar — MazeShopper

Nulägesanalys och prioriterad att-göra-lista. Sorterad efter område, inte prioritet — välj själv vad som är viktigast att ta tag i härnäst.

---

## 1. Design tokens & konsistens

Just nu är alla värden hårdkodade spridda i varje fil. Det gör det svårt att byta utseende och lätt att råka ha olika värden på olika ställen.

- [x] **CSS-variabler i `app.css`** — lägg till tokens för de värden som upprepas:
  - `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 12px` (nu är det en mix av 5/6/8/10/12/16px utan system)
  - `--color-primary: #f97316`, `--color-accent: #c026d3` (variabeln `--primary-color` finns redan men används aldrig)
  - `--shadow-card`, `--border-color` (upprepas identiskt i varje sida)
- [x] **Max-width konsistens** — varuhussidan har `max-width: 720px`, alla andra sidor `680px`. Välj ett värde.
- [x] **Duplicerade knappstilar** — `.btn-save`, `.btn-cancel`, `.btn-danger` m.fl. definieras identiskt i CategorySection, mallar och inköpslistan. Flytta till globala klasser i `app.css`.

---

## 2. Blockande dialogs — byt ut `alert()` och `confirm()`

- [x] **`alert()` vid saknad kategori** — i inköpslistan när man försöker lägga till utan vald kategori. Ersätt med inline-felmeddelande under kategori-pickern.
- [x] **`confirm()` vid "Töm hela listan"** — stör flödet och ser inte ut som resten av appen. Ersätt med inline bekräftelseknapp (som "Radera konto"-flödet i inställningar redan gör rätt).
- [x] **`confirm()` vid "Ta bort lista"** — samma sak.

---

## 3. Handelsläget

Det mest använda läget förtjänar extra omsorg.

- [x] **Varuhus-selector** — `<select>` triggar native iOS-picker, ser klumpigt ut. Överväg en enklare lösning: knappar/chips för respektive varuhus om antalet är litet, eller en custom dropdown.
- [x] **Framstegsindikatorn saknas** — visa "5 av 12 varor köpta" någonstans i handelsläget, ger en tydlig känsla av progress utan att vara störande.
- [x] **Handelsknappen** — emoji `🛒` ser lite off ut mot resten av UI:t som är ikonfritt. Antingen gå all-in på ikoner (t.ex. Heroicons/Lucide) eller byt till text "Handla" / "Avsluta".
- [x] **Offline-bannern** — den gula bannern vid SSE-avbrott ser rätt ut men dyker upp lite abrupt. Lägg till en kort fade-in-transition.

---

## 4. Animationer och transitions

Inga Svelte-transitions används alls just nu — allt poppar in och ut.

- [x] **Toast-animationer** — toasts dyker upp och försvinner abrupt. Lägg till `fly` (in från botten) och `fade` (ut).
- [x] **Listposter** — varor som läggs till / tas bort kan använda `animate:flip` + `transition:slide` för att inte "hoppa".
- [x] **Kategori-collapse** — `{#if !collapsed}` borde ha en `slide`-transition.
- [x] **Menyövergångar** — SharePanel och ImportModal poppar in utan animation.

---

## 5. Tillgänglighet (a11y)

- [x] **Saknade `aria-label` på emoji-knappar** — `✏️`-knappen och `🗑️`-knappen i CategorySection saknar `aria-label`. Skärmläsare säger bara "knapp".
- [x] **`aria-expanded` på kategori-headern** — `<button class="category-header">` saknar `aria-expanded={!collapsed}` och `aria-controls`.
- [x] **Focus-ring** — `outline: none` sätts på inputs utan att ersättas med något bättre. Lägg till en synlig fokusring för tangentbordsnavigering (t.ex. `box-shadow: 0 0 0 2px #f97316`).
- [x] **Offline-badge** — borde ha `role="alert"` så skärmläsare annonserar statusförändringen automatiskt.
- [x] **Verifieringsbannern** — samma sak, `role="alert"`.

---

## 6. Mobil & responsivitet

- [ ] **Lista-header på smal mobil** — "← Listor" + listnamn + "Dela" + "Ta bort" + shopping-knapp på en rad klämmer ihop sig på 320px-skärmar. Dela upp eller göm sekundära knappar bakom en meny.
- [ ] **Kategori-chips i add-formuläret** — om man har många kategorier radbryts de, kan bli jättelångt. Överväg en scroll-container med `overflow-x: auto` och `flex-wrap: nowrap` om antalet är stort.
- [ ] **Nav fade-hint** — nav-raden kan scrollas horisontellt på mobil, men det finns inget visuellt hint om att det finns fler tabs utanför synfältet. Lägg till ett `fade`-gradient i kanten.

---

## 7. Specifika sidor

### Inköpslista-översikten (`/inkopslista`)
- [x] **Tom state** — om användaren har noll listor visas bara ett tomt rutnät. En uppmuntrande tom-state-text ("Skapa din första lista!") vore trevligare.
- [ ] **"Skapa lista"-kortet** — kortet med dashed-border blandas med riktiga listor i gridet. Det kan vara förvirrande. Kanske ett separat "+ Skapa ny lista"-element utanför gridet, eller tydligare visuell separation.
- [ ] **Lista-kort saknar oläst-indikator** — om en delad lista uppdaterats sedan senaste besök finns det ingen indikation. (Kräver backend-stöd, lyfter som framtida UX-fråga.)

### Inköpslistan (`/inkopslista/[id]`)
- [x] **Fokus efter "Lägg till vara"** — efter att en vara lagts till borde fokus återgå till "Vara"-inputfältet automatiskt.
- [ ] **Kategori-picker-tydlighet** — om ingen kategori är vald och man trycker "Lägg till vara" kommer ett `alert()`. Bättre: markera kategori-pickern visuellt som obligatorisk direkt (t.ex. `border: 1.5px solid #f97316` om inget är valt och formuläret berörts).
- [x] **Sökinputens synlighet** — sökan visas bara om >4 varor. Det är rimligt, men den dyker upp utan animation. Lägg till en kort `slide`-transition.

### Varuhus (`/varuhus`)
- [x] **"Redigera rutt"-knappen är blå** — aktiv-state är `#3b82f6` (blå) medan resten av appen är orange. Byt till orange/primary.
- [ ] **Tom state** — om inga varuhus finns visas en tom lista utan förklaring. Lägg till en förklaringstext om vad varuhus gör och hur man använder funktionen.

### Mallar (`/mallar`)
- [ ] **Mallkortet i listvyn** — templatekorten är fullbreddiga listrader, men inköpslistkortet är ett rutnät. Inkonsekvent. Överväg att göra mallarna till ett likadant grid.
- [ ] **Editor-header trång på mobil** — "← Mallar" + mallnamn + "Byt namn" + "Ta bort mall" på en rad är för mycket på smal skärm. "Ta bort mall" kan flytta ner eller ligga i en expanderbar meny.

### Inställningar (`/installningar`)
- [ ] **Kategori-ordning** — man kan lägga till och ta bort kategorier men inte sortera om dem. Drag-and-drop (eller upp/ned-knappar) vore naturligt här, speciellt eftersom ordningen i varuhusruttens editor beror på kategorierna.

---

## 8. Toast-systemet

- [x] **Toast kan hamna under tangentbordet på iOS** — `bottom: 1.5rem` räcker inte alltid. Använd `env(safe-area-inset-bottom)` för att säkerställa att den syns ovanför tangentbordet.

---

## 9. Dark mode (framtida)

Appen stöder inte dark mode. Alla färger är hårdkodade light-mode-värden. Att lägga till design-tokens (punkt 1) är förutsättningen för att detta ska vara rimligt att ta tag i senare. Notera som framtida arbete.

---

## 10. Smärre polish

- [ ] **Username i headern är inte klickbar** — det vore naturligt att klicka på sitt eget användarnamn och komma till inställningar.
- [ ] **Logga ut-knappen är liten** — litet padding och liten text gör den svår att trycka på mobil. Kan ges lite mer yta.
- [ ] **Inget loading-skeleton** — vid initial sidladdning visas ingenting tills datan laddats in. Ens en spinner eller skeleton-layout vore bättre än ett plötsligt "hop".
- [ ] **Kategori-punkt i CategorySection** — 10×10px är liten. En lite större dot (12–14px) eller en smal vänsterborger på hela kategoriraden vore tydligare.
- [x] **Varulistan visar inte specifikation tydligt** — `namn – spec` med bindestreck funkar, men spec är alltid lika stor som namnet. Spec i mindre grå text under varumamnet vore mer skanbart.
