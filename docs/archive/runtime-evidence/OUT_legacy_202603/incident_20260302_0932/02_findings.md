# Findings

## 1) Tenant-domain production mapping was incomplete
Evidence:
- `tenant_domains` initially lacked `vexel.alshifalab.pk`.
- Added mapping manually in DB with explicit UUID because `tenant_domains.id` has no default.

Impact:
- Production host-to-tenant mapping was not fully represented in `tenant_domains`.

## 2) Operator protected layout was using JWT-decoded permission gating
Evidence:
- `apps/operator/src/app/(protected)/layout.tsx` denied access based on decoded token permissions and redirected with `no_operator_access`.

Impact:
- Frontend could block authenticated users based on stale/decoded token claims instead of server truth.

## 3) Dashboard/sidebar module visibility depended on client-decoded token data during early render
Evidence:
- Dashboard and sidebar previously decoded JWT on client and mixed that with flags.
- Result observed pre-fix in browser snapshot: LIMS/OPD showed as coming soon despite super-admin state.

Impact:
- Non-deterministic initial UI state and incorrect module visibility.

## 4) Catalog data existed and API returned data, but visibility issue was app-layer authz/nav logic
Evidence:
- API returned non-zero data (`tests=84`, `parameters=144`, mappings present in DB).
- Operator UI test search showed CBC suggestions after fix.

Impact:
- “Empty catalog” symptoms were primarily frontend/runtime-deploy behavior, not missing catalog rows.

## 5) Deployment drift in operator Docker build context
Evidence:
- `docker compose build operator api --no-cache` failed with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND @vexel/ui-system@workspace:*`.
- Root cause: operator Dockerfile deps/build stages did not copy `packages/ui-system` manifest/source.

Impact:
- Fixes could be committed but not deployable until Dockerfile corrected.

## 6) Import HTML/JSON parse failure mode confirmed and handled
Evidence:
- Admin import flow now shows explicit error text when response is HTML:
  - `Catalog validate failed (HTTP 502). <html><body>Proxy HTML error page</body></html>`
- No `Unexpected token <` UI parse crash.

Impact:
- Import failures from proxy/non-JSON responses are now actionable and diagnosable.
