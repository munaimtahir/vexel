# Theme After Notes — Cool Slate + Orange

## What Changed

### Palette
- **Before:** Warm Morandi palette — sandy linen background (`hsl(30,20%,90%)`), terracotta primary (`hsl(18,42%,54%)`), dusty warm neutrals.
- **After:** Cool slate system — off-white slate background (`hsl(215,20%,95%)`), brand orange primary (`hsl(24,95%,53%)`), deep navy sidebar (`hsl(215,44%,16%)`).

### Sidebar
- Deep navy tones replace warm taupe.
- Active item: orange accent bar + subtle orange glow highlight (replacing terracotta).
- Inactive items: cool slate-gray text (readable, not washed out).
- Module pill (LIMS): orange tint chip — consistent with primary.

### Status Badges
- **Removed:** Purple for "verified" / partial results.
- **New system:** `success` (tinted green), `warning` (tinted amber), `info` (tinted sky), `destructive` (tinted red), `secondary` (neutral slate).
- All variants use CSS variable tokens — zero inline colors.
- Applied via `EncounterStatusBadge` / `DocumentStatusBadge` / `FlagBadge` components.

### Tables
- Header: `bg-muted/40` — subtle cool surface, not warm beige.
- Row hover: `hover:bg-muted/30` — clean, consistent.
- Borders: `border-border/50` — soft cool gray.

### Buttons
- Primary CTA: orange (`bg-primary text-primary-foreground`).
- No more blue or purple primary buttons scattered across pages.
- Cancel/back: `variant="outline"` — consistent.

### Hard-coded Color Elimination
- All hex values removed from components and pages.
- Only `globals.css` defines raw color values.
- `pnpm ui:color-lint` script added — CI-safe guard that fails if hex appears in source.

### Stat Cards
- Gradient icons updated from Morandi terracotta/sage/lavender to orange/sky/emerald/amber/indigo — aligned with the new palette.

## Why It's Better

1. **Visual coherence** — one warm accent (orange) instead of terracotta primary + purple badges + blue links all competing.
2. **Cooler feel** — slate/navy surfaces instead of sandy beige. Medical software should feel precise and calm.
3. **Status clarity** — badges are harmonized and muted. At a glance: green=done, amber=in-progress, red=error. No purple mystery colors.
4. **Maintainability** — any future color change requires editing only `globals.css`. No hunting through 30+ component files.

## Files Changed (Summary)

| Area | Files |
|------|-------|
| Theme tokens | `globals.css` |
| Badge system | `components/ui/badge.tsx`, `components/status-badge.tsx` |
| Navigation | `components/nav/sidebar.tsx`, `components/nav/nav-config.ts` |
| Shared components | `components/identity-header.tsx`, `components/encounter-summary-card.tsx`, `components/document-list.tsx`, `components/app/stat-card.tsx` |
| LIMS pages | `encounters/page.tsx`, `encounters/new/page.tsx`, `patients/new/page.tsx`, `encounters/[id]/order/page.tsx`, `encounters/[id]/sample/page.tsx`, `payments/page.tsx` |
| Auth | `login/page.tsx` |
| Layout | `(protected)/layout.tsx` |
| DX tooling | `package.json` (`ui:color-lint` script) |
