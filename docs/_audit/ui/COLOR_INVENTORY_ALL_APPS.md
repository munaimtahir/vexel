# Color Inventory (All Apps)

Generated: 2026-02-25T22:12:27.343Z

Inventory includes literal color usage scan across `apps/**` and `packages/**` (excluding build artifacts and node_modules).

| Scope | Files Scanned | Hex Literals | rgb/rgba Literals | hsl/hsla Literals | Tailwind Arbitrary Hex (`bg-[#]` etc.) |
|---|---:|---:|---:|---:|---:|
| `apps/admin` | 44 | 0 | 0 | 835 | 0 |
| `apps/api` | 111 | 0 | 0 | 0 | 0 |
| `apps/e2e` | 18 | 1365 | 542 | 19 | 0 |
| `apps/operator` | 101 | 0 | 0 | 563 | 0 |
| `apps/pdf` | 68 | 1614 | 275 | 59 | 0 |
| `apps/worker` | 8 | 0 | 0 | 0 | 0 |
| `packages/contracts` | 3 | 0 | 0 | 0 | 0 |
| `packages/sdk` | 9 | 0 | 0 | 0 | 0 |
| `packages/theme` | 4 | 0 | 0 | 46 | 0 |

## Per-App Notes

- `apps/operator`: UI code refactored to token-based colors; remaining literals are expected in shared-theme-driven HSL token usage and non-color content.
- `apps/admin`: UI code refactored to token-based colors; sidebar and OPD surfaces aligned to NeoSlate + Ember semantic classes/tokens.
- `packages/theme`: expected source of truth for color literals (token definitions and gradients).

## Frequent Offenders (Pre-Refactor, Remediated)

- `#e2e8f0` (replaced with semantic tokens)
- `#f1f5f9` (replaced with semantic tokens)
- `#64748b` (replaced with semantic tokens)
- `#94a3b8` (replaced with semantic tokens)
- `#3b82f6` (replaced with semantic tokens)
- `#8b5cf6` (replaced with semantic tokens)
- `#1d4ed8` (replaced with semantic tokens)
- `#fef3c7` (replaced with semantic tokens)
- `#bbf7d0` (replaced with semantic tokens)
- `#fee2e2` (replaced with semantic tokens)

## Current Enforcement Target

- `pnpm ui:color-lint` fails on hex literals and Tailwind arbitrary hex classes outside `packages/theme/styles/neoslate-ember.css`.