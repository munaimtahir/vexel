# OPD MVP OpenAPI Map

## Scope

Prompt 2 contract mapping for OPD MVP under the reserved OPD API namespace.

Note: `packages/contracts/openapi.yaml` uses `servers: [{ url: /api }]`, so OpenAPI paths are declared as `/opd/*` and resolve at runtime to `/api/opd/*`.

## Guardrails (Enforced in Contract Shape)

- Contract-first: `packages/contracts/openapi.yaml` is canonical.
- SDK-only frontend consumption: no frontend transport changes in this slice.
- Tenant isolation: tenant-owned OPD entities include `tenantId`; list/read endpoints are tenant-scoped (server resolved).
- Workflow state changes: appointment, visit, and invoice transitions are command endpoints only (`:action`) with `409 Conflict` for invalid transitions/invariants.
- Admin config-only: provider and schedule endpoints are config CRUD; no OPD workflow status mutation via admin config routes.
- Deterministic docs: no new OPD document endpoints added here; existing `/documents/*` pipeline remains canonical for future OPD invoice/receipt generation.
- No LIMS breakage: additive-only contract extension.

## Endpoint Inventory

### Providers (Admin Config)

- `GET /opd/providers` — list providers (filters: `page`, `limit`, `isActive`, `search`)
- `POST /opd/providers` — create provider (config)
- `GET /opd/providers/{providerId}` — provider detail
- `PATCH /opd/providers/{providerId}` — update provider config (no workflow mutation)

### Provider Schedules (Admin Config)

- `GET /opd/providers/{providerId}/schedules` — list schedules (`isActive`)
- `POST /opd/providers/{providerId}/schedules` — create schedule
- `PATCH /opd/providers/{providerId}/schedules/{scheduleId}` — update schedule
- `DELETE /opd/providers/{providerId}/schedules/{scheduleId}` — delete schedule (`409` if booked-appointment invariant blocks delete)

### Availability (Read)

- `GET /opd/providers/{providerId}/availability` — derived availability (filters: `fromDate`, `toDate`, `includeBooked`)

### Appointments (List + Commands)

- `GET /opd/appointments` — list appointments (filters: `page`, `limit`, `providerId`, `patientId`, `visitId`, `status`, `scheduledFrom`, `scheduledTo`, `search`)
- `POST /opd/appointments` — create appointment (`BOOKED`)
- `GET /opd/appointments/{appointmentId}` — appointment detail
- `POST /opd/appointments/{appointmentId}:reschedule:` — audited command
- `POST /opd/appointments/{appointmentId}:check-in:` — `BOOKED -> CHECKED_IN` (audited command)
- `POST /opd/appointments/{appointmentId}:start-consultation:` — `CHECKED_IN -> IN_CONSULTATION` (audited command)
- `POST /opd/appointments/{appointmentId}:complete:` — `IN_CONSULTATION -> COMPLETED` (audited command)
- `POST /opd/appointments/{appointmentId}:cancel:` — transition to `CANCELLED` (audited command)
- `POST /opd/appointments/{appointmentId}:mark-no-show:` — `BOOKED -> NO_SHOW` (audited command)

### Visits (Reads + Commands)

- `GET /opd/visits` — list visits (filters: `page`, `limit`, `providerId`, `patientId`, `appointmentId`, `status`, `createdFrom`, `createdTo`, `search`)
- `POST /opd/visits` — create visit (`REGISTERED`)
- `GET /opd/visits/{visitId}` — visit detail
- `POST /opd/visits/{visitId}:mark-waiting:` — `REGISTERED -> WAITING` (audited command)
- `POST /opd/visits/{visitId}:start-consultation:` — `WAITING -> IN_CONSULTATION` (audited command)
- `POST /opd/visits/{visitId}:complete:` — `IN_CONSULTATION -> COMPLETED` (audited command)
- `POST /opd/visits/{visitId}:cancel:` — transition to `CANCELLED` (audited command)

### Billing (Reads + Commands)

- `GET /opd/billing/invoices` — list invoices (filters: `page`, `limit`, `patientId`, `visitId`, `appointmentId`, `status`, `createdFrom`, `createdTo`, `search`)
- `POST /opd/billing/invoices` — create invoice (`DRAFT`)
- `GET /opd/billing/invoices/{invoiceId}` — invoice detail
- `GET /opd/billing/invoices/{invoiceId}/payments` — list invoice payments
- `POST /opd/billing/invoices/{invoiceId}:issue:` — `DRAFT -> ISSUED` (audited command)
- `POST /opd/billing/invoices/{invoiceId}:void:` — transition to `VOID` (audited command)
- `POST /opd/billing/invoices/{invoiceId}:record-payment:` — audited payment command; applies invoice transitions (`ISSUED/PARTIALLY_PAID -> PARTIALLY_PAID/PAID`) with `409` on invalid transition/invariant (including overpayment)

## Schemas Added (`components.schemas`)

### Provider / Scheduling

- `OpdProvider`
- `OpdProviderCreateRequest`
- `OpdProviderUpdateRequest`
- `OpdProviderSchedule`
- `OpdProviderScheduleCreateRequest`
- `OpdProviderScheduleUpdateRequest`
- `OpdAvailabilitySlot`
- `OpdProviderAvailability`

### Appointments

- `OpdAppointment`
- `OpdAppointmentCreateRequest`
- `OpdAppointmentRescheduleRequest`
- `OpdAppointmentCancelRequest`
- `OpdAppointmentListResponse`

### Visits

- `OpdVisit`
- `OpdVisitCreateRequest`
- `OpdVisitCancelRequest`
- `OpdVisitListResponse`

### Billing

- `OpdInvoiceLine`
- `OpdInvoicePayment`
- `OpdInvoice`
- `OpdInvoiceCreateRequest`
- `OpdInvoiceIssueRequest`
- `OpdInvoiceVoidRequest`
- `OpdInvoiceRecordPaymentRequest`
- `OpdInvoiceListResponse`
- `OpdInvoicePaymentListResponse`
- `OpdInvoicePaymentCommandResponse`

## Response / Error Conventions

- Command endpoints return updated entity (or invoice+payment composite for payment command).
- Invalid workflow transitions or billing invariants return `409` with the shared `Error` schema.
- `401/403/404` reuse existing shared contract responses.

## Deliberate Non-Changes

- No OPD-specific document generation endpoints were added in this slice.
- No OPD document enum values were added to `Document.type` or `/documents?docType` yet (future slice can add them only when OPD invoice/receipt document generation is contracted).
- No LIMS endpoints/schemas were modified.
