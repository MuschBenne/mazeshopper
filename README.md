# MazeShopper

En delad inköpslistapp byggd med SvelteKit och MongoDB. Skapa listor, dela dem med andra, sätt upp varuhusrutter med drag-and-drop och handla i ett renodlat handelsläge.

## Kom igång

### Krav

- Node.js 18+
- MongoDB Atlas-konto (eller lokal MongoDB)
- Resend-konto (för transaktionsmejl)

### Installation

```sh
npm install
```

### Miljövariabler

Kopiera `.env.example` till `.env` och fyll i:

```
MONGODB_URI=          # MongoDB Atlas connection string
RESEND_API_KEY=       # API-nyckel för transaktionsmejl
EMAIL_FROM=           # Avsändaradress, t.ex. noreply@dindomän.se
```

### Starta dev-server

```sh
npm run dev
```

Appen körs på [localhost:5173](http://localhost:5173).

## Kommandon

```sh
npm run dev        # Starta dev-server
npm run check      # Kör svelte-check (TypeScript/Svelte-validering)
npm run build      # Produktionsbygge
npm run preview    # Förhandsgranska produktionsbygge lokalt
```

## Stack

- **SvelteKit 2** med Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`)
- **MongoDB** via native driver
- **bcryptjs** för lösenordshashing
- **Resend** för transaktionsmejl
- **Vercel** för deployment (`@sveltejs/adapter-vercel`)

## Funktioner

- Skapa och hantera inköpslistor
- Dela listor med andra användare via inbjudningar
- Varuhusrutter med drag-and-drop kategoriordning
- Handelsläge med realtidssynk (polling var 15:e sekund)
- E-postverifiering och lösenordsåterställning
- GDPR-anpassad — dataexport och kontoborttagning

## Deployment

Projektet är konfigurerat för Vercel. Lägg till miljövariablerna i Vercel-projektets inställningar och deploya.
