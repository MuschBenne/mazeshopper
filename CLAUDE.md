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
npm test             # Kör hela testsviten en gång (vitest)
npm run test:watch   # Testsviten i watch-läge
npm run build        # Produktionsbygge
npm run preview      # Förhandsgranska produktionsbygge lokalt
```

**Baseline:** `svelte-check` rapporterar 0 errors och 0 warnings.
`npm test` är grön. Introducera inga nya errors och lämna inga röda tester.

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
- **bcryptjs** för lösenordshashing — SALT_ROUNDS är 12 i produktion, 1 i dev så testsviten inte blir seg
- **Resend** för transaktionsmejl (lösenordsåterställning, e-postverifiering)
- **vitest** + **mongodb-memory-server** för testerna (`fileParallelism: false` — alla integrationstester delar samma databas)
- **Vercel** deployment (`@sveltejs/adapter-vercel`, `nodejs22.x`, regionen `arn1` för att ligga bredvid Atlas-klustret i Stockholm)

### Mappstruktur

```
src/
├── lib/
│   ├── units.js                     # Enda källan för enheter, avrundning, formatering
│   ├── suggestions.js               # Specifikationsförslag från listor och mallar
│   ├── components/
│   │   ├── AmountField.svelte       # Mängd + enhet som ett fält
│   │   ├── CategorySection.svelte   # Varor per kategori, inline redigering
│   │   ├── ImportModal.svelte       # Välj varor ur mall/recept vid import
│   │   ├── SharePanel.svelte        # UI för att bjuda in/ta bort delare
│   │   ├── StoreEditor.svelte       # Drag-and-drop varuhusrutt
│   │   ├── Toast.svelte             # Toast-notifikationer
│   │   └── ui/                      # Designsystemets byggstenar: Button, Checkbox, ItemRow, AisleMarker, ProgressBar
│   ├── context/                     # Globala Svelte 5-singletons (module-exports)
│   │   ├── auth-context.svelte.js          # Inloggningsstatus + auth-anrop
│   │   ├── category-context.svelte.js      # Kategoripaletten (CRUD + gruppfilter)
│   │   ├── notification-context.svelte.js  # Toast-kö
│   │   ├── shopping-context.svelte.js      # Listor + inbjudningar
│   │   ├── store-context.svelte.js         # Varuhus + layout
│   │   ├── template-context.svelte.js      # Mallar och recept (CRUD + import till lista)
│   │   └── theme-context.svelte.js         # Tema (system/ljust/mörkt, localStorage)
│   └── server/
│       ├── categories.js            # defaultCategories(), getUserCategories() (migrering), renameCategoryEverywhere()
│       ├── category-defaults.js     # DEFAULT_CATEGORIES — standardpaletten som nya konton får
│       ├── db.js                    # MongoClient singleton + ensureIndexes()
│       ├── email.js                 # sendPasswordReset(), sendEmailVerification()
│       ├── session.js               # createSession(), getSessionUser(), getSessionUserFull(), deleteSession(), hashToken()
│       └── utils.js                 # serializeList(), serializeTemplate(), listAccessFilter(), hasListAccess(), isValidPassword(), isValidEmail(), escapeRegex(), generateShareToken(), clampServings(), sanitizeInstructions(), sanitizeSourceUrl()
├── tests/                  # vitest — unit + integration mot mongodb-memory-server
│   ├── global-setup.js     # Startar in-memory-Mongo för hela körningen
│   ├── helpers.js          # Cookie-jar och request event-mockar för handlers
│   ├── unit/               # units.js, utils.js
│   └── integration/        # auth, session, lists, categories, templates, invite
├── routes/
│   ├── +layout.server.js   # Laddar session + kategoripalett → skickar till layout
│   ├── +layout.svelte      # Navbar, Toast, bootstrappar alla context:ar
│   ├── +page.server.js     # Skickar redan inloggade vidare till /inkopslista
│   ├── +page.svelte        # Inloggning/registrering (startsida)
│   ├── api/
│   │   ├── auth/           # POST: login, register, logout, update_email,
│   │   │                   #       request_reset, reset_password, verify_email,
│   │   │                   #       resend_verification, delete_account, exists
│   │   │                   # GET: returnerar inloggad användare
│   │   ├── invitations/    # GET väntande inbjudningar
│   │   │   └── [invId]/    # POST accept/decline
│   │   ├── categories/     # GET/POST kategorier i paletten
│   │   │   └── [id]/       # PATCH namn/färg/grupp (namnbyte kaskaderar), DELETE
│   │   ├── lists/          # GET/POST listor (bara namn krävs)
│   │   │   ├── [id]/       # DELETE lista, GET enskild lista
│   │   │   │   ├── import/ # POST importera varor från mall/recept (scale + addedBy sätts)
│   │   │   │   ├── invite/ # GET/POST/DELETE inbjudningslänk — bara ägaren
│   │   │   │   ├── items/  # POST item, DELETE alla/bought
│   │   │   │   │   └── [itemId]/  # DELETE/PATCH enskild vara
│   │   │   │   ├── share/  # POST/DELETE dela lista; delare kan ta bort sig själva (lämna)
│   │   │   │   └── stream/ # GET SSE-ström för realtidsuppdateringar (maxDuration 300s)
│   │   │   └── join/[token]/  # POST gå med via inbjudningslänk (kräver inloggning)
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
│   ├── i/[token]/          # Publik landningssida för inbjudningslänk till lista
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

Undantag: sidladdningarna `/r/[token]` och `/i/[token]` är publika — en delningslänk ska gå att
skicka till vem som helst. Att *använda* länken (spara receptet, gå med i listan) kräver ändå
inloggning.

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
- Livslängd 30 dagar, cookie `session` med `httpOnly`, `sameSite: 'lax'` och `secure` utanför dev
- Token: 256-bit via `crypto.getRandomValues()` (hex-sträng)
- **Databasen lagrar bara `tokenHash`** (SHA-256 av token), aldrig token själv. Den som läser
  `sessions`-collectionen kan alltså inte logga in som någon. Uppslag sker på hashen.
- Sessions ligger i MongoDB `sessions`-collection med TTL-index på `expiresAt`
- `getSessionUser()` slår alltid mot databasen — ingen cache. En raderad session ska sluta
  gälla direkt vid lösenordsbyte eller kontoborttagning, inte när en varm instans dör.
- `reset_password` och `delete_account` raderar **alla** sessioner för användaren

### E-postverifiering
Nya konton sätter `emailVerified: false`. Layout visar gult banner med knapp för omskick. Äldre konton utan fältet behandlas som verifierade (`?? true`). `request_reset` blockeras om e-post inte är verifierad.

### Rate limiting
Alla bromsar räknas i `login_attempts`-collectionen, som har TTL-index (900s) och nycklas
`<syfte>:<ip eller användarnamn>`. Fönstret är 15 minuter om inget annat står.

| Åtgärd | Gräns | Nyckel |
|---|---|---|
| `login` | 10 försök | IP |
| `register` | 5 försök | IP |
| `request_reset` | 10 försök | IP |
| `request_reset` | 3 per timme | e-postadress (räknas i `password_resets`) |
| `resend_verification` | 3 försök | användarnamn |

`request_reset` svarar alltid `ok`, även när adressen inte finns, är overifierad eller är
bromsad — annars går det att lista ut vilka adresser som har konto.

### Säkerhet

Invarianten som bär hela systemet: **varje handler under `/api/**` börjar med
`getSessionUser(cookies)` och returnerar 401 om den ger `null`.** Det finns i dag inget
undantag. Därefter avgörs åtkomst till listor av `listAccessFilter()` / `hasListAccess()`,
och till egna resurser (varuhus, mallar, kategorier) av `owner`-matchning.

Skärpningar som ligger utanför enskilda handlers:

- **CSP** i `svelte.config.js`, `mode: 'nonce'` — `script-src: self`, `frame-ancestors: none`.
  Inga externa skript, så inget CDN kan smygas in utan att sidan slutar fungera.
- **Säkerhetsheaders** sätts i `hooks.server.js` för varje svar: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (kamera/mikrofon/plats av), `Strict-Transport-Security`.
- **CSRF**: SvelteKits inbyggda origin-kontroll är påslagen (aldrig avstängd i konfigurationen)
  och kakan är `sameSite: 'lax'`.
- **Aldrig blind spread av request-body.** Handlers plockar fält för fält och klipper längder
  — se `items/+server.js` som mall.
- **Publika ytor** är exakt tre: `/r/[token]`, `/i/[token]` och startsidan. Allt annat kräver
  session. Lägg inte till en fjärde utan att tänka igenom vad token läcker.
- **`exists`-actionen** avslöjar avsiktligt om ett användarnamn är taget — registreringsformuläret
  behöver det. Den har ingen broms, så den går att använda för att kartlägga användarnamn.
  Acceptabelt i dag; lägg till en broms om det någonsin blir ett problem.

## MongoDB-collections

| Collection | Innehåll |
|---|---|
| `users` | username (unik, lowercase), email (sparse), password (bcrypt), emailVerified, categories[] ({id, name, color, group}) |
| `sessions` | tokenHash (unik), username, createdAt, expiresAt (TTL) |
| `lists` | owner, sharedWith[], pendingInvites[], inviteToken (sparse unik), items[] (inkl. addedBy, quantity, unit per vara) |
| `templates` | owner, name, kind ('template'\|'recipe'), servings (recept), instructions, sourceUrl, shareToken (sparse unik), items[] (itemId, name, spec, quantity, unit, category) |
| `stores` | owner, name, categoryOrder{}, positions{} |
| `listprofiles` | *utfasad* — läses bara vid engångsmigrering till `users.categories` |
| `password_resets` | email, tokenHash, expiresAt (TTL 15 min) |
| `email_verifications` | email, username, tokenHash, expiresAt (TTL 24h) |
| `login_attempts` | key (`<syfte>:<ip eller användarnamn>`), at (TTL 900s) |
| `invitations` | listId, listName, fromUser, toUser, status (pending/accepted/declined/cancelled), createdAt |

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

## Delning av listor

Två vägar in i en delad lista. **Bara ägaren får dela** i båda fallen — en delad användare
kan inte bjuda in fler.

**Via användarnamn.** `POST /api/lists/[id]/share` lägger mottagaren i `pendingInvites` och
skapar ett dokument i `invitations`. Mottagaren accepterar eller avböjer via
`POST /api/invitations/[invId]`; accept flyttar namnet till `sharedWith`. Uppslaget av
mottagaren är skiftlägesokänsligt, men det är alltid det **kanoniska** namnet från
`users`-collectionen som skrivs — det är förutsättningen för att `listAccessFilter()` ska
kunna använda exakt match.

**Via inbjudningslänk.** `POST /api/lists/[id]/invite` skapar `inviteToken` (256 bitar, samma
mönster som receptets `shareToken`) och returnerar den befintliga om en redan finns — att
trycka två gånger ska inte ogiltigförklara en länk man just delat ut.

- `/i/{token}` är en **publik landningssida**: den visar listans namn, ägare, antal varor och
  antal medlemmar, men aldrig innehållet. Poängen är att den som saknar konto ska se vad hen
  bjuds in till innan hen registrerar sig.
- Att faktiskt gå med kräver inloggning (`POST /api/lists/join/[token]`). Klickar man länken
  två gånger räknas det som lyckat, inte som fel.
- `DELETE` på `invite` tar bort token. Redan utdelade länkar slutar fungera direkt — de som
  hunnit gå med är kvar och tas bort separat.

**Att lämna.** `DELETE /api/lists/[id]/share` tillåter två fall: ägaren tar bort vem som helst,
eller en delad användare tar bort sig själv. Allt annat är 403.

## Mallar och recept

Mallar och recept delar `templates`-collection och skiljs åt av `kind`. Dokument utan fältet behandlas som `'template'` (samma mönster som `emailVerified ?? true`).

- Ett recept är en mall med `servings`. Vid import skalas `quantity` mot antalet portioner man vill laga och avrundas uppåt.
- Ett recept kan bära `instructions` (max 1500 tecken, ungefär 200 ord) och `sourceUrl` (endast http/https). Båda är valfria och visas aldrig i inköpslistan — de hör hemma i köket, inte i butiken.
- `shareToken` (256 bitar, samma mönster som sessionstoken) ger en publik läsvy på `/r/{token}`. Den vyn är `noindex` och renderar tillagningen som ren text. Att sluta dela tar bort token, så spridda länkar slutar fungera direkt.
- "Spara bland mina recept" kopierar dokumentet. Kategorier följer med som namn och visas via samma fallback som okända kategorier i delade listor.

## Design

Tokens ligger som CSS-variabler på `:root` i `src/app.css` (`--color-paper`, `--color-ink`, `--color-green` …, `--font-sans`, `--font-mono`). De äldre namnen (`--bg-page`, `--text-muted`, `--color-primary`) pekar om till paletten.

- **Grönt** (`--color-green`) betyder framåt/klart: bara huvudhandlingen, avbockat och förlopp. **Gult** (`--color-tag`) är reserverat för erbjudanden, som appen inte har data för än.
- Inga gradienter, glas/blur, färgade vänsterkanter på kort, emoji eller tunga skuggor.
- Schibsted Grotesk för UI, IBM Plex Mono (`.mono`) för siffror som hör till handlandet. Typsnitten laddas via `@fontsource` i `+layout.svelte` — CSP:n (`font-src: self`) blockerar Google Fonts.
- Ikoner från `@lucide/svelte`, importerade per ikon (`@lucide/svelte/icons/check`) och med `aria-hidden="true"`.
- Stoppnumret i listan är avdelningens plats i varuhusets rutt (`categoryOrder`), inte ett riktigt gångnummer.

## Tema

Manuell temainställning (system/ljust/mörkt) via `theme-context.svelte.js`. Sparas i `localStorage` under nyckeln `theme`. Inställningen finns på `/installningar`.

## Handelsläge

I `inkopslista/[id]/+page.svelte` aktiveras handelsläge via `shoppingMode`-state. Realtidsuppdateringar kommer från SSE-strömmen `GET /api/lists/[id]/stream` — det finns ingen pollning. Servern stänger strömmen med jämna mellanrum (funktioner har maxlivslängd), så korta avbrott är normala; offline-bannern visas först när återanslutningen uteblivit i 6 sekunder.

Strömmen kontrollerar åtkomsten **två gånger**: en gång när den öppnas (`listAccessFilter`) och
sedan vid varje ändring (`hasListAccess` mot dokumentet som redan finns i handen). Utan den andra
kontrollen fortsätter någon som tagits bort från `sharedWith` att få varje uppdatering tills
anslutningen dör av sig själv.

## GDPR

- Personuppgiftsansvarig: Benjamin Sjöstrand (benjamin@rosenbergab.com)
- Laglig grund: avtal (Art. 6.1.b)
- Åldersgräns: 16 år
- Dataexport: `GET /api/user/export` returnerar JSON-fil (konto inkl. kategoripalett, listor, varuhus, mallar, samt `listprofiles` så länge äldre konton har kvar dem)
- Radering: `POST /api/auth` action `delete_account` tar bort allt
- Policy: `/integritetspolicy`, villkor: `/anvandardvillkor`