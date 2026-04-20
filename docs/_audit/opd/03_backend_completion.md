# OPD Backend Completion

## Completed API work
- OPD commands implemented/refined for locked workflow:
  - create registration
  - record intake
  - publish prescription
  - finalize encounter
  - cancel encounter
  - generate encounter receipt
- Added encounter-level document read/download APIs for:
  - prescription metadata + file
  - receipt metadata + file

## Governance checks in code
- Command endpoints enforce workflow transitions; invalid transitions return `ConflictException` (`409`).
- Command actions emit audit events with correlationId plumbing from controller headers.
- All OPD service calls remain tenant-filtered (`tenantId` in where clauses).

## Doctor profile backend
- Doctor CRUD now supports full print-identity fields used by OPD prescription rendering payload.

## Remaining backend caveats
- Legacy OPD provider/appointments/visits stack still exists for backward scaffold compatibility and should be treated as parallel legacy surfaces.
