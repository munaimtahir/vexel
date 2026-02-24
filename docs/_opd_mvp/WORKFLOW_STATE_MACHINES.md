# OPD MVP Workflow State Machines (Implemented)

Date: 2026-02-24
Owner: Subagent C (API implementation)

This documents the currently implemented OPD MVP command transitions in `apps/api/src/appointments/**` and `apps/api/src/billing/**`.

## Guardrails enforced

- Contract-first: endpoints implemented for the OPD contract paths (providers/schedules/availability, appointments, visits, billing invoices/payments).
- Tenant isolation: every read/write query includes `tenantId`.
- Feature flag: all OPD endpoints require `module.opd` enabled for tenant.
- Command-only workflow mutation: appointment/visit/invoice state changes happen only via command endpoints.
- Invalid transitions return `409 Conflict`.
- Audit events written on create/config writes and all command endpoints.

## Appointment State Machine

States:
- `BOOKED`
- `CHECKED_IN`
- `IN_CONSULTATION`
- `COMPLETED`
- `CANCELLED`
- `NO_SHOW`

Allowed transitions (implemented):
- `BOOKED -> CHECKED_IN` via `POST /opd/appointments/{appointmentId}:check-in`
- `BOOKED -> CANCELLED` via `POST /opd/appointments/{appointmentId}:cancel`
- `BOOKED -> NO_SHOW` via `POST /opd/appointments/{appointmentId}:mark-no-show`
- `CHECKED_IN -> IN_CONSULTATION` via `POST /opd/appointments/{appointmentId}:start-consultation`
- `CHECKED_IN -> CANCELLED` via `POST /opd/appointments/{appointmentId}:cancel`
- `IN_CONSULTATION -> COMPLETED` via `POST /opd/appointments/{appointmentId}:complete`
- `IN_CONSULTATION -> CANCELLED` via `POST /opd/appointments/{appointmentId}:cancel`

Command rules:
- Reschedule (`POST /opd/appointments/{appointmentId}:reschedule`) is allowed only for non-terminal states.
- Terminal states (`COMPLETED`, `CANCELLED`, `NO_SHOW`) cannot be rescheduled.
- Slot conflicts/provider unavailability return `409 Conflict`.

Audit actions:
- `opd.appointment.create`
- `opd.appointment.reschedule`
- `opd.appointment.check_in`
- `opd.appointment.start_consultation`
- `opd.appointment.complete`
- `opd.appointment.cancel`
- `opd.appointment.mark_no_show`

## Visit State Machine

States:
- `REGISTERED`
- `WAITING`
- `IN_CONSULTATION`
- `COMPLETED`
- `CANCELLED`

Allowed transitions (implemented):
- `REGISTERED -> WAITING` via `POST /opd/visits/{visitId}:mark-waiting`
- `REGISTERED -> CANCELLED` via `POST /opd/visits/{visitId}:cancel`
- `WAITING -> IN_CONSULTATION` via `POST /opd/visits/{visitId}:start-consultation`
- `WAITING -> CANCELLED` via `POST /opd/visits/{visitId}:cancel`
- `IN_CONSULTATION -> COMPLETED` via `POST /opd/visits/{visitId}:complete`
- `IN_CONSULTATION -> CANCELLED` via `POST /opd/visits/{visitId}:cancel`

Creation:
- `POST /opd/visits` creates `REGISTERED`
- If `encounterId` is omitted, API creates a new `Encounter` with `moduleType='OPD'`.
- If `encounterId` is provided, it must belong to tenant and have `moduleType='OPD'` or `409`.

Audit actions:
- `opd.visit.create`
- `opd.visit.mark_waiting`
- `opd.visit.start_consultation`
- `opd.visit.complete`
- `opd.visit.cancel`

## Invoice State Machine (OPD Billing)

States:
- `DRAFT`
- `ISSUED`
- `PARTIALLY_PAID`
- `PAID`
- `VOID`

Allowed transitions (implemented):
- `DRAFT -> ISSUED` via `POST /opd/billing/invoices/{invoiceId}:issue`
- `ISSUED -> PARTIALLY_PAID` via `POST /opd/billing/invoices/{invoiceId}:record-payment`
- `ISSUED -> PAID` via `POST /opd/billing/invoices/{invoiceId}:record-payment`
- `PARTIALLY_PAID -> PAID` via `POST /opd/billing/invoices/{invoiceId}:record-payment`
- `DRAFT -> VOID` via `POST /opd/billing/invoices/{invoiceId}:void`
- `ISSUED -> VOID` via `POST /opd/billing/invoices/{invoiceId}:void` (only when no posted payments)

Invalid transition/invariant handling (`409 Conflict`):
- Issue from non-`DRAFT`
- Record payment from non-`ISSUED`/`PARTIALLY_PAID`
- Overpayment (`amount > balanceDue`)
- Void when invoice already `VOID`
- Void when posted payments exist / invoice is `PAID`

Audit actions:
- `opd.invoice.create`
- `opd.invoice.issue`
- `opd.invoice.void`
- `opd.invoice.record_payment`

## Provider Config (Admin-only config writes)

These are not workflow state machines, but API writes are audited and tenant-scoped:
- `POST /opd/providers` -> `opd.provider.create`
- `PATCH /opd/providers/{providerId}` -> `opd.provider.update`
- `POST /opd/providers/{providerId}/schedules` -> `opd.provider_schedule.create`
- `PATCH /opd/providers/{providerId}/schedules/{scheduleId}` -> `opd.provider_schedule.update`
- `DELETE /opd/providers/{providerId}/schedules/{scheduleId}` -> `opd.provider_schedule.delete`

Schedule constraints:
- Overlapping schedule windows for same provider + weekday return `409 Conflict`
- Delete schedule returns `409 Conflict` if matching future booked appointments exist in schedule window

## LIMS Backward-Compat Guard Added

`apps/api/src/encounters/encounters.service.ts` now refuses non-LIMS encounters in LIMS flows by:
- filtering LIMS list to `moduleType='LIMS'`
- explicitly setting `moduleType='LIMS'` on LIMS registration
- rejecting non-LIMS encounters in `getEncounterOrThrow(...)`
- scoping LIMS financial/cash commands to `moduleType='LIMS'`
