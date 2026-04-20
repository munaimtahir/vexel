# OPD Workflow (Command-Driven)

## State model
- `DRAFT`
- `READY_FOR_PRINT`
- `COMPLETED`
- `CANCELLED`

## Transition rules
- `createRegistration` -> creates encounter in `DRAFT`.
- `recordIntake` allowed only in `DRAFT`; transitions to `READY_FOR_PRINT`.
- `publishPrescription` allowed only in `READY_FOR_PRINT`; transitions to `COMPLETED`.
- `finalizeEncounter` allowed only in `READY_FOR_PRINT`; transitions to `COMPLETED`.
- `cancelEncounter` allowed only from `DRAFT` or `READY_FOR_PRINT`; transitions to `CANCELLED`.
- Any invalid transition -> `409 Conflict`.

## Governance constraints
- No direct CRUD endpoint may mutate workflow state.
- Commands must emit audit events with correlationId propagation.
- Completed/cancelled records are terminal for workflow-significant mutation.
- Admin UI must remain config/reference only (no workflow mutation).

## Audit actions (minimum)
- `opd.registration.created`
- `opd.intake.recorded`
- `opd.prescription.published`
- `opd.encounter.finalized`
- `opd.encounter.cancelled`
- `opd.receipt.generated`
- doctor profile config actions (`opd.doctor.created`, `opd.doctor.updated`)
