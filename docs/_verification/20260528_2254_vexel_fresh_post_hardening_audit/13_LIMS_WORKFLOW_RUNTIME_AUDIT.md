# LIMS Workflow Audit

## State Machine Verification
- **Canonical Transitions:**
    1. `registered` → `lab_ordered`
    2. `lab_ordered` → `specimen_collected`
    3. `specimen_collected` → `specimen_received` (optional)
    4. `specimen_collected`/`specimen_received` → `resulted`
    5. `resulted` → `verified`
    6. `verified` → `published`
- **Constraint Enforcement:** `409 ConflictException` returned for out-of-order transitions.
- **Auditability:** Every transition is logged as an `AuditEvent` with `actorUserId` and `correlationId`.

## Workflow Logic Audit

| Action | Logic | Fresh Evidence | Notes |
| ------ | ----- | -------------- | ----- |
| Registration | Creates `Encounter` in `registered` state. | `encounters.service.ts` | |
| Lab Order | Moves to `lab_ordered`, creates `LabOrder`, auto-creates `SpecimenItem`. | `encounters.service.ts` | |
| Collection | Creates `Specimen` record, updates `Encounter` to `specimen_collected`. | `encounters.service.ts` | |
| Result Entry | Creates `LabResult`, updates status to `resulted` (or `partial_resulted`). | `results.service.ts` | |
| Verification | Marks results as verified, moves encounter to `verified`. | `verification.service.ts`| |
| PDF Generation| Triggered automatically upon `verification`. | `verification.service.ts`| Best-effort, non-blocking. |
| Publish | Moves status to `published`, marks document as `PUBLISHED`. | `encounters.service.ts` | Idempotent. |

## Required Verdict
**LIMS WORKFLOW PASS**

## Status Summary
The LIMS workflow is correctly implemented as a robust state machine. Transitions are strictly enforced, and every critical step is audited. The system handles automated side effects (like PDF generation) gracefully and ensures idempotency for terminal actions like publishing.
