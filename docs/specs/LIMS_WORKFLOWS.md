# LIMS Workflows (Command-only)

## Rule (locked)
All workflow state changes happen via **Command endpoints**.
CRUD endpoints are only for reference data (catalog, config).

## Core encounter workflow (LIMS)
1) Patient registration (core)
2) Create Encounter (core)
3) Create Lab Order (LIMS)
4) Sample collected/received/rejected **per ordered test** (LIMS)
5) Results entered and submitted **per ordered test** (LIMS)
6) Verification or return-for-correction **per ordered test** (LIMS)
7) Verification automatically generates and publishes a deterministic report for
   all currently verified tests. A report is labelled `PARTIAL` while any
   non-cancelled test remains unverified.
8) Printing is a separate operator action. It defaults to all verified tests;
   a test configured as `Single Page` always starts and ends on its own page.

## Command examples (names are illustrative)
- POST /encounters/{id}:start-prep
- POST /encounters/{id}:lab-order
- POST /ordered-tests/{id}:collect-sample
- POST /ordered-tests/{id}:receive-sample
- POST /ordered-tests/{id}:reject-sample
- POST /ordered-tests/{id}:submit-results
- POST /ordered-tests/{id}:verify
- POST /ordered-tests/{id}:return-for-correction
- POST /encounters/{id}:print-report

## State machine rule
- Transitions are validated.
- Invalid transitions return 409 Conflict.
- Every command writes an AuditEvent.
- The command mutation and its AuditEvent are committed atomically.
- Encounter status is a derived summary of its ordered tests. Cancelled tests do
  not prevent completion; an encounter is complete only when every remaining
  test is verified.
- A report-rendering failure does not undo verification. The document becomes
  `FAILED` and an authorized, audited retry is available.
