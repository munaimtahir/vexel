# OPD Coverage Audit (2026-02-26)

## Scope
- Complete OPD backend ↔ frontend linkage audit (operator + admin)
- Close prior gaps (provider detail, provider availability, OPD billing UI)
- Run smoke checks (API workflow transitions + UI route/page checks)
- Add OPD sidebar entries only after 100% endpoint coverage

## Result
- OPD endpoint coverage: **100%** (all current OPD backend endpoints have frontend UI coverage)
- Frontend OPD API calls: **all mapped** to existing backend endpoints
- OPD sidebar (operator): **added**, gated by `module.opd`

## Changes Implemented

### Route Cleanup
- Renamed operator OPD visit route file from `apps/operator/src/app/(protected)/opd/visits/[encounterId]/page.tsx` to `apps/operator/src/app/(protected)/opd/visits/[visitId]/page.tsx`
- Updated page param usage to `visitId`

### New UI Coverage (previous gaps)
- Admin OPD Provider Detail (covers `GET /api/opd/providers/{providerId}`)
  - `apps/admin/src/app/(protected)/opd/providers/[providerId]/page.tsx`
- Operator Provider Availability (covers `GET /api/opd/providers/{providerId}/availability`)
  - `apps/operator/src/app/(protected)/opd/providers/[providerId]/availability/page.tsx`
- Operator OPD Billing UI (covers all `/api/opd/billing/*`)
  - `apps/operator/src/app/(protected)/opd/billing/page.tsx`
  - `apps/operator/src/app/(protected)/opd/billing/new/page.tsx`
  - `apps/operator/src/app/(protected)/opd/billing/invoices/[invoiceId]/page.tsx`

### UX Improvements
- OPD appointment booking page:
  - Active provider picker (`GET /opd/providers`)
  - In-page availability slot lookup (`GET /opd/providers/{providerId}/availability`)
  - Slot click autofills `scheduledAt`
- OPD billing list page:
  - Added `appointmentId` / `visitId` filters
  - Preserves filter context in `New Invoice` link
- OPD billing new page:
  - Supports query-prefill (`patientId`, `visitId`, `appointmentId`)
- OPD invoice detail page:
  - Clear command availability hints (Issue / Record Payment / Void)
  - Disabled command buttons when state is invalid

### Navigation
- Added operator sidebar OPD section (feature flag gated)
  - `OPD Worklist`
  - `New Appointment`
  - `OPD Billing`

## Strict Endpoint-by-Endpoint Coverage Verification

### Providers / Scheduling
- `GET /api/opd/providers` -> Admin Providers list, Admin Schedules provider picker, Operator Appointment New provider picker
- `POST /api/opd/providers` -> Admin Providers create form
- `GET /api/opd/providers/{providerId}` -> Admin Provider Detail page
- `PATCH /api/opd/providers/{providerId}` -> Admin Providers edit form
- `GET /api/opd/providers/{providerId}/schedules` -> Admin Schedules list
- `POST /api/opd/providers/{providerId}/schedules` -> Admin Schedules create form
- `PATCH /api/opd/providers/{providerId}/schedules/{scheduleId}` -> Admin Schedules edit form
- `DELETE /api/opd/providers/{providerId}/schedules/{scheduleId}` -> Admin Schedules delete action
- `GET /api/opd/providers/{providerId}/availability` -> Operator Availability page + Appointment New in-page slot lookup

### Appointments
- `GET /api/opd/appointments` -> Operator OPD Worklist appointments section
- `POST /api/opd/appointments` -> Operator Appointment New form
- `GET /api/opd/appointments/{appointmentId}` -> Operator Appointment Detail page
- `POST /api/opd/appointments/{appointmentId}:reschedule` -> Appointment Detail reschedule form
- `POST /api/opd/appointments/{appointmentId}:check-in` -> Appointment Detail command button
- `POST /api/opd/appointments/{appointmentId}:start-consultation` -> Appointment Detail command button
- `POST /api/opd/appointments/{appointmentId}:complete` -> Appointment Detail command button
- `POST /api/opd/appointments/{appointmentId}:cancel` -> Appointment Detail cancel form
- `POST /api/opd/appointments/{appointmentId}:mark-no-show` -> Appointment Detail command button

### Visits
- `GET /api/opd/visits` -> Operator OPD Worklist visits section
- `POST /api/opd/visits` -> Appointment Detail create-visit form
- `GET /api/opd/visits/{visitId}` -> Operator Visit Detail page
- `POST /api/opd/visits/{visitId}:mark-waiting` -> Visit Detail command button
- `POST /api/opd/visits/{visitId}:start-consultation` -> Visit Detail command button
- `POST /api/opd/visits/{visitId}:complete` -> Visit Detail command button
- `POST /api/opd/visits/{visitId}:cancel` -> Visit Detail cancel form

### OPD Billing
- `GET /api/opd/billing/invoices` -> Billing list page
- `POST /api/opd/billing/invoices` -> Billing new invoice form
- `GET /api/opd/billing/invoices/{invoiceId}` -> Invoice detail page
- `GET /api/opd/billing/invoices/{invoiceId}/payments` -> Invoice payments section refresh
- `POST /api/opd/billing/invoices/{invoiceId}:issue` -> Invoice detail issue form/button
- `POST /api/opd/billing/invoices/{invoiceId}:void` -> Invoice detail void form/button
- `POST /api/opd/billing/invoices/{invoiceId}:record-payment` -> Invoice detail payment form/button

## Smoke Test Evidence

### Running App / Route Availability
- `GET /api/health` -> `200`
- `GET /opd/worklist` -> `200`
- `GET /opd/appointments/new` -> `200`
- `GET /opd/billing` -> `200`
- `GET /opd/billing/new` -> `200`
- `GET /admin/opd` -> `307` (expected unauthenticated redirect to admin login)
- `GET /admin/opd/providers` -> `307` (expected unauthenticated redirect)
- `GET /admin/opd/schedules` -> `307` (expected unauthenticated redirect)
- `GET /admin/opd/feature-flags` -> `307` (expected unauthenticated redirect)

### Seeded OPD Smoke Data (created during this session)
- `providerId`: `f789d676-4da6-4b8b-b890-cb39d1b11dec`
- `patientId`: `d2beb98c-ca26-44bd-a558-4d62f77c46cd`
- `appointmentId`: `ceeb954a-f536-4bcf-a748-48db5da71072`
- `visitId`: `392a9fd3-264e-4fe6-ad9c-823e3c27051c`
- `invoiceId`: `8b988485-66ba-45e0-b36a-097f4051e190`

### API Workflow Smoke (tenant-scoped, operator token)
- Appointment commands:
  - check-in -> `200`, status `CHECKED_IN`
  - start-consultation -> `200`, status `IN_CONSULTATION`
  - complete -> `200`, status `COMPLETED`
- Visit commands:
  - mark-waiting -> `200`, status `WAITING`
  - start-consultation -> `200`, status `IN_CONSULTATION`
  - complete -> `200`, status `COMPLETED`
- Billing commands:
  - issue invoice -> `200`, status `ISSUED`
  - record payment -> `200`, invoice status `PAID`
  - get invoice -> `200`, status `PAID`
  - list invoice payments -> `200`, count `1`

### Browser Smoke (Playwright CLI)
- Verified operator UI login (super-admin) redirects to `/lims/worklist`
- Checked OPD page navigations / route rendering behavior with Playwright CLI snapshots for:
  - `/opd/worklist`
  - `/opd/appointments/new?...`
  - `/opd/providers/{providerId}/availability`
  - `/opd/appointments/{appointmentId}`
  - `/opd/visits/{visitId}`
  - `/opd/billing?...`
  - `/opd/billing/new?...`
  - `/opd/billing/invoices/{invoiceId}`
- Playwright snapshots stored under `.playwright-cli/` during session

## Validation
- `pnpm -C apps/admin exec tsc --noEmit` ✅
- `pnpm -C apps/operator exec next typegen` ✅ (regenerated route types after visit route rename)
- `pnpm -C apps/operator exec tsc --noEmit` ✅

## Notes
- Operator UI login with demo operator account redirects to `?error=no_operator_access` because operator protected layout currently requires `module.operator` permission (or super-admin). API login still succeeds and tenant-scoped OPD API smoke passed using operator credentials.
- This audit preserves contract-first and command-only workflow guardrails: all state changes are still done through command endpoints.
