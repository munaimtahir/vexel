# Code reuse and removal plan

## Reuse before rewriting

1. Repair the current canonical OPD service/schema/pages. They already reuse shared auth, tenancy, Patient, Encounter, finance, audit, documents, worker and PDF infrastructure; never resurrect the dropped legacy OPD tables.
2. Use Operator `PublicShell` for login/public routes.
3. Evaluate Admin `PermissionGuard` as the standard presentation guard while backend RBAC remains authoritative.
4. Consolidate on `packages/ui-system/StatusBadge`; migrate application mappings deliberately.
5. Preserve Mobile Expo navigation/visual ideas only. Its mock clients are not reusable business logic until SDK/auth/tenant/flags/CI integration.

## Compatibility of reusable items

| Component | Prisma | OpenAPI/SDK | Nest/tenancy/RBAC | Flags/audit/docs | Frontend/tests | Can accelerate? |
|---|---|---|---|---|---|---|
| Canonical OPD implementation | Current canonical models | Broad surface exists but drift needs repair | Shared modules, partial enforcement | Shared pipeline, incomplete flags | Real pages, shallow tests | Yes, materially; repair rather than replace |
| PublicShell | N/A | N/A | N/A | Theme-compatible | Fits current App Router | Yes, small UI-governance closure |
| PermissionGuard | N/A | Uses current auth state | Presentation only | N/A | Needs page policy tests | Yes after policy decision |
| UI-system StatusBadge | N/A | N/A | N/A | Canonical token system | Widely used | Yes, after mapping parity |
| Mobile scaffold | No DB access | No SDK yet | Mock auth/tenant | Mock status | Excluded from CI | Only after substantial refactor |

## Evidence-supported eventual removal candidates

Nothing is removed by this audit.

### HIGH confidence

- Old Operator sidebar after one clean build/navigation smoke.
- Broken Admin `/opd/providers` and `/opd/schedules` nav entries (entries only).
- Unused theme TypeScript status-badge export after external-consumer check.
- `scripts/audit-admin-ui.ts` after preserving any useful intent in Playwright.
- `apps/admin/src/lib/utils.ts` after Admin typecheck/build.
- Live-path tsbuildinfo/Playwright outputs after untracking and ignore updates.

### MEDIUM confidence; prerequisites required

- Tenant-settings redirect pages after an external bookmark/access-log window.
- Deprecated feature flags after tenant-row migration.
- Exact unused catalog aliases after access logs, contract choice and consumer search.
- Deprecated LIMS commands only after every UI/test consumer migrates and workflow E2E passes.

### LOW confidence; do not automate

- Either active Operator status wrapper before mapping/import migration.
- Transfer-artifact script without infrastructure-owner confirmation.
- Any historical migration or dated audit evidence.
- Active legacy schema fields before live-row profiling, backfill and report regression tests.

## Cleanup gate

Before a cleanup PR: generate a reachability graph with Next/Nest/worker/script/migration roots; review production access logs; profile deprecated flags and legacy columns; run SDK freshness, lint, typecheck, build and full LIMS/OPD route smoke; and add producer-consumer tests for every queue/job shape.
