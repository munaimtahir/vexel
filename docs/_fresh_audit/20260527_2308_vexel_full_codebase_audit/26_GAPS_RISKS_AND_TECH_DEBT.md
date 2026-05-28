# Gaps, Risks, and Tech Debt (Evidence-Backed)

This list is derived only from artifacts produced in this fresh audit run.

## Critical

CRIT-01: Tenant-ambiguous login (multi-tenant unsafe)
- Evidence: `logs/phase10_auth_service.ts`, `runtime-responses/auth_login_shared.payload.json`, `runtime-responses/userb_create.json`, `runtime-responses/userb2_create.json`
- Impact: If two tenants have the same email, login will select an arbitrary tenant user (currently observed to return the system tenant), making the other account unreachable and potentially enabling cross-tenant confusion.
- Blocking: Yes for true multi-tenant readiness.

CRIT-02: Repo-wide lint fails
- Evidence: `test-results/phase17_root_lint.rerun.txt` (exit code 1)
- Impact: CI gate would fail; release pipeline should treat as NO-GO until resolved or properly scoped.
- Blocking: Yes for clean release gate.

## High

HIGH-01: Contract drift for cross-tenant user creation
- Evidence: OpenAPI `createUser` schema excludes `tenantId`, but backend supports it for super-admin (`logs/phase9_users_controller.ts`).
- Impact: Admin workflows may rely on backend-only behavior; contract-first discipline weakened.

HIGH-02: Truthmap mismatches from `as any` path strings and OPD method drift
- Evidence: `contracts/openapi_sdk_backend_frontend_map.json`, `contracts/missing_backend_support.md`
- Impact: SDK typing is being bypassed; OPD pages appear to call endpoints not defined by OpenAPI (or wrong methods).

## Medium

MED-01: SDK test harness not runnable
- Evidence: `test-results/phase17_sdk_test.rerun.txt` (jest not found)
- Impact: False sense of coverage; CI signals incomplete.

MED-02: Unit-test warning about worker queue probe
- Evidence: `test-results/phase17_api_test.txt`
- Impact: Health probe code path may be broken in tests; could mask regressions.

MED-03: Route governance mismatch for `(public)` login group
- Evidence: `24_ROUTE_GOVERNANCE_AUDIT.md`
- Impact: Violates stated governance baseline; could complicate shell/auth boundaries.

## Low

LOW-01: ESLint hook dependency warnings
- Evidence: `test-results/phase17_root_lint.rerun.txt`
- Impact: Potential subtle bugs; not currently a failing gate (warnings).

