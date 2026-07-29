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
│   │   ├── listprofile-context.svelte.js   # Listprofiler + kategorier (CRUD)
│   │   ├── notification-context.svelte.js  # Toast-kö
│   │   ├── shopping-context.svelte.js      # Listor + inbjudningar
│   │   ├── store-context.svelte.js         # Varuhus + layout
│   │   ├── template-context.svelte.js      # Listmallar (CRUD + import till lista)
│   │   └── theme-context.svelte.js         # Tema (system/ljust/mörkt, localStorage)
│   └── server/
│       ├── db.js                    # MongoClient singleton + ensureIndexes()
│       ├── email.js                 # sendPasswordReset(), sendEmailVerification()
│       ├── listprofile-defaults.js  # De 4 standardprofilerna som skapas vid registrering
│       ├── session.js               # createSession(), getSessionUser(), deleteSession()
│       └── utils.js                 # serializeList(), isValidPassword(), isValidEmail(), escapeRegex()
├── routes/
│   ├── +layout.server.js   # Laddar session → skickar user till layout
│   ├── +layout.svelte      # Navbar, Toast, bootstrappar alla context:ar
│   ├── +page.svelte        # Inloggning/registrering (startsida)
│   ├── api/
│   │   ├── auth/           # POST: login, register, logout, update_email,
│   │   │                   #       request_reset, reset_password, verify_email,
│   │   │                   #       resend_verification, delete_account, exists
│   │   │                   # GET: returnerar inloggad användare
│   │   ├── invitations/    # GET inbjudningar, POST accept/decline
│   │   ├── listprofiles/   # GET/POST listprofiler
│   │   │   └── [id]/       # PATCH byt namn, DELETE (blockeras om listor/varuhus använder den)
│   │   │       └── categories/        # POST lägg till kategori
│   │   │           └── [catId]/       # PATCH redigera, DELETE ta bort (ej låsta)
│   │   ├── lists/          # GET/POST listor (POST kräver profileId)
│   │   │   └── [id]/       # DELETE lista, GET enskild lista
│   │   │       ├── import/ # POST importera varor från mall (addedBy sätts)
│   │   │       ├── items/  # POST item, DELETE alla/bought
│   │   │       │   └── [itemId]/  # DELETE/PATCH enskild vara
│   │   │       ├── share/  # POST/DELETE dela lista; delare kan ta bort sig själva (lämna)
│   │   │       └── stream/ # GET SSE-ström för realtidsuppdateringar (maxDuration 300s)
│   │   ├── stores/         # GET/POST varuhus (POST kräver profileId)
│   │   │   └── [storeId]/  # PATCH layout, DELETE varuhus
│   │   ├── templates/      # GET/POST/DELETE/PATCH listmallar
│   │   └── user/export/    # GET — returnerar all användardata som JSON
│   ├── inkopslista/
│   │   ├── +page.svelte         # Lista-översikt + skapa lista (med profilväljare)
│   │   └── [id]/+page.svelte    # Listadetail — redigerings- och handelsläge
│   ├── varuhus/            # Varuhushantering + StoreEditor (med profilväljare)
│   ├── installningar/      # Listprofiler, e-post, dataexport, kontoborttagning
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
Alla `/api/**` routes returnerar `json(...)` från `@sveltejs/kit`. Auth-kontroll via `getSessionUser(cookies)` i varje handler — returnerar 401 om ej inloggad. Åtkomst till listor kontrolleras med `$or: [{ owner }, { sharedWith }]`.

### Lösenordsregler
Minst 8 tecken, minst en bokstav (inkl. åäö), minst en siffra. Valideras av `isValidPassword()` i `api/auth/+server.js` och speglat i frontend.

### Indata-begränsningar
- Listnamn / butiksnamn: max 100 tecken
- Varunamn: max 200 tecken
- Specifikation: max 500 tecken
- Antal: 1–9999
- Kategorinamn (i item): max 50 tecken
- Kategorifärg: måste vara valid hex (#rrggbb), annars fallback `#e2e8f0`

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
| `users` | username (unik, lowercase), email (sparse), password (bcrypt), emailVerified |
| `sessions` | token (unik), username, expiresAt (TTL) |
| `lists` | owner, profileId, sharedWith[], pendingInvites[], items[] (inkl. addedBy per vara) |
| `templates` | owner, name, kind ('template'\|'recipe'), servings (recept), shareToken (sparse unik), items[] (itemId, name, spec, quantity, unit, category) |
| `stores` | owner, profileId, name, categoryOrder{}, positions{} |
| `listprofiles` | owner, name, categories[] ({id, name, color, locked?}), createdAt |
| `password_resets` | email, tokenHash, expiresAt (TTL 15 min) |
| `email_verifications` | username, tokenHash, expiresAt (TTL 24h) |
| `login_attempts` | key (IP), at (TTL 900s) |
| `invitations` | listId, listName, fromUser, toUser, createdAt |

Indexes skapas av `ensureIndexes()` i `db.js`, körs vid serverstart via `hooks.server.js`.

## Listprofiler

Kategorier är kopplade till **listprofiler** — namngivna samlingar av kategorier. Varje lista och varuhus tillhör en profil.

- Vid registrering skapas 4 standardprofiler: Livsmedel, Bygg & Järnhandel, Hem & Inredning, Generisk lista.
- Kategorier bäddas in i profildokumentet (`categories[]`), inte som egna dokument.
- "Generisk lista" har en inbyggd låst "Övrigt"-kategori (`locked: true`) som inte kan tas bort.
- Delade listor: delade användare ser ägarens profilkategorier (laddas server-side i `[id]/+page.server.js`).
- En profil kan inte tas bort om aktiva listor eller varuhus refererar till den.

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
- Dataexport: `GET /api/user/export` returnerar JSON-fil (konto, listor, varuhus, listprofiler, mallar)
- Radering: `POST /api/auth` action `delete_account` tar bort allt
- Policy: `/integritetspolicy`, villkor: `/anvandardvillkor`