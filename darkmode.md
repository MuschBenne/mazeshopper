# Dark mode — analys och implementationsplan

## Strategi

Använda `@media (prefers-color-scheme: dark)` — följer systemval, ingen manuell toggle.  
Alla hårdkodade färger ersätts med CSS-variabler i `app.css`. Svelte's scoped styles refererar sedan `var(--...)` istället för hexkoder.

---

## Färginventering (nuläge)

### Vanligast (de som driver arbetet)

| Hex | Antal | Roll |
|---|---|---|
| `#fff` | 69 | Kortytor, inputs, bakgrunder |
| `#f97316` | 55 | Orange primary — behålls |
| `#6b7280` | 47 | Muted text |
| `#e5e7eb` | 42 | Primär border |
| `#9ca3af` | 40 | Placeholder / fadd text |
| `#374151` | 35 | Sekundär text |
| `#dc2626` | 28 | Rödfel |
| `#d1d5db` | 27 | Input-borders |
| `#111827` | 24 | Primär text / rubriker |
| `#f3f4f6` | 21 | Tertiär yta, chips |
| `#c026d3` | 20 | Lila accent — behålls |
| `#f9fafb` | 19 | Sidbakgrund |

### Semantiska färger (fel / success / varning / violet)

| Grupp | Text | Bakgrund | Border |
|---|---|---|---|
| **Danger** | `#dc2626` | `#fef2f2` | `#fca5a5` |
| **Danger hover** | `#b91c1c` | — | — |
| **Success** | `#16a34a` | `#f0fdf4` | `#86efac` |
| **Success hover** | `#15803d` | — | — |
| **Warning** | `#92400e` / `#d97706` | `#fef3c7` | `#fcd34d` |
| **Verify banner** | `#713f12` | `#fefce8` | `#fde047` |
| **Violet (Share)** | `#7c3aed` | `#ede9fe` | `#c4b5fd` |
| **Violet hover** | `#6d28d9` | `#f5f3ff` | — |

---

## CSS-variabler att lägga till i `app.css`

### `:root` (light mode)

```css
/* Bakgrunder */
--bg-page:     #f9fafb;
--bg-surface:  #ffffff;
--bg-elevated: #f3f4f6;
--bg-hover:    #fafafa;

/* Text */
--text-primary:   #111827;
--text-secondary: #374151;
--text-muted:     #6b7280;
--text-faint:     #9ca3af;

/* Borders */
--border:        #e5e7eb;
--border-input:  #d1d5db;
--border-subtle: #f3f4f6;
--border-faint:  #f9fafb;

/* Semantiska — Danger */
--danger-text:   #dc2626;
--danger-text-hover: #b91c1c;
--danger-bg:     #fef2f2;
--danger-border: #fca5a5;

/* Semantiska — Success */
--success-text:   #16a34a;
--success-text-hover: #15803d;
--success-bg:     #f0fdf4;
--success-border: #86efac;

/* Semantiska — Warning */
--warning-text:   #92400e;
--warning-bg:     #fef3c7;
--warning-border: #fcd34d;

/* Semantiska — Violet (SharePanel, inbjudningar) */
--violet-text:   #7c3aed;
--violet-text-hover: #6d28d9;
--violet-bg:     #ede9fe;
--violet-border: #c4b5fd;
--violet-light:  #f5f3ff;

/* Verify-banner */
--verify-text:   #713f12;
--verify-bg:     #fefce8;
--verify-border: #fde047;
```

### `@media (prefers-color-scheme: dark)` overrides

```css
--bg-page:     #0f172a;
--bg-surface:  #1e293b;
--bg-elevated: #2d3748;
--bg-hover:    #334155;

--text-primary:   #f1f5f9;
--text-secondary: #cbd5e1;
--text-muted:     #94a3b8;
--text-faint:     #64748b;

--border:        #334155;
--border-input:  #475569;
--border-subtle: #1e293b;
--border-faint:  #0f172a;

--danger-text:   #f87171;
--danger-text-hover: #ef4444;
--danger-bg:     #1c0606;
--danger-border: #7f1d1d;

--success-text:   #4ade80;
--success-text-hover: #22c55e;
--success-bg:     #052e16;
--success-border: #166534;

--warning-text:   #fbbf24;
--warning-bg:     #1c0a00;
--warning-border: #78350f;

--violet-text:   #a78bfa;
--violet-text-hover: #c4b5fd;
--violet-bg:     #1e1035;
--violet-border: #4c1d95;
--violet-light:  #2e1065;

--verify-text:   #fde68a;
--verify-bg:     #1c1000;
--verify-border: #78350f;
```

---

## Vad som INTE ändras

| Vad | Varför |
|---|---|
| `linear-gradient(#f97316, #c026d3)` | Brand-gradient — alltid orange→lila |
| `--color-primary: #f97316` | Primärfärg — behålls |
| `--color-accent: #c026d3` | Accent — behålls |
| Kategori-chipfärger (user-definierade) | Kan inte ändras, är personliga |
| `rgba(0,0,0,0.x)` skuggor | Fungerar OK i dark mode, tonas ner naturligt |
| `color: #fff` på vit text i knappar | Är rätt mot gradient-bakgrund |

---

## Filer att uppdatera (13 st)

### Prioritetsordning

| # | Fil | Komplexitet | Kommentar |
|---|---|---|---|
| 1 | `src/app.css` | Låg | Lägg till variabler + dark overrides |
| 2 | `src/routes/+layout.svelte` | Medel | Header, nav — synligt på alla sidor |
| 3 | `src/routes/+page.svelte` | Medel | Login/register hero |
| 4 | `src/lib/components/Toast.svelte` | Låg | Få färger |
| 5 | `src/lib/components/SharePanel.svelte` | Medel | Violet-palette |
| 6 | `src/lib/components/ImportModal.svelte` | Medel | Modal + overlay |
| 7 | `src/lib/components/CategorySection.svelte` | Medel | Items, hover, köpt-state |
| 8 | `src/routes/inkopslista/+page.svelte` | Låg | Grid, kort |
| 9 | `src/routes/inkopslista/[id]/+page.svelte` | Hög | Störst fil, mest färger |
| 10 | `src/routes/varuhus/+page.svelte` | Medel | Grid + detaljvy |
| 11 | `src/routes/mallar/+page.svelte` | Medel | Grid + editor |
| 12 | `src/routes/installningar/+page.svelte` | Medel | Inställningar, danger-zone |
| 13 | `src/routes/om/+page.svelte` | Låg | Mest text |

### Resterande routes (minimala färger — lägst prio)
- `aterstall-losenord`, `glomt-losenord`, `verifiera-epost`, `anvandardvillkor`, `integritetspolicy`

---

## Ersättningstabell (hex → variabel)

| Ljust hex | Variabel | Mörkt värde |
|---|---|---|
| `#f9fafb` (bg) | `var(--bg-page)` | `#0f172a` |
| `#fff` (kortyta) | `var(--bg-surface)` | `#1e293b` |
| `#f3f4f6` (chip/yta) | `var(--bg-elevated)` | `#2d3748` |
| `#fafafa` (hover) | `var(--bg-hover)` | `#334155` |
| `#111827` | `var(--text-primary)` | `#f1f5f9` |
| `#374151` | `var(--text-secondary)` | `#cbd5e1` |
| `#6b7280` | `var(--text-muted)` | `#94a3b8` |
| `#9ca3af` | `var(--text-faint)` | `#64748b` |
| `#e5e7eb` | `var(--border)` | `#334155` |
| `#d1d5db` | `var(--border-input)` | `#475569` |
| `#f3f4f6` (divider) | `var(--border-subtle)` | `#1e293b` |
| `#f9fafb` (divider) | `var(--border-faint)` | `#0f172a` |
| `#dc2626` | `var(--danger-text)` | `#f87171` |
| `#fef2f2` | `var(--danger-bg)` | `#1c0606` |
| `#fca5a5` | `var(--danger-border)` | `#7f1d1d` |
| `#16a34a` | `var(--success-text)` | `#4ade80` |
| `#f0fdf4` | `var(--success-bg)` | `#052e16` |
| `#86efac` | `var(--success-border)` | `#166534` |
| `#92400e` | `var(--warning-text)` | `#fbbf24` |
| `#fef3c7` | `var(--warning-bg)` | `#1c0a00` |
| `#fcd34d` | `var(--warning-border)` | `#78350f` |
| `#7c3aed` | `var(--violet-text)` | `#a78bfa` |
| `#ede9fe` | `var(--violet-bg)` | `#1e1035` |
| `#c4b5fd` | `var(--violet-border)` | `#4c1d95` |
| `#f5f3ff` | `var(--violet-light)` | `#2e1065` |

---

## Noteringar

- **`#111`** (8 förekomster, hover-states) → ersätts med `var(--text-primary)`  
- **`#1f2937`** → ersätts med `var(--text-secondary)` eller `var(--bg-elevated)` beroende på kontext  
- **`color-mix(in srgb, var(--chip-color) 60%, #9ca3af)`** — `#9ca3af` i uttrycket kan bytas mot `var(--text-faint)` för bättre dark mode-anpassning av chip-borders  
- **`box-shadow: 0 1px 4px rgba(0,0,0,0.05)`** — fungerar i dark mode men kan bli starkare: `rgba(0,0,0,0.25)` i dark för mer synliga kort
