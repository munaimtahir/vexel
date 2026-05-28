# Way Forward Plan (Evidence-Driven)

## Sprint 0 — Restore/Lock Audit Gates
Objective: Make CI signals reliable and MVP-relevant.
Acceptance criteria:
- `pnpm lint` passes or mobile lint is scoped out explicitly with a documented rationale.
- `@vexel/sdk` tests are runnable (either add `jest` properly or remove/replace the broken test script).
Evidence rationale:
- Lint currently fails (see `20_BUILD_TYPECHECK_LINT_TEST_AUDIT.md`).
- SDK tests currently fail (jest missing).

## Sprint 1 — Tenancy/Auth Correctness
Objective: Make multi-tenant mode structurally correct even if single-tenant mode is the product behavior.
Acceptance criteria:
- Auth login becomes tenant-aware (domain or explicit tenant context) OR enforce global-unique email at schema+API level with explicit product decision.
- Logout audit tenantId is correct for non-system tenants.
Evidence rationale:
- Tenant-ambiguous login proven (see `13_AUTH_RBAC_SESSION_AUDIT.md`, `12_TENANCY_STATIC_AND_RUNTIME_AUDIT.md`).

## Sprint 2 — Contract/SDK Discipline Cleanup
Objective: Eliminate `as any` path drift and ensure frontend calls map cleanly to OpenAPI.
Acceptance criteria:
- Remove or minimize `as any` SDK endpoint strings in Admin/Operator for critical routes.
- Fix OPD method mismatches or clearly gate OPD module off.
Evidence rationale:
- Truthmap mismatches enumerated in `contracts/openapi_sdk_backend_frontend_map.json` and `contracts/missing_backend_support.md`.

## Sprint 3 — Release Candidate Hardening
Objective: Keep the currently proven LIMS + document pipeline stable and verifiable.
Acceptance criteria:
- Playwright smoke remains green in a clean environment.
- Docker runtime health checks remain green and documented.
Evidence rationale:
- LIMS workflow + documents pipeline are currently proven in this run (`14_...`, `15_...`).

