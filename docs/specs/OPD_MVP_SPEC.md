# OPD MVP Spec (Locked Slice)

## Actors
- Operator: runs OPD workflow (registration/intake/doctor/prescription/receipt commands).
- Doctor (through operator UI step): records clinical/prescription content.
- Admin: config/reference only (doctor profile management, flags, observability).

## MVP workflow
1. Select/create patient.
2. Create OPD registration command -> creates OPD encounter + invoice basis.
3. Record intake command (chief complaint + vitals) while `DRAFT`.
4. Record/publish prescription command while `READY_FOR_PRINT`.
5. Generate OPD receipt command (deterministic document).
6. Retrieve/download prescription/receipt from encounter document endpoints.
7. Observe encounter in OPD encounters worklist/history.

## Entities
- `OpdEncounter` (tenant, patient, doctor, status, summary fields).
- `OpdDoctor` (admin-managed profile + print identity fields).
- `OpdVital`, `OpdNote`, `OpdEncounterPrescription`, `OpdPrescriptionItemKmvp`.
- `Invoice`/`Payment` reuse for fee/payment basis.
- `Document` for OPD prescription/receipt outputs.

## Commands (command-only state changes)
- `POST /opd/commands/createRegistration`
- `POST /opd/commands/recordIntake`
- `POST /opd/commands/publishPrescription`
- `POST /opd/commands/finalizeEncounter`
- `POST /opd/commands/cancelEncounter`
- `POST /opd/commands/generateReceipt`

## Validation rules
- Required IDs per command.
- Intake requires chief complaint + at least one meaningful vital.
- Publish requires clinical fields + at least one prescription item.
- Invalid transitions return `409`.
- Cancel requires explicit reason.

## Statuses
- `DRAFT`
- `READY_FOR_PRINT`
- `COMPLETED`
- `CANCELLED`

## Permissions
- Workflow commands/reads: `encounter.manage`, `document.generate`.
- Admin doctor config: `module.admin`.
- All requests remain tenant-scoped and auditable.

## Print/document outputs
- OPD prescription (Consultants Place style, doctor-driven identity).
- OPD consultation receipt (deterministic receipt payload).
- Deterministic identity preserved using template version + payload hash.

## Non-goals
- No pharmacy/stock/dispensing.
- No admission/inpatient flow.
- No admin workflow mutation shortcuts.
- No direct status CRUD edits outside commands.
