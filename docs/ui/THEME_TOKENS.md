# NeoSlate + Ember Theme Tokens

## Intent

NeoSlate + Ember is the canonical UI theme for all Vexel Next.js apps.

- Neutrals: cool slate surfaces and borders (no warm/beige canvases)
- Accent: Ember orange is the only primary action accent
- Status: tinted semantic chips (subtle, enterprise) instead of saturated stickers
- Hierarchy: consistent semantic surfaces (`background`, `card`, `muted`) and text tokens

## Canonical Source

- CSS variables: `packages/theme/styles/neoslate-ember.css`
- Shared status component: `packages/theme/src/status-badge.tsx`

## Core Token Baseline (HSL)

Implemented in `packages/theme/styles/neoslate-ember.css`.

- `--background: 210 40% 98%`
- `--foreground: 222 47% 8%`
- `--card: 0 0% 100%`
- `--muted: 214 32% 94%`
- `--muted-foreground: 215 16% 40%`
- `--border: 214 22% 87%`
- `--primary: 18 78% 54%` (Ember orange)
- `--primary-foreground: 0 0% 100%`
- `--ring: 18 78% 54%`

## NeoSlate Neutral Hierarchy

- Page canvas: `bg-background`
- Primary content surfaces: `bg-card`
- Secondary/grouping surfaces: `bg-muted`
- Structure lines and inputs: `border-border`, `border-input`
- Body copy: `text-foreground`
- Secondary labels/meta: `text-muted-foreground`

## Sidebar Tokens

Use sidebar-specific tokens for all app shells and nav chrome:

- `--sidebar`
- `--sidebar-foreground`
- `--sidebar-muted`
- `--sidebar-accent`
- `--sidebar-border`
- `--sidebar-highlight` (mapped to Ember primary for active indicators)

Sidebar active item style:

- Background: subtle `sidebar-accent`
- Left bar: `primary` / `sidebar-highlight`
- Divider to main content: `1px solid hsl(var(--sidebar-border))`

## Ember Primary Usage Rules

Use Ember orange (`primary`) only for primary actions and key focus states:

- Primary buttons: Save, Create, Submit, Publish, Enter Results, New Registration
- Key links/interactive emphasis (not all links)
- Focus ring: `ring-ring`
- Active nav indicator bar (sidebar)

Do not reintroduce blue/purple/green as the default CTA color.

## Status Semantics (Tinted Chips)

Status chips must be muted/tinted, not saturated blocks.

- `success`: verified / published / completed / active-success states
- `warning`: partial / in-progress / rendering / attention-needed states
- `info`: queued / ordered / received / informational-progress states
- `neutral`: pending / draft / unspecified states
- `destructive`: failed / rejected / cancelled / error states

Shared helpers:

- `StatusBadge` from `@vexel/theme`
- `statusToneFromWorkflowStatus()` for default tone mapping

## Accessibility Notes

- Body text on `background` and `card` should maintain strong contrast (target WCAG AA minimum)
- Tinted chips must preserve readable text contrast against tinted backgrounds
- Focus indicators use `ring` (Ember) and should remain visible on both light/dark themes
- Avoid using color alone where possible; labels/icons should reinforce status meaning

## Enforcement

- No hex colors or Tailwind arbitrary hex classes in app/package code outside the canonical token CSS
- Command: `pnpm ui:color-lint`
