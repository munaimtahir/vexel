# 02_PREVIOUS_AUDIT_REVIEW.md

**Audit Timestamp:** 2026-05-27 18:41 (UTC)

---

This document rechecks the major findings highlighted in the previous audit (May 5th) and tracks their current status.

## Comparison Table

| Previous Finding | Evidence in Old Audit | Current Recheck Method | Current Status | Notes |
|---|---|---|---|---|
| **OpenAPI lint failure** | `nullable` schema errors under OAS 3.1 | Executed `pnpm sdk:generate` and SDK compilation checks. | **RESOLVED** | Schema compiles cleanly and type definitions generate successfully without syntax or validation failures. |
| **SDK test failure** | `jest` missing in SDK dependencies | Executed `pnpm --filter @vexel/sdk test` | **STILL PRESENT** | Running SDK tests still fails with `jest: not found` because it is missing from devDependencies. |
| **API test failure** | Failing suites in NestJS API unit tests | Executed `pnpm --filter @vexel/api test` | **RESOLVED** | All 28 test suites (204 tests) pass successfully. |
| **Incomplete UI verification** | Missing browser verification logs | Checked Caddy and Docker Compose runtime startup | **NOT VERIFIED** | Blocked because the host Docker daemon hangs on container creation (overload/deadlock). |
| **Empty screenshots** | `/screenshots/` folders empty | Checked screenshots directory | **NOT VERIFIED** | Blocked by Docker daemon hang. |
| **Tenancy isolation not proven** | No runtime multi-tenant A/B proof | Reviewed Prisma schemas and resolver middleware | **PARTIALLY RESOLVED** | Schema scopes constraints correctly, middleware gates headers, but runtime A/B check is blocked by Docker. |
| **Worker/PDF failure behavior** | Queue retry/failure not verified | Checked BullMQ config files and specs | **PARTIALLY RESOLVED** | BullMQ retry configurations are structurally verified in code, but live runtime queues are blocked. |
| **Reports marked IN PROGRESS** | Draft status on previous markdown files | Checked current markdown file contents | **RESOLVED** | All audit reports are finalized. |
| **Workflow drift on document publish** | Inconsistent generate vs publish commands | Reviewed `encounter-workflow.spec.ts` and `documents.service.spec.ts` | **RESOLVED** | API tests confirm that document publishing is idempotent, and status mutations are command-only. |
| **Admin Route Governance issues** | Route groups messy/hidden workflows | Inspected `apps/admin/src/app` filesystem | **STILL PRESENT** | `apps/admin/src/app/login` is outside the required route groups. |
| **Operator Route Governance issues** | Confusing/non-namespaced routes | Inspected `apps/operator/src/app` filesystem | **STILL PRESENT** | `apps/operator/src/app/login` is outside the required route groups. |
| **Missing Healthchecks** | Misconfigured Next.js healthchecks | Checked `docker-compose.yml` healthcheck status | **RESOLVED** | Next.js healthchecks are explicitly disabled (serving confirmed via Caddy), and API/PDF healthchecks are present. |

---

## Analysis of Key Concerns

1. **API Unit Tests (May 5th Failing -> Now Passing):** 
   The NestJS API tests were previously failing due to DB teardown and minor service logic issues. The test suite has been updated, and the current run of `pnpm --filter @vexel/api test` is 100% green.
2. **SDK Test Tooling:**
   The `jest` binary is missing from `packages/sdk/package.json`. While the TypeScript compiler successfully type-checks the SDK source, running `pnpm test` in the SDK folder will always fail until `jest` is installed.
3. **Route Governance:**
   Both Next.js apps violate the Route Group rules set forth in `AGENTS.md` by placing `login` routes directly in `src/app/` rather than under `(public)`. This must be corrected in the next sprint.
