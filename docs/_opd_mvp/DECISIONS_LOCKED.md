# OPD MVP Decisions (Locked)

This file mirrors the OPD MVP governance lock for implementation tracking.
Authoritative scope and state-machine intent remain in `docs/specs/opd/OPD_MVP_SPEC.md`.

## OPD Module — MVP Scope (LOCKED)

### MVP Scope (In)
- Multi-doctor support
- Appointment booking
- Patient registration using shared core `Patient`
- Vitals capture
- Structured clinical notes
- Billing + payments (desk/cash flow)
- Free-text prescription only

### Deferred (Out of MVP)
- Payment gateway integration
- Patient portal
- Drug catalog / formulary
- Reminders (SMS / WhatsApp / email)
- Insurance / claims / payer workflows

### Governance Locks
- UI routes under `/opd/*` (operator/admin)
- OPD API namespace under `/api/opd/*` (OpenAPI paths `/opd/*` with `/api` server base)
- OPD workflow state changes via command endpoints only (`409` on invalid transitions)
- Deterministic documents required for OPD invoice/receipt PDFs (`payloadHash` / `pdfHash`, idempotent publish)
- Admin UI is config/reference only; no direct workflow status mutation
