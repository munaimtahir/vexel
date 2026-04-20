# Worklist Cards — Result Entry + Verification

## Scope

This feature replaces table/list views for LIMS worklists with card-based boards for:

- `/lims/results` (Result Entry Board)
- `/lims/verification` (Verification Board)

It keeps command-only workflow transitions and SDK-only data access.

## Architecture Compliance

- **SDK-only**: Operator board pages use `getApiClient` from `@vexel/sdk` generated client. No raw `fetch`/`axios`.
- **Command-only transitions**:
  - Result board "Mark Ready for Verification" calls:
    - `POST /results/tests/{orderedTestId}:submit` for each pending test in the encounter.
  - Verification board actions call:
    - `POST /verification/encounters/{encounterId}:verify`
    - `POST /verification/encounters/{encounterId}:return-for-correction` (new command)
- **No local status mutation**: UI updates only after command responses + reload.
- **Auditability**: backend command handlers write audit events.

## Board Design

### Result Entry Board (`/lims/results`)

Columns:

- Pending
- In Progress
- Ready for Verification

State mapping logic (UI only):

- Encounter card is **Ready** when all tests are completed/submitted.
- Encounter card is **In Progress** when at least one test has partial/complete entered values.
- Else **Pending**.

Card shows:

- Patient name, age/gender, MR, slip/encounter code, timestamp
- Test chips with statuses: `pending`, `in-progress`, `completed`, `verified`
- Counts: total/completed/pending tests

Actions:

- Open Result Entry
- Save/Continue Draft (UI-only draft marker)
- Mark Ready for Verification (command endpoint)

### Verification Board (`/lims/verification`)

Columns:

- Waiting
- Flagged / Needs Review
- Verified

Card status mapping:

- `VERIFIED` tests -> verified chips
- Any abnormal flag (`high|low|critical`) -> flagged column
- Otherwise waiting

Actions:

- Open Verification
- View Flagged Results
- Verify (command endpoint)
- Verify + Generate (same verify command; generation is auto-triggered server-side)
- Return for Correction (new command endpoint)

## New Reusable Component

`apps/operator/src/components/app/workflow-encounter-card.tsx`

Reusable card with:

- fixed minimum height for uniform visual rhythm
- patient/header metadata
- test chips + status color coding
- count tiles
- footer action buttons

Exported from `components/app/index.ts`.

## Filters & Sticky Bar

Both boards provide sticky top filter controls:

- search (`name/MR/mobile` input propagated to queue queries)
- test type filter
- department filter placeholder (ready for enriched backend data)

## Backend Contract Update

Added command endpoint:

- `POST /verification/encounters/{encounterId}:return-for-correction`

Behavior:

- moves submitted, unverified tests back to `PENDING`
- resets `submittedAt/submittedBy`
- sets encounter status to `specimen_received`
- writes audit event `ENCOUNTER_RETURNED_FOR_CORRECTION`
- returns `409` when no submitted tests exist

OpenAPI updated accordingly.

## Notes

- Legacy redirect routes (`/results`, `/verification`) remain and still point to `/lims/*`.
- Detailed result entry and encounter verification pages remain intact for deep workflow execution.
