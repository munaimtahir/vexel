# LIMS Workflow Command Audit (Static + Runtime)

Primary evidence (runtime):
- Patient create: `runtime-responses/truthmap/patient_create.json` + headers
- Encounter create: `runtime-responses/truthmap/encounter_create.json`
- Order lab: `runtime-responses/truthmap/encounter_orderlab.json`
- Collect specimen: `runtime-responses/truthmap/specimen_collect.json`
- Receive specimen: `runtime-responses/truthmap/specimen_receive.json`
- Legacy enterResult: `runtime-responses/truthmap/result_enter.json`
- Verify attempt before submission (expected 409): `runtime-responses/truthmap/encounter_verify.json`
- Ordered test detail (results system): `runtime-responses/truthmap/orderedtest_get2.json`
- Save values: `runtime-responses/truthmap/result_save.json`
- Submit results: `runtime-responses/truthmap/result_submit.json`
- Verify success: `runtime-responses/truthmap/encounter_verify2.json`
- Audit events for verify pipeline: `runtime-responses/truthmap/audit_events_verify.json`

Primary evidence (contract):
- OpenAPI encounter commands and results commands: `contracts/openapi/openapi.yaml`

## Runtime workflow proof (this run)

### Happy-path (verified)
1. Create patient (`POST /patients`) -> 201
2. Create encounter (`POST /encounters`) -> 201
3. Order lab (`POST /encounters/{id}:order-lab`) -> 200, encounter status `lab_ordered`, encounterCode assigned
4. Collect specimen (`POST /encounters/{id}:collect-specimen`) -> 200, status `specimen_collected`
5. Receive specimen (`POST /encounters/{id}:receive-specimen`) -> 200, status `specimen_received`
6. Results entry (current system behavior):
   - Legacy path `POST /encounters/{id}:result` succeeded and moved encounter to `resulted`
   - However, verification correctly refused until results were formally submitted via Results commands.
7. Save and submit results:
   - `GET /results/tests/{orderedTestId}` works where `orderedTestId == labOrderId`
   - `POST /results/tests/{orderedTestId}:save` -> 200
   - `POST /results/tests/{orderedTestId}:submit` -> 200, `resultStatus: SUBMITTED`
8. Verify encounter:
   - Before submission: `POST /verification/encounters/{id}:verify` -> `409 Conflict` with message “No submitted tests to verify”
   - After submission: same endpoint -> 200 with `status: verified` and a `documentJobId`

Evidence paths are listed above (see runtime files under `runtime-responses/truthmap/`).

### Invalid transition behavior (verified)
- Verification before submission returned `409 Conflict` with a clear message.
(Evidence: `runtime-responses/truthmap/encounter_verify.json`)

### Auditability of commands (verified)
Audit-event lookup by correlationId for verification shows:
- `ENCOUNTER_VERIFIED`
- `document.generate`
- document render/publish actions (auto pipeline)
(Evidence: `runtime-responses/truthmap/audit_events_verify.json`)

## Workflow verdict (this run)

**WORKFLOW PASS (system tenant, LIMS happy-path)**

Important notes:
- There is a legacy `POST /encounters/{id}:result` flow that can set encounter/labOrder to `resulted` but does not satisfy verification preconditions until the newer submit command is used. This is not necessarily wrong, but it is a workflow complexity and needs governance review (Phase 7B/24).

