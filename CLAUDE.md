# MazeShopper — CLAUDE.md

## Vad är projektet

MazeShopper är en delad inköpslistapp byggd med SvelteKit + MongoDB. Användare kan skapa listor, dela dem med andra, sätta upp varuhusrutter (drag-and-drop kategoriordning) och handla i ett renodlat "handelsläge". Deployment via Vercel.

## Git-konventioner

Commits ska följa konventionella prefix och skrivas utan Co-Authored-By:

```
fix: åtgärda kategori-picker-klippning på mobil
add: subtitle på inställningssidan
update: varuhus till grid-layout
refactor: flytta skapa-lista-kort ovanför grid
style: konsekvent h1-storlek på alla sidor
```

Tillåtna prefix: `fix`, `add`, `update`, `refactor`, `style`, `remove`, `docs`

## Kommandon

```bash
npm run dev          # Starta dev-server (localhost:5173)
npm run check        # Kör svelte-check (TypeScript/Svelte-validering)
npm run build        # Produktionsbygge
npm run preview      # Förhandsgranska produktionsbygge lokalt
```

**Baseline:** `svelte-check` rapporterar 0 errors. Introducera inga nya.

## Miljövariabler

Se `.env.example`. Krävs för att appen ska starta:

```
MONGODB_URI=          # MongoDB Atlas connection string
MONGODB_DB=           # Valfritt databasnamn (default: mazeshopper)
RESEND_API_KEY=       # API-nyckel för transaktionsmejl
EMAIL_FROM=           # Avsändaradress, t.ex. noreply@dindomän.se
```

**Lokal utveckling:** sätt `MONGODB_DB=mazeshopper_dev` i `.env`. Utan den skriver `npm run dev` i samma databas som den driftsatta appen — och vissa ändringar (indexskapande, migreringar i server-loads) sker automatiskt vid sidladdning, utan att du gör något aktivt.

## Arkitektur

### Stack
- **SvelteKit 2** med Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`)
- **MongoDB** via native driver — databas heter `mazeshopper`
- **bcryptjs** (SALT_ROUNDS=12) för lösenordshashing
- **Resend** för transaktionsmejl (lösenordsåterställning, e-postverifiering)
- **Vercel** deployment (`@sveltejs/adapter-vercel`)

### Mappstruktur

```
src/
├── lib/
│   ├── components/
│   │   ├── CategorySection.svelte   # Varor per kategori, inline redigering
│   │   ├── SharePanel.svelte        # UI för att bjuda in/ta bort delare
│   │   ├── StoreEditor.svelte       # Drag-and-drop varuhusrutt
│   │   └── Toast.svelte             # Toast-notifikationer
│   ├── context/                     # Globala Svelte 5-singletons (module-exports)
│   │   ├── auth-context.svelte.js          # Inloggningsstatus + auth-anrop
│   │   ├── category-context.svelte.js      # Kategoripaletten (CRUD + gruppfilter)
│   │   ├── notification-context.svelte.js  # Toast-kö
│   │   ├── shopping-context.svelte.js      # Listor + inbjudningar
│   │   ├── store-context.svelte.js         # Varuhus + layout
│   │   ├── template-context.svelte.js      # Mallar och recept (CRUD + import till lista)
│   │   └── theme-context.svelte.js         # Tema (system/ljust/mörkt, localStorage)
│   └── server/
│       ├── categories.js            # getUserCategories() (migrering), renameCategoryEverywhere()
│       ├── category-defaults.js     # Standardpaletten som nya konton får
│       ├── db.js                    # MongoClient singleton + ensureIndexes()
│       ├── email.js                 # sendPasswordReset(), sendEmailVerification()
│       ├── session.js               # createSession(), getSessionUser(), deleteSession()
│       └── utils.js                 # serializeList(), serializeTemplate(), listAccessFilter(), isValidPassword(), isValidEmail(), escapeRegex(), generateShareToken(), clampServings()
├── routes/
│   ├── +layout.server.js   # Laddar session + kategoripalett → skickar till layout
│   ├── +layout.svelte      # Navbar, Toast, bootstrappar alla context:ar
│   ├── +page.svelte        # Inloggning/registrering (startsida)
│   ├── api/
│   │   ├── auth/           # POST: login, register, logout, update_email,
│   │   │                   #       request_reset, reset_password, verify_email,
│   │   │                   #       resend_verification, delete_account, exists
│   │   │                   # GET: returnerar inloggad användare
│   │   ├── invitations/    # GET inbjudningar, POST accept/decline
│   │   ├── categories/     # GET/POST kategorier i paletten
│   │   │   └── [id]/       # PATCH namn/färg/grupp (namnbyte kaskaderar), DELETE
│   │   ├── lists/          # GET/POST listor (bara namn krävs)
│   │   │   └── [id]/       # DELETE lista, GET enskild lista
│   │   │       ├── import/ # POST importera varor från mall/recept (scale + addedBy sätts)
│   │   │       ├── items/  # POST item, DELETE alla/bought
│   │   │       │   └── [itemId]/  # DELETE/PATCH enskild vara
│   │   │       ├── share/  # POST/DELETE dela lista; delare kan ta bort sig själva (lämna)
│   │   │       └── stream/ # GET SSE-ström för realtidsuppdateringar (maxDuration 300s)
│   │   ├── stores/         # GET/POST varuhus (bara namn krävs)
│   │   │   └── [storeId]/  # PATCH layout, DELETE varuhus
│   │   ├── templates/      # GET/POST mallar och recept
│   │   │   ├── [id]/       # PATCH namn/portioner/varor/delningslänk, DELETE
│   │   │   └── shared/[token]/  # POST spara delat recept som egen kopia
│   │   └── user/export/    # GET — returnerar all användardata som JSON
│   ├── inkopslista/
│   │   ├── +page.svelte         # Lista-översikt + skapa lista
│   │   └── [id]/+page.svelte    # Listadetail — redigerings- och handelsläge
│   ├── mallar/             # Mallar och recept: portioner, delningslänk, varor
│   ├── varuhus/            # Varuhushantering + StoreEditor (gruppfilter)
│   ├── installningar/      # Kategoripalett, tema, e-post, dataexport, kontoborttagning
│   ├── integritetspolicy/  # GDPR-policy (Swedish)
│   ├── anvandardvillkor/   # Användarvillkor
│   ├── om/                 # Om-sida
│   ├── r/[token]/          # Publik läsvy för delat recept (kräver ej inloggning)
│   ├── glomt-losenord/     # Begär lösenordsåterställning
│   ├── aterstall-losenord/ # Formulär för nytt lösenord (token i URL)
│   └── verifiera-epost/    # Verifieringslänk via mejl
└── hooks.server.js         # Kör ensureIndexes() vid serverstart
```

## Konventioner

### Svelte 5 runes
All state använder runes — ingen legacy `let`/`$:`. Kontextobjekt är class-instanser exporterade som module-singleton (`export const authContext = new AuthContext()`).

### Optimistiska uppdateringar
`shopping-context.svelte.js` uppdaterar UI direkt och rullar tillbaka vid serverfel. Alla mutationer visar toast via `notificationContext.show(...)` vid fel.

### API-handlers
Alla `/api/**` routes returnerar `json(...)` från `@sveltejs/kit`. Auth-kontroll via `getSessionUser(cookies)` i varje handler — returnerar 401 om ej inloggad. Åtkomst till listor kontrolleras med `listAccessFilter(username)` i `lib/server/utils.js` (`$or: [{ owner }, { sharedWith }]`); mot ett dokument man redan har används `hasListAccess()`. Håll de två i synk.

Undantag: `GET /r/[token]` är publik — en delningslänk ska gå att skicka till vem som helst.

### Lösenordsregler
Minst 8 tecken, minst en bokstav (inkl. åäö), minst en siffra. Valideras av `isValidPassword()` i `api/auth/+server.js` och speglat i frontend.

### Indata-begränsningar
- Listnamn / butiksnamn: max 100 tecken
- Varunamn: max 200 tecken
- Specifikation: max 500 tecken
- Mängd: `0 < q <= 9999`, decimaler tillåtna. `null` = ingen mängd angiven
- Enhet: max 20 tecken. Tom sträng = styck
- Kategorinamn (i item): max 50 tecken
- Kategorifärg: måste vara valid hex (#rrggbb), annars fallback `#e2e8f0`

### Mängd och enhet
`src/lib/units.js` är den enda källan för enheter, avrundning, formatering och
tolkningen av "3 dl grädde". Modulen importeras av både API-handlers och
komponenter — avrundningen vid import måste vara identisk på servern och i den
optimistiska kopian i `shopping-context`, annars hoppar talen när svaret landar.

- Räknbara enheter (`''`, `förp`, `burk`, `pkt`, `knippe`) skalas med `Math.ceil`, minst 1.
- Kontinuerliga (`g`, `hg`, `kg`, `ml`, `cl`, `dl`, `l`, `msk`, `tsk`, `krm`) skalas till närmaste trevliga steg: <1 → 0,25; 1–10 → 0,5; 10–100 → heltal; >100 → tiotal. Fjärdedelarna under 1 finns för att en halvering inte ska runda uppåt förbi originalet.
- `quantity === null` skalas aldrig — "salt efter smak" ska inte bli "×2 salt".
- Skalfaktorn tvättas av `sanitizeScale()` inuti `scaleQuantity()`, så servern och den optimistiska kopian aldrig kan råka klamra olika.
- Ingen enhetsomvandling. 1500 g blir aldrig 1,5 kg.
- Visning använder svenskt decimalkomma; internt lagras punkt. `formatAmount()` ger ×-formen för de kompakta metaraderna, `formatStepperAmount()` ett rent tal för listans stegkolumn där −/+ redan ramar in talet.

### Session
- Livslängd 30 dagar, httpOnly cookie `session`
- Token: 256-bit via `crypto.getRandomValues()` (hex-sträng)
- Sessions samlas i MongoDB `sessions`-collection med TTL-index på `expiresAt`

### E-postverifiering
Nya konton sätter `emailVerified: false`. Layout visar gult banner med knapp för omskick. Äldre konton utan fältet behandlas som verifierade (`?? true`). `request_reset` blockeras om e-post inte är verifierad.

### Rate limiting (inloggning)
Max 10 försök per IP per 15 minuter, spåras i `login_attempts`-collection med TTL-index (900s).

## MongoDB-collections

| Collection | Innehåll |
|---|---|
| `users` | username (unik, lowercase), email (sparse), password (bcrypt), emailVerified, categories[] ({id, name, color, group}) |
| `sessions` | token (unik), username, expiresAt (TTL) |
| `lists` | owner, sharedWith[], pendingInvites[], items[] (inkl. addedBy, quantity, unit per vara) |
| `templates` | owner, name, kind ('template'\|'recipe'), servings (recept), shareToken (sparse unik), items[] (itemId, name, spec, quantity, unit, category) |
| `stores` | owner, name, categoryOrder{}, positions{} |
| `listprofiles` | *utfasad* — läses bara vid engångsmigrering till `users.categories` |
| `password_resets` | email, tokenHash, expiresAt (TTL 15 min) |
| `email_verifications` | username, tokenHash, expiresAt (TTL 24h) |
| `login_attempts` | key (IP), at (TTL 900s) |
| `invitations` | listId, listName, fromUser, toUser, createdAt |

Indexes skapas av `ensureIndexes()` i `db.js`, körs vid serverstart via `hooks.server.js`.

## Kategorier

Kategorier är en **platt palett per användare**, lagrad på användardokumentet som `categories[]` med `{id, name, color, group}`.

- `group` är en ren visningsetikett som filtrerar kategoriväljaren och varuhusredigeraren. Ingen lista, inget varuhus och ingen mall refererar den, så den kan aldrig vara "i bruk" och blockera en borttagning.
- Varor lagrar sin kategori som **namn**, och varuhusrutter nycklas på namn. Ett namnbyte kaskaderar därför till ägarens listor, mallar och varuhus (`renameCategoryEverywhere` i `lib/server/categories.js`).
- Kategori är valfri. Varor utan kategori hamnar i "Utan kategori".
- På en lista **härleds gruppen från varorna som redan ligger i den** — inget profilval krävs innan man får skriva. Filtret går alltid att slå av.
- Delade listor visar **ägarens** palett, laddad server-side i `[id]/+page.server.js`. Kategorinamn mottagaren saknar visas ändå, via fallbacken för okända kategorier.

### Migrering från listprofiler

`getUserCategories()` migrerar första gången en användare läses: unionen av alla profilers kategorier, skiftlägesokänsligt på namn, där första färgen vinner och det gamla profilnamnet blir grupp. Resultatet sparas, så omvandlingen sker en gång per konto. `listprofiles`-collectionen lämnas orörd.

## Mallar och recept

Mallar och recept delar `templates`-collection och skiljs åt av `kind`. Dokument utan fältet behandlas som `'template'` (samma mönster som `emailVerified ?? true`).

- Ett recept är en mall med `servings`. Vid import skalas `quantity` mot antalet portioner man vill laga och avrundas uppåt.
- `shareToken` (256 bitar, samma mönster som sessionstoken) ger en publik läsvy på `/r/{token}`. Att sluta dela tar bort token, så spridda länkar slutar fungera direkt.
- "Spara bland mina recept" kopierar dokumentet. Kategorier följer med som namn och visas via samma fallback som okända kategorier i delade listor.

## Tema

Manuell temainställning (system/ljust/mörkt) via `theme-context.svelte.js`. Sparas i `localStorage` under nyckeln `theme`. Inställningen finns på `/installningar`.

## Handelsläge

I `inkopslista/[id]/+page.svelte` aktiveras handelsläge via `shoppingMode`-state. Realtidsuppdateringar kommer från SSE-strömmen `GET /api/lists/[id]/stream` — det finns ingen pollning. Servern stänger strömmen med jämna mellanrum (funktioner har maxlivslängd), så korta avbrott är normala; offline-bannern visas först när återanslutningen uteblivit i 6 sekunder.

## GDPR

- Personuppgiftsansvarig: Benjamin Sjöstrand (benjamin@rosenbergab.com)
- Laglig grund: avtal (Art. 6.1.b)
- Åldersgräns: 16 år
- Dataexport: `GET /api/user/export` returnerar JSON-fil (konto inkl. kategoripalett, listor, varuhus, mallar, samt `listprofiles` så länge äldre konton har kvar dem)
- Radering: `POST /api/auth` action `delete_account` tar bort allt
- Policy: `/integritetspolicy`, villkor: `/anvandardvillkor`