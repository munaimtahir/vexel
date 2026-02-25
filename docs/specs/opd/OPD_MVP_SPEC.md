# OPD MVP Spec (Locked for MVP)

## Purpose

This document is the authoritative OPD MVP scope lock for the OPD module bootstrap phase.
It defines scope, deferred items, state machines, feature flags, and governance alignment before any OpenAPI changes.

This prompt intentionally does **not** add OPD endpoints yet. `packages/contracts/openapi.yaml` remains unchanged and canonical.

## Scope (MVP In)

The OPD MVP includes:

- Multi-doctor support (provider setup and assignment at MVP level)
- Appointment booking
- Patient registration using the shared platform core `Patient` entity
- Vitals capture
- Structured clinical notes
- Billing + payments (cash/desk flow only in MVP)
- Free-text prescription only

## Deferred (MVP Out)

The following are explicitly deferred beyond MVP:

- Payment gateway integration
- Patient portal
- Drug catalog / formulary / medication master
- Reminders (SMS / WhatsApp / email)
- Insurance / claims / payer workflows

## OPD MVP State Machines

All workflow transitions are command-only (future `/api/opd/*` command endpoints). Admin UI must not mutate workflow statuses directly.

### Appointments

| State | Allowed Next States | Notes |
|---|---|---|
| `BOOKED` | `CHECKED_IN`, `CANCELLED`, `NO_SHOW` | New appointment booked |
| `CHECKED_IN` | `IN_CONSULTATION`, `CANCELLED` | Patient has arrived |
| `IN_CONSULTATION` | `COMPLETED` | Doctor consultation in progress |
| `COMPLETED` | _(terminal)_ | Appointment closed |
| `CANCELLED` | _(terminal)_ | Cancelled by operator/patient workflow |
| `NO_SHOW` | _(terminal)_ | Marked no-show |

### OPD Visit

| State | Allowed Next States | Notes |
|---|---|---|
| `REGISTERED` | `WAITING`, `CANCELLED` | Visit created against a patient |
| `WAITING` | `IN_CONSULTATION` | Waiting for provider |
| `IN_CONSULTATION` | `COMPLETED` | Vitals/notes/prescription captured in flow |
| `COMPLETED` | _(terminal)_ | Visit complete |
| `CANCELLED` | _(terminal)_ | Visit cancelled |

### Invoice

| State | Allowed Next States | Notes |
|---|---|---|
| `DRAFT` | `ISSUED`, `VOID` | Draft invoice before issue |
| `ISSUED` | `PARTIALLY_PAID`, `PAID`, `VOID` | Invoice issued to patient |
| `PARTIALLY_PAID` | `PAID`, `VOID` | Partial payments allowed |
| `PAID` | _(terminal)_ | Fully paid |
| `VOID` | _(terminal)_ | Voided via command |

### Prescription (Free-Text Only)

| State | Allowed Next States | Notes |
|---|---|---|
| `DRAFT` | `SIGNED` | Doctor edits free-text prescription |
| `SIGNED` | `PRINTED` | Signature/approval complete |
| `PRINTED` | _(terminal)_ | Printed output recorded as a state for MVP traceability |

## Feature Flags (Tenant-Scoped, Backend Authoritative)

The OPD MVP uses tenant-scoped, backend-authoritative feature flags:

- `module.opd`
- `opd.providers`
- `opd.scheduling`
- `opd.appointments`
- `opd.vitals`
- `opd.clinical_note`
- `opd.prescription_free_text`
- `opd.billing`
- `opd.invoice_receipt_pdf`

## RBAC Intent (High-Level Only)

High-level MVP roles (exact permissions to be defined later):

- `opd-operator`
- `opd-doctor`
- `opd-finance`

Permission matrix and command authorization rules will be added in the OPD OpenAPI + implementation prompts. Command-only workflow governance remains mandatory.

## Governance Alignment

- Contract-first remains mandatory: OpenAPI is canonical and will be extended in a later prompt.
- SDK-only remains mandatory for Next.js apps (no ad-hoc fetch/axios payloads).
- Tenant isolation remains structural: `tenantId`, tenant-scoped uniques, tenant-filtered queries.
- Workflow states are command-only (no direct CRUD status edits).
- Deterministic documents remain mandatory for OPD invoice/receipt PDFs (`payloadHash` / `pdfHash`, idempotent publish).
- Admin app may edit OPD configuration/reference data only, and must not mutate OPD workflow statuses directly.

## Route Namespace Lock

- Operator UI OPD routes will live under `/opd/*`
- Admin UI OPD routes will live under `/opd/*` (with admin app `basePath` preserved as `/admin`)
- Future OPD API endpoints will live under `/api/opd/*`

## Related Documents

- `docs/specs/LOCKED_DECISIONS.md`
- `AGENTS.md`
- `docs/_opd_mvp/DECISIONS_LOCKED.md`
- `docs/_opd_mvp/OPENAPI_MAP.md`
- `docs/_opd_mvp/DATA_MODEL.md`
- `docs/_opd_mvp/WORKFLOW_STATE_MACHINES.md`
- `docs/_opd_mvp/TEST_PLAN.md`
- `docs/_opd_mvp/IMPLEMENTATION_REPORT.md`
