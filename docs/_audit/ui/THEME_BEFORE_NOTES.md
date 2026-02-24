# Theme Before Notes — Vexel Operator UI

Captured: 2026-02-24

## Baseline Observations

### Page Background
- **Current**: Warm sandy linen (`hsl(32, 22%, 93%)` ≈ `#F2EAD9`)
- **Issue**: Feels like a warm beige/parchment, not a modern health tech product.

### Table Headers
- **Current**: `bg-muted/50` = warm muted at 50% opacity → blends into warm sandy background
- **Issue**: No clear visual separation between table header and rows.

### Buttons (Primary)
- **Current**: Dusty terracotta `hsl(18, 42%, 54%)` ≈ `#C07858`
- **Issue**: Not clearly orange — more like a desaturated burnt sienna. Low contrast on hover.

### Status Badges (BIGGEST ISSUE)
- All badges in `status-badge.tsx` use **inline `style={{ background: '#...', color: '#...' }}`** with raw hex values
- `verified` → purple background `#ede9fe` / `#7c3aed` — inconsistent with any system palette
- `lab_ordered` → yellow `#fef9c3` / `#a16207`
- `resulted` → green `#f0fdf4` / `#15803d`
- Zero token usage — completely disconnected from theme system

### Sidebar
- **Current**: Uses a `const S` object of raw hex values (`#C48A5E`, `#7FABBE`, etc.)
- Direction is correct (deep slate-blue) but values are entirely hardcoded
- Active bar is terracotta orange hex (#C48A5E) — not linked to `--primary`

### Typography
- Foreground: `hsl(25, 24%, 16%)` ≈ `#2E2218` — warm dark charcoal (OK for Morandi, but off for cool palette)
- Muted foreground: warm mid-gray — slightly brownish

### Login Page
- Uses `from-slate-50 to-blue-50` gradient (Tailwind classes outside theme system)
- `text-blue-600` for logo icon — not themed

### Encounter Subpages (order/receive/publish/verify/results/sample)
- ENTIRELY hardcoded inline styles with raw hex
- Random accent colors: purple `#8b5cf6`, blue `#3b82f6`, green `#059669`, etc.
- Card backgrounds: `background: 'white'` (not `bg-card`)
- Breadcrumb links: `color: '#3b82f6'` (hardcoded blue)

### Stat Cards
- `ICON_COLORS` array contains hardcoded hex gradients (terracotta, slate-blue, sage, amber, lavender)

### What Looks "Off"
1. **Warm beige wash** everywhere — background, muted areas, table headers all blend into same warm beige
2. **Purple badge** for "Verified" status — no purple in the system palette
3. **Random accent hues** in encounter pages — blue, green, purple all hardcoded without system relationship
4. **Primary button** barely readable as orange — too desaturated terracotta
5. **Sidebar** uses hex constants, not CSS variables — breaks theming
6. **No cool/modern feel** — the Morandi palette is artistic but not appropriate for a clinical dashboard
