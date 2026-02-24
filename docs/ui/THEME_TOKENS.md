# Vexel Health Platform — UI Theme Token System

Version: 2.0 (Cool Slate + Orange)  
Date: 2026-02-24

## Design Philosophy

**"Cool Futuristic Elite"** — A clinical dashboard for health professionals. Cool, precise, authoritative. Not warm, artistic, or cozy.

- **Backgrounds**: Cool blue-gray slate tint (not beige/warm)
- **Primary action**: Orange — reserved for CTAs and key emphasis only
- **Sidebar**: Deep navy slate — authority and calm
- **Status chips**: Muted, tinted, systematic — never saturated stickers
- **Typography**: High contrast, clean hierarchy

---

## Token Reference

### Semantic Surfaces

| Token | Light Value | Used for |
|-------|-------------|----------|
| `--background` | `hsl(215 20% 95%)` | Page canvas |
| `--foreground` | `hsl(215 25% 15%)` | Body text |
| `--card` | `hsl(0 0% 100%)` | Card / surface bg |
| `--card-foreground` | `hsl(215 25% 15%)` | Text on cards |
| `--popover` | `hsl(0 0% 100%)` | Popover bg |
| `--muted` | `hsl(215 18% 92%)` | Table headers, muted surfaces |
| `--muted-foreground` | `hsl(215 12% 46%)` | Secondary text, labels |
| `--border` | `hsl(215 15% 88%)` | Borders, dividers |
| `--input` | `hsl(215 15% 88%)` | Input borders |

### Brand Colors

| Token | Value | Used for |
|-------|-------|----------|
| `--primary` | `hsl(24 95% 53%)` | Primary buttons, key CTA, primary links |
| `--primary-foreground` | `hsl(0 0% 100%)` | Text on primary buttons |
| `--secondary` | `hsl(215 15% 90%)` | Secondary surfaces |
| `--secondary-foreground` | `hsl(215 20% 28%)` | Text on secondary |
| `--accent` | `hsl(215 25% 88%)` | Light accent surfaces |
| `--accent-foreground` | `hsl(215 40% 25%)` | Text on accent surfaces |
| `--destructive` | `hsl(0 72% 51%)` | Error states, destructive actions |
| `--destructive-foreground` | `hsl(0 0% 100%)` | Text on destructive |
| `--ring` | `hsl(24 95% 53%)` | Focus rings (matches primary) |

### Sidebar Tokens

| Token | Value | Used for |
|-------|-------|----------|
| `--sidebar` | `hsl(215 42% 18%)` | Sidebar background body |
| `--sidebar-foreground` | `hsl(215 20% 78%)` | Sidebar text (general) |
| `--sidebar-accent` | `hsl(215 38% 26%)` | Hover state bg |
| `--sidebar-accent-foreground` | `hsl(215 15% 92%)` | Hover state text |
| `--sidebar-border` | `hsl(215 38% 14%)` | Sidebar dividers |
| `--sidebar-highlight` | `hsl(24 95% 53%)` | Active indicator bar (= primary) |

Derived sidebar values (not CSS vars — used in sidebar component):
| Concept | Value | Derivation |
|---------|-------|------------|
| Header bg | `hsl(215, 44%, 16%)` | sidebar -2% lightness |
| Footer bg | `hsl(215, 44%, 14%)` | sidebar -4% lightness |
| Inactive text | `hsl(215, 22%, 52%)` | muted slate |
| Hover text | `hsl(215, 15%, 78%)` | lighter slate |
| Active text | `hsl(215, 10%, 92%)` | near-white |
| Active bg | `rgba(249, 115, 22, 0.14)` | primary orange at 14% |
| Inactive icon | `hsl(215, 25%, 42%)` | dark muted slate |
| Active icon | `hsl(24, 85%, 68%)` | light orange |
| Section label | `hsl(215, 35%, 36%)` | dark muted |

### Status Chip Tokens

All status colors follow the pattern: muted tinted bg + darker matching text for readability.

| Token | Bg Value | Fg Value | Used for |
|-------|----------|----------|---------|
| `--status-success-bg` | `hsl(142 55% 88%)` | — | success chip background |
| `--status-success-fg` | `hsl(142 50% 25%)` | — | success chip text |
| `--status-warning-bg` | `hsl(38 90% 87%)` | — | warning chip background |
| `--status-warning-fg` | `hsl(38 80% 28%)` | — | warning chip text |
| `--status-info-bg` | `hsl(210 75% 88%)` | — | info chip background |
| `--status-info-fg` | `hsl(210 75% 28%)` | — | info chip text |
| `--status-neutral-bg` | `hsl(215 15% 92%)` | — | neutral/secondary chip bg |
| `--status-neutral-fg` | `hsl(215 15% 40%)` | — | neutral chip text |
| `--status-destructive-bg` | `hsl(0 72% 91%)` | — | destructive chip bg |
| `--status-destructive-fg` | `hsl(0 60% 35%)` | — | destructive chip text |

### Encounter Status → Badge Variant Mapping

| Status | Variant | Rationale |
|--------|---------|-----------|
| `registered` | `secondary` (neutral) | Initial state, no urgency |
| `lab_ordered` | `info` (slate-blue) | Ordered, waiting collection |
| `specimen_collected` | `warning` (amber) | In transit, needs receiving |
| `specimen_received` | `info` (slate-blue) | Received, awaiting results |
| `partial_resulted` | `warning` (amber) | Incomplete, attention needed |
| `resulted` | `success` (green) | Complete results |
| `verified` | `success` (green, solid) | Fully verified — positive end state |
| `cancelled` | `outline` | Terminated |

### Document Status → Badge Variant Mapping

| Status | Variant |
|--------|---------|
| `DRAFT` | `secondary` |
| `RENDERING` | `warning` |
| `RENDERED` | `info` |
| `PUBLISHED` | `success` |
| `FAILED` | `destructive` |

---

## Utilities

### `.page-canvas`
Cool slate-tinted page gradient. Used in `AppShell` `<main>`.

### `.sidebar-bg`
Deep navy gradient. Used when sidebar uses class-based bg (currently inline).

### `.gradient-primary`
Orange gradient for decorative elements (PageHeader accent bar, logo icon).

### Shadow Scale
- `--shadow-xs` — subtle 1px (topbar, inputs)
- `--shadow-sm` — card default
- `--shadow-md` — card hover
- `--shadow-lg` — modals, floats

---

## Enforcement Rules

1. **No hardcoded hex in components** — use CSS variables or Tailwind semantic classes
2. **No arbitrary Tailwind color values** — `bg-[#xxx]` is banned except for CSS variable references
3. **Primary orange only for CTAs** — not for info states, links, or decorative fills
4. **No purple** — replace with `info` (slate-blue tint) or `warning` (amber)
5. **Status badges via `<Badge>` component** — never inline `style={{ background, color }}`
6. **Lint guard**: `pnpm ui:color-lint` must pass before deploy

---

## Color Psychology

| Hue | Role | Rationale |
|-----|------|-----------|
| Slate navy | Structure / sidebar | Authority, trust, clinical precision |
| Cool off-white | Canvas | Clean, hygienic, modern |
| Orange | Action / CTA | Energy, urgency, brand identity |
| Muted green | Success / verified | Universal positive |
| Muted amber | Warning / in-progress | Attention without alarm |
| Muted slate-blue | Info / received | Informational, calm |
| Muted red | Error / failed | Universal negative, muted to not alarm |
