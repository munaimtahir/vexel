# Color Inventory — Vexel Operator UI

Generated: 2026-02-24

## globals.css (theme definitions — allowlisted from hex-lint)

| Token | Value | Used for |
|-------|-------|----------|
| `--background` | `hsl(32, 22%, 93%)` | Page canvas |
| `--foreground` | `hsl(25, 24%, 16%)` | Body text |
| `--primary` | `hsl(18, 42%, 54%)` | Primary buttons/CTA |
| `--sidebar` | `hsl(205, 30%, 33%)` | Sidebar background |
| `--sidebar-highlight` | `hsl(28, 50%, 60%)` | Active bar / accent |

## Hard-coded Colors in Components (VIOLATIONS)

### `components/status-badge.tsx`
| Hex | Usage |
|-----|-------|
| `#f0f9ff` | registered badge bg |
| `#0369a1` | registered badge text |
| `#fef9c3` | lab_ordered badge bg |
| `#a16207` | lab_ordered badge text |
| `#fff7ed` | specimen_collected bg |
| `#c2410c` | specimen_collected text |
| `#e0f2fe` | specimen_received bg |
| `#f0fdf4` | resulted bg |
| `#15803d` | resulted text |
| `#ede9fe` | **verified bg (PURPLE — off-system)** |
| `#7c3aed` | **verified text (PURPLE — off-system)** |
| `#f9fafb` | cancelled bg |
| `#9ca3af` | cancelled text |
| `#f3f4f6` | DRAFT/fallback bg |
| `#6b7280` | DRAFT/fallback text |
| `#fef9c3` | RENDERING bg |
| `#a16207` | RENDERING text |
| `#f0f9ff` | RENDERED bg |
| `#0369a1` | RENDERED text |
| `#f0fdf4` | PUBLISHED bg |
| `#15803d` | PUBLISHED text |
| `#fef2f2` | FAILED bg |
| `#dc2626` | FAILED text |

### `components/ui/badge.tsx`
| Value | Variant |
|-------|---------|
| `hsl(32,14%,76%)` / `hsl(32,18%,90%)` / `hsl(25,22%,28%)` | secondary |
| `hsl(0,28%,88%)` / `hsl(0,38%,40%)` | destructive |
| `hsl(143,22%,85%)` / `hsl(143,28%,32%)` | success |
| `hsl(40,40%,86%)` / `hsl(40,38%,32%)` | warning |
| `hsl(205,30%,86%)` / `hsl(205,38%,28%)` | info |
| `hsl(229,25%,86%)` / `hsl(229,30%,30%)` | **purple (off-system)** |

### `components/nav/sidebar.tsx` — S object
| Hex | Purpose |
|-----|---------|
| `hsl(205,32%,28%)` | header bg |
| `hsl(205,30%,33%)` | body bg |
| `hsl(205,32%,26%)` | footer bg |
| `rgba(196,138,94,0.17)` | active nav bg |
| `#C48A5E` | active indicator bar (terracotta) |
| `#7FABBE` | inactive nav text |
| `#D0DBE4` | hover text |
| `#F2EAD8` | active text |
| `#D4A882` | active icon |
| `#4A6E82` | inactive icon |
| `#2C5268` | section label |
| `#EDE6DA` | username text |
| `#3A6478` | role label text |
| `#E88888` | logout hover |
| Multiple gradients inline | Logo, user avatar |

### `components/identity-header.tsx`
| Hex | Usage |
|-----|-------|
| `#dbeafe` / `#1d4ed8` | registered status chip |
| `#ede9fe` / `#6d28d9` | **lab_ordered (PURPLE)** |
| `#fef3c7` / `#b45309` | specimen_collected |
| `#d1fae5` / `#065f46` | resulted |
| `#bbf7d0` / `#14532d` | verified |
| `#fee2e2` / `#991b1b` | cancelled |
| `#f1f5f9` / `#475569` | fallback |
| `#e2e8f0` | card border |
| `white` | card bg |
| `#94a3b8`, `#64748b`, `#1e293b`, `#475569` | text variants |

### `components/app/stat-card.tsx` — ICON_COLORS
| Hex Gradient | Purpose |
|-------------|---------|
| `from-[#C07850] to-[#A86040]` | index 0 (terracotta) |
| `from-[#5E8EA8] to-[#3E6E88]` | index 1 (slate-blue) |
| `from-[#7EA88A] to-[#5E8870]` | index 2 (sage) |
| `from-[#C4A86A] to-[#A48A4A]` | index 3 (amber) |
| `from-[#9098C0] to-[#7078A0]` | index 4 (lavender) |
| `text-emerald-600`, `text-red-500` | trend indicators |

### `app/login/page.tsx`
| Value | Usage |
|-------|-------|
| `from-slate-50 to-blue-50` | page gradient bg |
| `text-blue-600` | logo icon color |
| `text-slate-700` | header text |

### `app/(protected)/layout.tsx`
| Hex | Usage |
|-----|-------|
| `#64748b` | loading text |

### `app/(protected)/lims/encounters/[id]/order/page.tsx`
Multiple hardcoded hex: `#3b82f6` (links), `#fef3c7`/`#fcd34d`/`#92400e` (warning), `#e2e8f0` (borders), `#8b5cf6`/`#f5f3ff`/`#c4b5fd` (**purple selection state**), `#1e293b` / `#64748b` / `#94a3b8` (text), `#f59e0b` (CTA), `white` (cards)

### `app/(protected)/lims/encounters/[id]/receive/page.tsx`
Multiple hardcoded hex: `#fef3c7` (warning), `#e2e8f0` (borders), `#f8fafc` (specimen card bg), `#0ea5e9` (submit button **cyan**), `white` / `#64748b` / `#94a3b8` / `#1e293b` (text/bg)

### `app/(protected)/lims/encounters/[id]/publish/page.tsx`
Multiple hardcoded hex: `#f1f5f9`, `#fef3c7`, `#d1fae5`, `#bbf7d0`, `#fee2e2` (status map), `#059669` (green publish button), `white` / `#64748b` / `#1e293b` (text/bg)

### `app/(protected)/lims/encounters/[id]/verify/page.tsx`
Multiple hardcoded hex: warning states, `#f8fafc` table header, `#3b82f6` links, `#059669` verify button

### `app/(protected)/lims/encounters/[id]/results/page.tsx`
Multiple hardcoded hex: `#3b82f6` (submit button), `#f0fdf4`/`#bbf7d0`/`#15803d` (success state)

### `app/(protected)/lims/results/[orderedTestId]/page.tsx`
| Hex | Usage |
|-----|-------|
| `#fee2e2` / `#dc2626` | HIGH flag |
| `#dbeafe` / `#2563eb` | LOW flag |
| `#f0fdf4` / `#16a34a` | NORMAL flag |
| `#fce7f3` / `#9333ea` | **CRITICAL flag (PURPLE)** |

## Summary: Unique Problematic Patterns
1. **Purple used in 4+ places** — verified badge, lab_ordered chip, order page selection, results critical flag
2. **Warm Morandi tokens** — main CSS vars produce warm beige canvas
3. **Blue hardcoded** — `#3b82f6` used as link color in breadcrumbs across 6+ pages
4. **Cyan button** — `#0ea5e9` in receive page (unrelated to any accent)
5. **Inline style soup** — encounter subpages have zero token usage
