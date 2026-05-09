# 11_LIMS_WORKFLOW_COMMAND_AUDIT.md

Status: IN PROGRESS (static command surface identified; runtime transition tests pending)

## Encounter-Centric Command Endpoints (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/120_apps_api_src_encounters_encounters.controller.ts.txt`

Observed (controller base `encounters`, global API prefix applies):
- `GET /api/encounters` (list)
- `POST /api/encounters` (register)
- `GET /api/encounters/{id}` (read)
- Command endpoints:
  - `POST /api/encounters/{id}:order-lab`
  - `POST /api/encounters/{id}:collect-specimen`
  - `POST /api/encounters/{id}:receive-specimen`
  - `POST /api/encounters/{id}:result`
  - `POST /api/encounters/{id}:verify`
  - `POST /api/encounters/{id}:publish-report`
  - `POST /api/encounters/{id}:cancel`
  - `POST /api/encounters/{id}:collect-due`
  - `POST /api/encounters/{id}:apply-discount`

Notes:
- These are command-shaped endpoints (verb via `:{command}`), aligning with “state changes via commands only”.

## Invalid Transition Handling (409)

Status: VERIFIED (partial)

Evidence:
- Publish-before-verify returns 409: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/31_verifier_publish_before_verify.txt`
- Publish-before-render returns 409: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/33_verifier_publish.txt`

Not verified:
- Other invalid transitions (e.g., receive before collect) were not exercised in this pass.

## Audit Events + CorrelationId Propagation

Status: VERIFIED (runtime)

Evidence (signals only; full trace pending):
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/75_audit_correlation_signals.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/120_apps_api_src_encounters_encounters.controller.ts.txt` (uses `CORRELATION_ID_HEADER`)

Runtime evidence:
- Audit events created for commands with correlationIds matching runtime calls: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/37_audit_events_list_admin.txt`
