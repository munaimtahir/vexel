# 21_GAPS_RISKS_AND_TECH_DEBT.md

Status: COMPLETE (evidence-linked; no fixes applied)

## Critical

- OpenAPI 3.1 spec fails lint due to `nullable` usage (contract-tooling break). Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/52_openapi_lint.txt`
- SDK tests cannot run (`jest: not found`) → cannot enforce SDK correctness via tests. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/02_sdk_tests.txt`
- Tenancy isolation not runtime-verified with two tenants; query-level tenant scoping not proven. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/09_TENANCY_ISOLATION_AUDIT.md`

## High

- API unit test suite has 1 failing test (blocks “green unit tests” gate). Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/03_api_unit_tests.txt`
- Next.js route-group governance violated (pages outside `(public)/(protected)/(admin)` requirement). Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/13_ADMIN_APP_AUDIT.md`, `docs/_discovery/20260505_0900_full_system_runtime_audit/14_OPERATOR_APP_AUDIT.md`
- Operator LIMS namespacing not strictly enforced (non-`/lims/*` routes exist). Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/14_OPERATOR_APP_AUDIT.md`
- JWT secret has dev fallback string; production safety not proven. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_jwt.strategy.ts.txt`

## Medium

- Admin/Operator containers lack healthy status due to misconfigured compose healthchecks (cosmetic but affects ops confidence). Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/202_compose_ps_after.txt`
- Auth refresh implementation scans all active refresh tokens to find a match (potential performance/DoS risk at scale). Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_auth.service.ts.txt`
- Admin/Operator lint emits react-hooks warnings; can mask real issues and increase noise. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/04_admin_lint.txt`, `docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/05_operator_lint.txt`

## Low

- PDF service health endpoint is `/health/pdf` (not `/health`), which can confuse ops tooling. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/02_pdf_health.txt`, `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/02b_pdf_health_correct.txt`
