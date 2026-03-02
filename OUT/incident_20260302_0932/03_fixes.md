# Fixes Applied

## A) Production data fix (tenant mapping)
- SQL applied:
  - `INSERT INTO tenant_domains (id, "tenantId", domain) VALUES (gen_random_uuid(), 'system', 'vexel.alshifalab.pk') ON CONFLICT (domain) DO NOTHING;`
- Verified row exists in `tenant_domains` for `system` tenant.

## B) Operator access/navigation hardening
### Files
- `apps/operator/src/app/(protected)/layout.tsx`
- `apps/operator/src/app/(protected)/page.tsx`
- `apps/operator/src/components/nav/sidebar.tsx`
- `apps/operator/src/hooks/use-current-user.ts` (new)

### Changes
- Removed JWT-decoded permission gating from protected layout.
  - New behavior: auth-only guard (token exists => render app; no token => login redirect).
- Introduced `useCurrentUser()` hook using SDK `/me` (server-derived user + permissions).
- Removed JWT permission-array dependency in dashboard/sidebar authz decisions.
- Made OPD/LIMS module rendering deterministic:
  - During initial load, show loading state for flag-gated UI.
  - Super-admin bypass remains explicit and stable.
- Added user cache invalidation on logout to avoid stale session user state.

## C) Import parser hardening (admin UI)
### File
- `apps/admin/src/app/(protected)/catalog/import-export/page.tsx`

### Changes
- Added strict response parser (`expectJsonFromTextResponse`) for import endpoints.
- Calls now use SDK with `parseAs: 'text'`, then enforce:
  - HTTP status checks
  - `content-type` contains `application/json`
  - Safe JSON parse with explicit errors
- Error messages now include HTTP status and body preview (actionable for proxy/html failures).

## D) Deployment drift fix for operator Docker build
### File
- `apps/operator/Dockerfile`

### Changes
- Added workspace package in deps/build stages:
  - `COPY packages/ui-system/package.json ./packages/ui-system/`
  - `COPY packages/ui-system/ ./packages/ui-system/`

### Result
- `docker compose build operator api --no-cache` now succeeds.

## E) Commits
- `d23ed48` — operator access + import parser changes
- `f6de5dd` — operator Dockerfile workspace copy fix
