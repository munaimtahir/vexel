# 13_ADMIN_APP_AUDIT.md

Status: IN PROGRESS (static route discovery complete; runtime UI verification pending)

## Route Group Governance (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/140_admin_routes_tree.txt`

Observed:
- Protected pages exist under `apps/admin/src/app/(protected)/*` with a group `layout.tsx`.
- Pages also exist outside any route group:
  - `apps/admin/src/app/login/page.tsx`
  - `apps/admin/src/app/page.tsx`
  - `apps/admin/src/app/layout.tsx`

Assessment (static): FAIL vs governance rule “every page must be under explicit route group” (requires `(public)` group for unauth pages).

## Required Admin Areas (Static Presence Check)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/140_admin_routes_tree.txt`

Observed routes (presence only; not runtime-verified):
- Dashboard: `/(protected)/dashboard`
- Tenants: `/(protected)/tenants` and ops tenant tooling under `/(protected)/ops/tenants`
- Users/Roles: `/(protected)/users`, `/(protected)/roles`
- Feature Flags: `/(protected)/feature-flags` (and OPD feature flags under `/(protected)/opd/feature-flags`)
- Catalog Admin: `/(protected)/catalog/*`
- Audit Explorer: `/(protected)/audit`
- Jobs/Failures: `/(protected)/jobs`

Pending:
- Verify each page uses generated SDK only, respects RBAC, and does not mutate workflow state directly (requires code review + runtime network capture).
