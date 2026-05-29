# Scope and Decision Verification

## MVP Scope Matrix

| Component | Found | In MVP? | Fresh Evidence | Notes |
| --------- | ----- | ------- | -------------- | ----- |
| API | YES | YES | `apps/api/` exists | Core backend. |
| Worker | YES | YES | `apps/worker/` exists | Async job processor. |
| PDF Service | YES | YES | `apps/pdf/` exists | QuestPDF renderer. |
| Admin UI | YES | YES | `apps/admin/` exists | Platform management. |
| Operator UI | YES | YES | `apps/operator/` exists | LIMS workflow. |
| Contracts | YES | YES | `packages/contracts/` | OpenAPI source. |
| SDK | YES | YES | `packages/sdk/` | Generated client. |
| LIMS Catalog | YES | YES | `apps/api/src/catalog/` | Catalog management. |
| LIMS Workflow | YES | YES | `apps/api/src/encounters/` | Registration to Report. |
| Feature Flags | YES | YES | `apps/api/src/feature-flags/` | Tenant-scoped toggles. |
| Mobile App | YES | NO | `apps/mobile/` exists | Explicitly excluded in `package.json` scripts. |
| OPD | YES | NO | `apps/api/src/opd/` | Classified as future/non-MVP. |

## Strategic Decision Verification

| Decision | Fresh Evidence | Status | Risk | Notes |
| -------- | -------------- | ------ | ---- | ----- |
| Mobile excluded from MVP gates | `package.json` filters | VERIFIED | LOW | `turbo run build --filter=!@vexel/mobile` |
| OPD is non-MVP/future | `apps/api/src/opd/` | VERIFIED | LOW | Code exists but gated/excluded from MVP flow. |
| LIMS feature flags are MVP | `feature-flags/registry.ts` | VERIFIED | LOW | `module.lims` is implemented. |
| Report autopublish is MVP | `encounters.service.ts` | VERIFIED | LOW | Auto-generate called after verify. |
| Deep health checks are MVP | `health.controller.ts` | VERIFIED | LOW | `/health/deep` endpoint exists. |
| Manual-trigger E2E CI | `scripts/playwright-mcp.sh` | VERIFIED | LOW | Present in `package.json`. |

## Status Summary
Scope alignment is **VERIFIED**. The platform structure correctly isolates MVP components from non-MVP ones (mobile, OPD).
