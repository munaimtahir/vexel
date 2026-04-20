# OPD Operator UI Completion

## Implemented/updated OPD operator surfaces
- `/opd/encounters` list/worklist for KMVP encounters with locked statuses.
- `/opd/encounters/new` registration flow (patient + doctor + immediate billing basis).
- `/opd/encounters/[id]/intake` command-driven intake form (`DRAFT` only).
- `/opd/encounters/[id]/doctor` prescription publish flow (`READY_FOR_PRINT` gate).

## SDK-only compliance
- OPD pages call generated SDK client methods via `getApiClient`.
- No raw fetch/axios introduced in OPD changes.

## Workflow safety
- UI does not mutate status locally as source-of-truth; commands drive state changes.
- State gate messaging reflects locked workflow (`DRAFT`, `READY_FOR_PRINT`, etc.).
- Command failure handling surfaces actionable error messages.

## Notes
- Legacy `/opd/worklist` and legacy appointment/visit pages remain present as legacy/scaffold routes and are not the canonical MVP path.
