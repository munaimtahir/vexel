# OPD MVP Data Model (Prisma / MVP Scaffold)

This document tracks the OPD MVP Prisma data model additions owned by Subagent A. It is a data-model scaffold only (no endpoint implementation). Contract-first remains locked: OpenAPI/SDK changes happen in a separate prompt.

## Shared Core Changes

### `Encounter` (existing shared model)
- Added `moduleType String @default("LIMS")`
- Purpose: allow OPD encounters to coexist with LIMS encounters without breaking current LIMS defaults/queries.
- New index: `@@index([tenantId, moduleType, status])`

## New OPD + Billing Entities (MVP)

### `Provider`
- Tenant-owned provider/doctor profile (multi-doctor support)
- Fields include: `displayName`, optional `code`, `specialty`, registration/contact info, `isActive`
- Relations: `ProviderSchedule[]`, `Appointment[]`, `OPDVisit[]`, `OPDClinicalNote[]`, `OPDPrescription[]`

### `ProviderSchedule`
- Tenant-owned provider availability template
- Fields include: `weekday`, `startTime`, `endTime`, `slotMinutes`, effective date range
- Relation: `Provider`

### `Appointment`
- Tenant-owned OPD appointment booking record
- Command-friendly status field (`BOOKED`, `CHECKED_IN`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`, `NO_SHOW`)
- Fields include scheduling timestamp, duration, reason, notes, and state timestamps
- Relations: `Patient`, `Provider`, optional linked `OPDVisit`

### `OPDVisit`
- Tenant-owned OPD consultation visit record
- Tied to shared `Encounter` and shared `Patient`
- Command-friendly status field (`REGISTERED`, `WAITING`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`)
- Optional link to `Appointment`
- Relations: `OPDVitals[]`, `OPDClinicalNote[]`, `OPDPrescription[]`, `Invoice[]`

### `OPDVitals`
- Tenant-owned vitals capture rows (multiple captures per visit supported)
- Common vitals numeric fields (BP, pulse, temp, SpO2, etc.)

### `OPDClinicalNote`
- Tenant-owned structured clinical note
- JSON blocks for structured note sections (`subjectiveJson`, `objectiveJson`, `assessmentJson`, `planJson`)
- Status field supports future sign workflow (`DRAFT`, `SIGNED`)

### `OPDPrescription`
- Tenant-owned free-text prescription header
- Status field supports future command workflow (`DRAFT`, `SIGNED`, `PRINTED`)
- Relation to `OPDPrescriptionItem[]`

### `OPDPrescriptionItem`
- Tenant-owned free-text prescription line items
- Drug catalog/formulary is intentionally deferred; MVP stores free text only

### `Invoice`
- Tenant-owned OPD billing invoice
- Command-friendly status (`DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `VOID`)
- Decimal totals (`subtotalAmount`, `discountAmount`, `totalAmount`, `amountPaid`, `amountDue`)
- Optional links to shared `Encounter` and `OPDVisit`

### `InvoiceLine`
- Tenant-owned invoice lines with decimal amounts and `sortOrder`

### `Payment`
- Tenant-owned invoice payment rows
- Includes `correlationId` for command/job/audit tracing and status (`POSTED`, `VOIDED`)

## Tenant Ownership Matrix

All new OPD/billing rows include `tenantId`:
- `Provider`
- `ProviderSchedule`
- `Appointment`
- `OPDVisit`
- `OPDVitals`
- `OPDClinicalNote`
- `OPDPrescription`
- `OPDPrescriptionItem`
- `Invoice`
- `InvoiceLine`
- `Payment`

Shared tenant-owned rows reused by OPD:
- `Patient`
- `Encounter` (now namespaced by `moduleType`)
- `Document` (existing deterministic document pipeline)

## Tenant-Scoped Uniques / Indexes (OPD Additions)

Tenant-scoped uniques:
- `Provider`: `[tenantId, code]`, `[tenantId, registrationNo]`
- `ProviderSchedule`: `[tenantId, providerId, weekday, startTime, endTime]`
- `Appointment`: `[tenantId, appointmentCode]`
- `OPDVisit`: `[tenantId, encounterId]`, `[tenantId, appointmentId]`, `[tenantId, visitCode]`
- `OPDClinicalNote`: `[tenantId, visitId]`
- `OPDPrescription`: `[tenantId, visitId]`
- `OPDPrescriptionItem`: `[tenantId, prescriptionId, sortOrder]`
- `Invoice`: `[tenantId, invoiceCode]`
- `InvoiceLine`: `[tenantId, invoiceId, sortOrder]`
- `Payment`: `[tenantId, paymentCode]`

Tenant-filtering indexes added for workflow/list queries:
- `Encounter`: `[tenantId, moduleType, status]`
- `Appointment`: status/patient/provider + schedule date indexes
- `OPDVisit`: status/patient/provider + created date indexes
- `Invoice`: status/patient/opdVisit/encounter indexes
- `Payment`: invoice + received date/status/correlation indexes

## Workflow / Audit / Command-Only Support Notes

- Workflow state fields are present on `Appointment`, `OPDVisit`, `OPDPrescription`, `Invoice`, and `Payment`.
- These fields are data-model support only; future API commands must enforce transitions, return `409` on invalid transitions, and write `AuditEvent` entries.
- Actor/correlation fields are included where useful (`bookedById`, `createdById`, `receivedById`, `correlationId`) without locking API payload contracts yet.

## Deterministic Documents (Invoice / Receipt)

OPD invoice/receipt PDFs must use the existing deterministic document pipeline (`Document.payloadHash`, `Document.pdfHash`, idempotent publish). The OPD billing models provide stable source entities (`Invoice`, `Payment`, optional `Encounter`/`OPDVisit`) for future command endpoints to generate deterministic payloads.

## Deferred Entities (Out of MVP)

- Insurance / payer / claims
- Drug catalog / formulary
- Reminder jobs (SMS/WhatsApp/email)
- Patient portal models
- Payment gateway transaction models
