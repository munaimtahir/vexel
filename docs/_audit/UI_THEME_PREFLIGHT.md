# UI Theme Preflight Audit — 2026-02-24

## Current Route Map (pre-refactor)

### Operator App
| Route | Shell | Notes |
|-------|-------|-------|
| `/login` | None (inline) | ✅ Public |
| `/lims/worklist` | LimsSidebar (inline) | ✅ Protected |
| `/lims/registrations/new` | LimsSidebar | ✅ Protected |
| `/lims/sample-collection` | LimsSidebar | ✅ Protected |
| `/lims/results` | LimsSidebar | ✅ Protected |
| `/lims/verification` | LimsSidebar | ✅ Protected |
| `/lims/reports` | LimsSidebar | ✅ Protected |
| `/lims/payments` | LimsSidebar | ✅ Protected (new) |
| `/encounters` (duplicate) | None | ⚠️ Bypasses LIMS shell |
| `/worklist` (duplicate) | None | ⚠️ Bypasses LIMS shell |

## Design System Status (pre-refactor)
- Tailwind: ❌ Not installed
- shadcn/ui: ❌ Not installed
- CSS: Pure inline `style={{}}` objects on every page
- Components: Emoji-icon sidebar, no shared component library

## Ad-hoc Fetch Findings
- ✅ ZERO fetch() or axios calls found
- All API calls go through `@vexel/sdk` via `lib/api-client.ts`

## Target Route Groups
- `(public)/login` — PublicShell
- `(protected)/lims/*` — AppShell (sidebar + topbar)
- Duplicate routes → server-side redirects to canonical `/lims/*` paths
