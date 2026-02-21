# LIMS Workflows (Command-only)

## Rule (locked)
All workflow state changes happen via **Command endpoints**.
CRUD endpoints are only for reference data (catalog, config).

## Core encounter workflow (LIMS)
1) Patient registration (core)
2) Create Encounter (core)
3) Create Lab Order (LIMS)
4) Sample collected/received (LIMS)
5) Results entered (draft) (LIMS)
6) Verification (LIMS)
7) Publish report (LIMS) -> deterministic Document pipeline

## Command examples (names are illustrative)
- POST /encounters/{id}:start-prep
- POST /encounters/{id}:lab-order
- POST /encounters/{id}:lab-collect-sample
- POST /encounters/{id}:lab-receive-sample
- POST /encounters/{id}:lab-enter-results
- POST /encounters/{id}:lab-verify
- POST /encounters/{id}:lab-publish

## State machine rule
- Transitions are validated.
- Invalid transitions return 409 Conflict.
- Every command writes an AuditEvent.
