# OPD Current Truth (pre-slice + in-repo state)

## Already usable
- KMVP OPD API scaffolding exists in `apps/api/src/opd/*` for doctors, encounters, intake/publish commands.
- Tenant-aware OPD data models exist (`OpdDoctor`, `OpdEncounter`, `OpdVital`, `OpdNote`, `OpdEncounterPrescription`).
- Operator OPD route namespace exists under `/opd/*`.
- Admin OPD area exists (`/opd`, doctors/providers/schedules/feature-flags pages).
- Deterministic document pipeline exists and supports OPD document types through `DocumentsService.generateDocument(...)`.

## Partial but reusable
- OPD workflow/state in KMVP existed but needed hard lock to command-driven MVP states.
- Doctor master existed but lacked full print-identity form surfacing in Admin.
- OpenAPI had broad OPD coverage but needed explicit command/read receipt routes and stricter MVP alignment.
- Feature flags existed with mixed old/new keys and required alignment.

## Dead/duplicate/drifted
- Parallel legacy OPD stack still exists (providers/appointments/visits flow) alongside KMVP encounters.
- Legacy OPD worklist and legacy statuses remain in some operator pages as historical/scaffold surfaces.

## Missing (before this slice completion)
- Locked OPD MVP spec/workflow docs.
- Full OPD audit trail documentation set.
- Explicit receipt retrieval endpoints in contract for encounter-based OPD receipt downloads.
- End-to-end runtime verification evidence document set for OPD slice.
