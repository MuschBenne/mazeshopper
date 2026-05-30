# Admin-panel — plan

## Säkerhet

Ingen ny roll-logik i databasen. Admin-åtkomst styrs av en miljövariabel:

```
ADMIN_PASSWORD=        # Långt, slumpmässigt lösenord — sätts i Vercel env
```

Admin-cookien (`admin_session`) är separat från den vanliga `session`-cookien — en inloggad admin behöver inte ha ett användarkonto.

### Skyddslagret

`hooks.server.js` kontrollerar `/admin`-prefix:
- Saknas giltig admin-cookie → redirect till `/admin/login`
- Admin-cookien är ett signerat värde (HMAC med `ADMIN_PASSWORD` som nyckel), TTL 8 timmar

---

## Routestruktur

```
src/routes/admin/
├── +layout.server.js      # Kontrollerar admin-cookie, laddar inga user-data
├── +layout.svelte         # Minimalt skal: navbar med flikar
├── login/
│   └── +page.svelte       # Lösenordsformulär → sätter admin-cookie
├── +page.svelte           # Översikt / dashboard (redirect-target efter login)
└── api/
    ├── login/+server.js   # POST: validerar lösenord, sätter cookie
    ├── logout/+server.js  # POST: raderar cookie
    └── stats/+server.js   # GET: aggregerad data från MongoDB
```

---

## Dashboard — vad som visas

### Användare
- Totalt antal konton
- Verifierade vs ej verifierade e-poster
- Senaste 5 registrerade användare (username + datum, inget mer)
- Antal konton utan aktiv session de senaste 30 dagarna (inaktiva)

### Innehåll
- Totalt: listor / varuhus / mallar / listprofiler
- Genomsnitt varor per lista (enkelt aggregat)

### Sessioner
- Antal aktiva sessioner just nu
- Knapp: "Invalidera alla sessioner" (tar bort hela `sessions`-collection) — kräver en extra bekräftelse

### Rate limiting
- Antal IP:ar i `login_attempts` just nu (= pågående eller nyligen misslyckade inloggningar)
- Lista de IP:ar med flest försök (top 5)

### Inbjudningar
- Antal väntande inbjudningar (`invitations`-collection) — indikator på om invite-flödet fastnat

### Manuell kontoborttagning
- Sökfält: username eller e-post
- Visar konto-info (username, email, verified, antal listor)
- Knapp: "Radera konto" — tar bort user + sessions + lists + stores + templates + listprofiles + invitations
- Samma logik som `delete_account` i `api/auth`, extraheras till en delad serverfunktion

---

## API — `GET /admin/api/stats`

Returnerar ett JSON-objekt byggt av parallella MongoDB-aggregat:

```js
{
  users: {
    total: number,
    verified: number,
    unverified: number,
    recentRegistrations: [{ username, createdAt }],   // senaste 5
    inactive30d: number
  },
  content: {
    lists: number,
    stores: number,
    templates: number,
    listprofiles: number,
    avgItemsPerList: number
  },
  sessions: {
    active: number
  },
  rateLimiting: {
    activeIPs: number,
    topIPs: [{ key, count }]                          // top 5
  },
  invitations: {
    pending: number
  }
}
```

---

## Implementationsordning

| # | Steg | Kommentar |
|---|---|---|
| 1 | `ADMIN_PASSWORD` i `.env` + Vercel | Krävs innan något annat |
| 2 | Login-route + cookie-hantering | Grund för hela panelen |
| 3 | Hook-skydd i `hooks.server.js` | Stäng `/admin` utan cookie |
| 4 | `GET /admin/api/stats` | All datahämtning samlad |
| 5 | Dashboard-sida | Presenterar stats |
| 6 | Manuell kontoborttagning | Extrahera delete-logik till delad funktion |

---

## Vad som medvetet utelämnas

- Redigera andras listor/data (för stor attackyta)
- Realtidsuppdateringar (overkill)
- Rollhantering i databasen (onödig komplexitet)
- Offentlig registrering för admin-konton
