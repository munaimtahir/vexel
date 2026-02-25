# Theme Scope

Generated: 2026-02-25T22:12:10.588Z

| App | Type | Framework | Global CSS Entry | shadcn/ui Tokens | Notes |
|---|---|---|---|---|---|
| `admin` | ui-app | Next.js (App Router) | `src/app/globals.css` | Yes (CSS vars + Tailwind semantic colors) | basePath=/admin |
| `api` | service | N/A | `N/A` | No | — |
| `e2e` | tests | Playwright | `N/A` | No | — |
| `operator` | ui-app | Next.js (App Router) | `src/app/globals.css` | Yes (CSS vars + Tailwind semantic colors) | shadcn/ui primitives present OPD routes live inside operator app |
| `pdf` | service | .NET | `N/A` | No | — |
| `worker` | service | N/A | `N/A` | No | — |

## Canonical Theme Source

- Shared token file: `packages/theme/styles/neoslate-ember.css`
- Shared status component: `packages/theme/src/status-badge.tsx`
- Imported by: `apps/operator/src/app/globals.css`, `apps/admin/src/app/globals.css`