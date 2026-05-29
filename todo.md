# Todo — efter lansering och migration

## När runMigration() har körts klart i produktion

- Ta bort `runMigration()` från `src/lib/server/db.js`
- Ta bort anropet till `runMigration()` i `src/hooks.server.js`
- Ta bort `listprofilesMigrated`-flaggan från `src/routes/api/auth/+server.js` (sätts på användardokumentet vid registrering)
- Ta bort `src/lib/context/setting-context.svelte.js` (ersatt av listprofileContext)
- Ta bort `src/routes/api/categories/+server.js` (ersatt av /api/listprofiles)
- Rensa bort `user_settings`-collection i MongoDB (innehöll gamla globala kategorier)
