# Gap/Risk Report

## High Severity Gaps

| ID | Area | Issue | Evidence | Impact | Recommended Fix | Blocks Production? |
| -- | ---- | ----- | -------- | ------ | --------------- | ------------------ |
| G-01 | CI/CD | `manual-e2e.yml` is missing Playwright smoke steps. | `manual-e2e.yml` ends after API tests. | Release verification is not automated in CI. | Add `pnpm exec playwright test` steps to the workflow. | **YES** (Release Gate) |

## Medium Severity Risks

| ID | Area | Issue | Evidence | Impact | Recommended Fix | Blocks Production? |
| -- | ---- | ----- | -------- | ------ | --------------- | ------------------ |
| R-01 | Privacy | PHI stored in `AuditEvent` JSON blobs. | `audit.service.ts` | Sensitive data exposed to audit readers. | strictly limit audit log access to authorized personnel. | NO |
| R-02 | Ops | Destructive restore endpoints gated but active. | `ops.service.ts` | Potential for data loss if credentials compromised. | Ensure `VEXEL_ALLOW_RESTORE` is `false` in production except during maintenance. | NO |

## Low Severity / Tech Debt

| ID | Area | Issue | Evidence | Impact | Recommended Fix | Blocks Production? |
| -- | ---- | ----- | -------- | ------ | --------------- | ------------------ |
| T-01 | Security | Default secrets in code as fallbacks. | `storage.service.ts` | Weak security if ENV vars missing. | Use standard vault or strictly enforced required ENV vars. | NO |
| T-02 | Type Safety | Extensive use of `as any` in frontend SDK calls. | `grep` in `apps/admin` | Reduced compile-time safety. | Refactor to use proper template literal types or generated path enums. | NO |
| T-03 | Code Quality | Duplicate/Redundant routes in Operator UI. | `find` results in `apps/operator` | Confusion for future developers. | Cleanup legacy routes (e.g., `/lims/*` vs root). | NO |

## Status Summary
The platform is in a strong operational state, but the missing E2E steps in the manual-trigger CI is a critical gap for the release process. Addressing the PHI exposure in audit logs is a key compliance requirement for production.
