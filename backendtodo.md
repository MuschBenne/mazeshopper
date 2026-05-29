# Backend TODO — Listprofiler

Systembyte från globala kategorier till **listprofiler** (namngivna block av kategorier).
En lista och ett varuhus kopplas alltid till en listprofil. Användaren ser bara de kategorier
som tillhör den valda profilen.

---

## Standardprofiler vid lansering

Skapas automatiskt för nya användare vid registrering:

| Profil | Innehåll |
|---|---|
| Livsmedel | Frukt & grönt, Mejeri, Kött & fisk, Frys, Bröd, Dryck, Torrvaror, Hygien & städ, Snacks, Övrigt |
| Bygg & Järnhandel | Verktyg, Byggmaterial, El & belysning, VVS, Trä & skivor, Färg, Trädgård, Fästelement, Övrigt |
| Hem & Inredning | Möbler, Förvaring, Textilier, Belysning, Kök & matlagning, Badrum, Dekoration, Barnrum, Övrigt |
| Generisk lista | *(tom — användaren lägger till egna kategorier)* |

---

## Databasförändringar

### Ny collection: `listprofiles`

```js
{
  _id: ObjectId,
  owner: string,           // username
  name: string,            // "Livsmedel", "Bygg & Järnhandel" etc.
  categories: [
    { id: string, name: string, color: string }  // id = nanoid eller liknande
  ],
  createdAt: Date
}
```

Kategorier bäddas in i profildokumentet (de hämtas alltid tillsammans med profilen,
max ~20 st per profil, uppdateringar är atomära).

### Ändringar i befintliga collections

- `lists`: lägg till `profileId: string` (ObjectId som sträng)
- `stores`: lägg till `profileId: string`
- `categories`-collectionen **fasas ut** — ersätts av inbäddade kategorier i listprofiler

### Index

```js
db.listprofiles.createIndex({ owner: 1 })
```

---

## Migreringsscript (befintliga användare)

Körs en gång vid deploy. För varje befintlig användare:

1. Skapa ett "Livsmedel"-profildokument och flytta över alla kategorier från `categories`-collectionen till det profilens `categories`-array.
2. Sätt `profileId` på alla användarens befintliga listor.
3. Sätt `profileId` på alla användarens befintliga varuhus.
4. Skapa de tre övriga standardprofilerna (Bygg, Hem, Generisk) för användaren.

Befintliga kategorier bevaras — de hamnar bara under Livsmedel-profilen istället för att ligga lösa.

---

## Nya API-endpoints

### Listprofiler

| Metod | Endpoint | Beskrivning |
|---|---|---|
| GET | `/api/listprofiles` | Hämta alla profiler för inloggad användare |
| POST | `/api/listprofiles` | Skapa ny profil `{ name }` |
| PATCH | `/api/listprofiles/[id]` | Byt namn på profil `{ name }` |
| DELETE | `/api/listprofiles/[id]` | Ta bort profil (blockeras om listor/varuhus använder den) |

### Kategorier inom profil

| Metod | Endpoint | Beskrivning |
|---|---|---|
| POST | `/api/listprofiles/[id]/categories` | Lägg till kategori `{ name, color }` |
| PATCH | `/api/listprofiles/[id]/categories/[catId]` | Redigera namn/färg |
| DELETE | `/api/listprofiles/[id]/categories/[catId]` | Ta bort kategori |

---

## Ändringar i befintliga API:er

| Endpoint | Förändring |
|---|---|
| `POST /api/lists` | Kräver `profileId` i body |
| `GET /api/lists/[id]` | Returnerar profil-kategorier tillsammans med listan (eller som separat fält) |
| `POST /api/stores` | Kräver `profileId` i body |
| `GET /api/stores` | Returnerar `profileId` per varuhus |
| `/api/categories/*` | **Fasas ut** efter migrering |

---

## Auktorisering & delning

- Endast listägaren äger profilen — delade användare ser ägarens kategorier read-only.
- En profil kan inte tas bort om den har aktiva listor eller varuhus kopplade till sig.

---

## UI-förändringar (inte backend men hänger ihop)

- **Inställningssidan**: Ersätt nuvarande kategorihantering med profilhantering
  (lista profiler, skapa/byta namn/ta bort, hantera kategorier per profil).
- **Skapa lista**: Dropdown/väljare för listprofil.
- **Skapa varuhus**: Dropdown/väljare för listprofil.
- **CategorySection**: Hämtar kategorier från listans profil, inte global lista.
- **StoreEditor**: Filtrerar kategorier baserat på varuhusets profil.

---

## Öppna frågor

- Ska man kunna **byta profil på en befintlig lista**? Varor med kategorier som inte finns i
  den nya profilen tappar sin kategorisering — behöver ett tydligt UX-beslut.
- Framtida: ska delad användare kunna få behörighet att lägga till kategorier per lista?
  (Ägarflagga typ `allowCollaboratorCategories: bool` på listan.)
