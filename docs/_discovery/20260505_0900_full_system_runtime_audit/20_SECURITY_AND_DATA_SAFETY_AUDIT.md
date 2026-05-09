# 20_SECURITY_AND_DATA_SAFETY_AUDIT.md

Status: IN PROGRESS (static checks + some runtime headers verified)

## Secret Hygiene (Repo Scan)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/400_secret_search.txt`

Notes:
- This is a heuristic text scan; it does not guarantee secrets are absent.
- No secret values are recorded in this audit folder; runtime tokens are redacted.

## JWT Secret Handling

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_jwt.strategy.ts.txt`

Finding:
- JWT secret has a hardcoded dev fallback (`vexel-dev-secret-change-in-production`). Risk is High unless startup/config guarantees prod always sets `JWT_SECRET`.

## CORS + Credentialed Requests

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/100_apps_api_src_main.ts.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/01_api_health.txt` (shows `Access-Control-Allow-Credentials: true`)

Finding:
- CORS uses an allowlist derived from `CORS_ALLOWED_ORIGINS` (default localhost), with `credentials: true`.
- Allowed headers include `x-tenant-id` and `x-correlation-id`. Tenant header is still gated in the tenancy middleware by env (`TENANCY_DEV_HEADER_ENABLED`).

## Tenant Isolation Safety

Status: NOT VERIFIED (runtime A/B tenant test not executed)
- Middleware design aligns with baseline. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_tenant_tenant-resolver.middleware.ts.txt`
- Requires runtime verification with two tenants + cross-tenant access attempts.

## Frontend Data Access Rules

Observed (static):
- No direct `fetch`/`axios` in `apps/admin/src` or `apps/operator/src` detected. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/07_FRONTEND_SDK_USAGE_AUDIT.md`

## Known Governance Violations (Security-adjacent)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/13_ADMIN_APP_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/14_OPERATOR_APP_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/03_admin_root.txt` (inline styles in rendered login HTML)

Findings:
- Next.js route group governance is currently violated (login/pages exist outside required `(public)` group).
- Operator contains non-namespaced (non-`/lims/*`) LIMS routes in filesystem (potential for future routing drift/confusion).
