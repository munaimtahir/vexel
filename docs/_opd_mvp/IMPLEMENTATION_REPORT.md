# OPD MVP Implementation Report

Date: 2026-02-24
Lead: Lead Implementation Agent (delegated subagents A-G)

## Summary

OPD MVP foundation is implemented across data model, contract, API, admin UI, operator UI, deterministic PDF pipeline, and initial tests.

The work was executed via delegated subagents by category:
- Subagent A: Prisma + migration + seed + data model doc
- Subagent B: OpenAPI + SDK regen + contract map doc
- Subagent C: NestJS API modules + command workflows + audit + workflow doc
- Subagent D: Admin OPD config UI
- Subagent E: Operator OPD workflow UI
- Subagent F: Deterministic OPD invoice/receipt PDF support
- Subagent G: Tests + OPD smoke docs + test plan

## What Shipped (MVP Foundation)

### Data Model / Prisma (A)
- `Encounter.moduleType` added with default `LIMS` for backward compatibility
- OPD entities added (tenant-owned):
  - `Provider`, `ProviderSchedule`, `Appointment`, `OPDVisit`, `OPDVitals`, `OPDClinicalNote`, `OPDPrescription`, `OPDPrescriptionItem`
- Billing entities added (tenant-owned):
  - `Invoice`, `InvoiceLine`, `Payment`
- Tenant-scoped unique constraints / indexes added for OPD and billing query patterns
- Seed updated with OPD feature flags (disabled by default) and roles:
  - `opd-operator`, `opd-doctor`, `opd-finance`

### Contract + SDK (B)
- OpenAPI extended with additive OPD endpoints under `/opd/*` (runtime `/api/opd/*`)
- OPD schemas added under `components.schemas`
- SDK regenerated (`packages/sdk/src/generated/api.d.ts`)
- LIMS contract surface kept additive-only (no intentional breaking changes)

### API / NestJS (C)
- Implemented modules/controllers/services:
  - `apps/api/src/opd/*`
  - `apps/api/src/appointments/*`
  - `apps/api/src/billing/*`
- `module.opd` feature flag enforcement on OPD endpoints
- Tenant filtering on all OPD reads/writes
- Command-only workflow transitions with `409 Conflict` for invalid transitions/invariants
- Audit events written on commands and config writes
- Modules imported into `apps/api/src/app.module.ts`
- LIMS compatibility guard added via `Encounter.moduleType='LIMS'` scoping in LIMS encounter service flows

### Admin UI (D)
- Admin OPD config pages (SDK-only):
  - `/admin/opd`
  - `/admin/opd/providers`
  - `/admin/opd/schedules`
  - `/admin/opd/feature-flags`

### Operator UI (E)
- Operator OPD pages (SDK-only):
  - `/opd/worklist`
  - `/opd/appointments/new`
  - `/opd/appointments/[id]`
  - `/opd/visits/[encounterId]`
- Pages support appointment and visit command actions via OPD API command endpoints

### Deterministic Documents / PDF (F)
- `DocumentsService` supports `OPD_INVOICE_RECEIPT` internal doc type
- Seed includes system `DocumentTemplate` for `opd_invoice_receipt_v1`
- PDF service supports template dispatch for:
  - `lab_report_v1`
  - `receipt_v1`
  - `opd_invoice_receipt_v1`
- Lab report rendering updated to avoid non-deterministic header timestamp source (`DateTime.UtcNow`)

### Tests / Smoke / QA Docs (G)
- Added API tests:
  - appointment transitions (`409` invalid transition)
  - billing payment status/balance transitions
  - tenant isolation checks (appointment + invoice)
- OPD smoke section in `docs/ops/SMOKE_TESTS.md` upgraded from placeholder to actionable steps
- `docs/_opd_mvp/TEST_PLAN.md` updated with strategy, commands, and pass criteria

## Endpoints List

See `docs/_opd_mvp/OPENAPI_MAP.md` for full inventory and schema list.

Implemented OPD endpoint groups:
- Providers + schedules + availability
- Appointments (list/read + command transitions)
- Visits (list/read + command transitions)
- Billing invoices + payments (reads + command transitions)

## Schema Summary

See `docs/_opd_mvp/DATA_MODEL.md` for the full Prisma schema summary (models, relations, indexes, tenant ownership).

Key compatibility decision:
- `Encounter.moduleType` defaults to `LIMS` so existing LIMS rows and flows remain unchanged by default.

## Workflow Summary

See `docs/_opd_mvp/WORKFLOW_STATE_MACHINES.md` for implemented transitions, command mappings, audit actions, and LIMS compatibility guards.

## Smoke Steps

See `docs/ops/SMOKE_TESTS.md` (OPD section) for actionable OPD smoke scenarios covering:
- provider config
- scheduling/availability
- appointment lifecycle
- visit lifecycle
- billing lifecycle
- tenancy isolation
- deterministic OPD invoice/receipt document validation

## Test Commands + Results (Subagent Evidence)

### Subagent A (Prisma/Data)
- `npx prisma validate --schema prisma/schema.prisma` ✅
- `npx prisma migrate deploy --schema prisma/schema.prisma` ✅
- `npx ts-node --transpile-only --skip-project --compiler-options '{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}' prisma/seed.ts` ✅
- Note: `prisma migrate dev --create-only` failed due pre-existing shadow DB migration-chain issue (`P3006` on older migration); migration SQL was generated via `prisma migrate diff` and applied successfully.

### Subagent B (OpenAPI/SDK)
- `pnpm --filter @vexel/contracts sdk:generate` ✅
- `bash packages/sdk/scripts/check-sdk-freshness.sh` ✅ (script behavior is CI-oriented; local uncommitted diff not exhaustively validated by that script)

### Subagent C (API)
- `pnpm --filter @vexel/api build` ✅
- `pnpm --filter @vexel/api test -- encounters/__tests__/encounter-workflow.spec.ts --runInBand` ✅
- `curl http://127.0.0.1:9021/api/health` ✅

### Subagent D (Admin UI)
- `npx tsc --noEmit` in `apps/admin` ✅
- `npx next lint` in `apps/admin` ⚠️ not feasible in current workspace (`eslint` package missing)
- `rg` no raw `fetch`/`axios` in OPD admin pages ✅

### Subagent E (Operator UI)
- OPD pages implemented ✅
- Repo-wide `pnpm --dir apps/operator exec tsc --noEmit` ⚠️ failed due pre-existing unrelated errors in non-OPD files (`DocumentListProps`, sidebar icon style typings)
- Scoped `rg` no raw `fetch`/`axios` in OPD operator pages ✅
- Scoped check found no OPD page errors in tsc output ✅

### Subagent F (Documents/PDF)
- `dotnet build` in `apps/pdf` ✅
- `pnpm --filter @vexel/api test -- src/documents` ✅

### Subagent G (Tests/Smoke)
- `pnpm --filter @vexel/api test -- appointments/__tests__/appointments.service.spec.ts billing/__tests__/billing.service.spec.ts` ✅
- `pnpm --filter @vexel/api test -- documents/__tests__/document-idempotency.spec.ts` ✅ (LIMS regression spot-check)

## Live OPD API Smoke (Executed)

Date (UTC): `2026-02-25`

### Precondition / Environment Note

- Initial OPD smoke attempt returned `404` on `GET /api/opd/providers` because the running API container was an older build without OPD routes.
- Resolved by rebuilding/restarting only the API service from `main`:
  - `docker compose build api`
  - `docker compose up -d api`

### Smoke Path Executed (Authenticated)

Using `admin@vexel.system` (system super-admin), the following flow was executed against `http://127.0.0.1:9021/api`:

1. Login and obtain JWT
2. Enable flags:
   - `module.opd`
   - `opd.providers`
   - `opd.scheduling`
   - `opd.appointments`
   - `opd.billing`
3. Read an existing patient (`GET /patients?page=1&limit=1`)
4. Create provider (`POST /opd/providers`)
5. Create provider schedule (`POST /opd/providers/{providerId}/schedules`)
6. Read availability (`GET /opd/providers/{providerId}/availability`)
7. Create appointment (`POST /opd/appointments`)
8. Check-in appointment (`POST /opd/appointments/{id}:check-in`)
9. Create visit (`POST /opd/visits`)
10. Visit transitions:
    - `:mark-waiting`
    - `:start-consultation`
    - `:complete`
11. Create invoice (`POST /opd/billing/invoices`)
12. Issue invoice (`POST /opd/billing/invoices/{id}:issue`)
13. Record payment (`POST /opd/billing/invoices/{id}:record-payment`)

### Smoke Result

PASS — end-to-end OPD happy path completed through payment.

### Evidence (Structured Summary)

```json
{"correlationId":"opd-smoke-1771977596","date":"2026-02-25","scheduledAt":"2026-02-25T00:30:00Z","patientId":"9a221096-7379-4dbd-bad5-0b8b9dedf0f4","providerId":"5d19cca6-400a-4471-9a75-2173119ead9e","scheduleId":"68349b95-1168-4090-a193-2ac328234563","appointmentId":"44b7f755-0b01-4257-8928-aff049524eeb","appointmentStatusAfterCheckIn":"CHECKED_IN","visitId":"c39d31b6-61c7-4ef3-b920-99ec7c77d258","encounterId":"025aadf6-1368-48d2-a2f8-9282cdcd8088","visitStatusAfterComplete":"COMPLETED","invoiceId":"70094b63-877a-49b3-a5dc-3378953cda8c","paymentId":"ddb75928-03d0-448d-a485-39f2fb1f16d2","invoiceStatusAfterPayment":"PAID","balanceDue":"0"}
```

### Notes

- The generated appointment slot timestamp crossed UTC date boundaries during an earlier attempt; the smoke script was adjusted to derive the schedule weekday/date from the final scheduled timestamp to avoid false unavailability conflicts.
- This smoke validates provider/scheduling/appointment/visit/billing command wiring and tenant-scoped execution, but does not yet validate OPD invoice/receipt document generation in the deterministic document pipeline.

## Guardrails Compliance Status

- Contract-first: ✅ OPD contract added before/with API/UI use; SDK regenerated
- SDK-only frontend: ✅ Admin/Operator OPD pages use SDK client patterns; no raw fetch/axios introduced in OPD pages
- Tenancy structural: ✅ tenantId modeled on OPD/billing entities; API filters tenant-scoped
- Command-only workflows + `409`: ✅ appointments/visits/invoices implemented via commands with conflict checks
- Admin config-only: ✅ admin pages limited to providers/schedules/flags
- Deterministic documents: ✅ OPD invoice/receipt template support added in existing deterministic pipeline
- LIMS backward compatibility: ✅ explicit `moduleType='LIMS'` guards added; LIMS doc idempotency regression test passed

## Known Deviations / Notes

- Endpoint shapes implemented are command-oriented but differ from the exact user-proposed naming in some cases (e.g., REST create/list routes plus `:command` transitions instead of `:book`/`:arrive`-only patterns everywhere). Guardrails are preserved, but downstream consumers should follow the actual `OPENAPI_MAP`.
- OPD-specific RBAC permissions were not fully introduced in the central permission enum yet; API currently reuses existing permissions (`MODULE_ADMIN` / `ENCOUNTER_MANAGE`) pending a dedicated RBAC expansion slice.
- Some contract fields are returned conservatively (`null`/`0`) where Prisma/runtime fields are not fully modeled yet.
- `apps/admin` and `apps/operator` lint commands are not runnable as-is in this workspace due missing `eslint` dev dependency.
- Repo-wide operator typecheck still fails due pre-existing unrelated issues outside OPD scope.

## Deferred List (Repeated)

- Payment gateway integration
- Patient portal
- Drug catalog / formulary
- Reminders (SMS / WhatsApp / email)
- Insurance / claims / payer workflows

## Recommended Next Steps (Post-MVP Foundation)

1. Add OPD-specific RBAC permission constants + route-level permission refinements.
2. Align any contract/implementation endpoint naming mismatches and regenerate SDK.
3. Add real OPD visit clinical payload commands (`record-vitals`, `update-note`, `add-rx-item`, `finalize`, `close`) if not fully implemented yet.
4. Run end-to-end OPD happy-path smoke against live stack with `module.opd` enabled for demo tenant.
5. Add OPD invoice/receipt deterministic document generation E2E (same payload hash idempotency) to automated tests.

## Final Validation Update (Post-Fix E2E Run)

Date (UTC): `2026-02-25`

### Additional Fixes Applied During Final Verification

- Tenant isolation hardening (backend):
  - `apps/api/src/auth/jwt-auth.guard.ts`
  - Authenticated requests can no longer override tenant scope via `x-tenant-id`; mismatched tenant header now returns `403`, and request tenant context is forced to the JWT tenant.
- Admin E2E stabilization:
  - `apps/e2e/tests/02-admin-crud.spec.ts`
  - Create-user test updated to use scoped form selectors (avoids brittle label/ID assumptions).
  - Feature-flag toggle test verifies state by backend readback and uses a non-LIMS flag (`module.rad`) to avoid cross-project interference in parallel E2E runs.

### Playwright E2E Results (Final)

- `pnpm --filter @vexel/e2e test apps/e2e/tests/07-tenant-isolation.spec.ts` ✅ `3/3 passed`
- `pnpm --filter @vexel/e2e test apps/e2e/tests/02-admin-crud.spec.ts` ✅ `5/5 passed`
- `pnpm --filter @vexel/e2e test` ✅ `25/25 passed` (`22.8s`)

### Important Local State Note

- A failing intermediate full-suite run was caused by local DB state where `module.lims` had been toggled `false`.
- Re-enabled `module.lims` for the system tenant before the final full-suite run.
- This was a test-environment state issue, not a product regression in the LIMS encounter/workflow/document flows.

### CI Status Clarification

- Playwright E2E (local equivalent of the CI E2E job) is green.
- Full GitHub Actions matrix was not executed locally end-to-end in this session; CI should be run in the repository pipeline to confirm all jobs beyond E2E.
