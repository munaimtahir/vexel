# Frontend-Backend Truthmap Audit

## Action Linkage Matrix (Operator UI)

| Action Group | Frontend Action | Backend Endpoint | Controller | Status |
| ------------ | --------------- | ---------------- | ---------- | ------ |
| Auth | Login | `POST /auth/login` | `AuthController` | VERIFIED |
| Patients | Search/Create | `GET /patients`, `POST /patients` | `PatientsController` | VERIFIED |
| LIMS Reg | Create Encounter | `POST /encounters` | `EncountersController` | VERIFIED |
| LIMS Order | Order Test | `POST /encounters/{id}:order-lab` | `EncountersController` | VERIFIED |
| LIMS Samples | Worklist | `GET /sample-collection/worklist` | `SampleCollectionController` | VERIFIED |
| LIMS Samples | Collect | `POST /encounters/{id}:collect-specimens` | `SampleCollectionController` | VERIFIED |
| LIMS Results | Pending List | `GET /results/tests/pending` | `ResultsController` | VERIFIED |
| LIMS Results | Save/Submit | `POST /results/tests/{id}:save` | `ResultsController` | VERIFIED |
| LIMS Verify | Queue | `GET /verification/encounters/pending` | `VerificationController` | VERIFIED |
| LIMS Verify | Verify | `POST /verification/encounters/{id}:verify` | `VerificationController` | VERIFIED |
| LIMS Publish | Publish | `POST /encounters/{id}:publish-report` | `EncountersController` | VERIFIED |
| Documents | Download PDF | `GET /documents/{id}/download` | `DocumentsController` | VERIFIED |

## Admin Safety Truthmap
- **Mandate:** Admin UI cannot directly mutate LIMS workflow state.
- **Verification:** `Admin UI` uses `/admin/catalog`, `/tenants`, `/users`, `/roles`, and `/ops` endpoints. It does **not** reference `/encounters/{id}:verify` or `/results/tests/{id}:save`.
- **Finding:** Admin UI has an `/encounters` page (`apps/admin/src/app/(protected)/encounters/page.tsx`), but it's used for listing/viewing, not mutation.

## Orphan Routes & Dead Endpoints
- **Deprecated:** `/encounters/{id}:verify` in `EncountersController` is deprecated in favor of `VerificationController`. Both exist for now.
- **Future:** `OPD` routes exist in both frontend and backend but are excluded from MVP gates.

## Required Verdict
**TRUTHMAP PASS**

## Status Summary
Complete linkage exists between frontend actions and backend endpoints for the core LIMS MVP workflow. Admin safety is preserved as Admin UI does not expose workflow mutation actions. Parity checks confirm that all endpoints used by the frontend are supported by the backend/OpenAPI contract.
