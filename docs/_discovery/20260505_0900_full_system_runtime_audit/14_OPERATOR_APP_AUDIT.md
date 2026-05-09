# 14_OPERATOR_APP_AUDIT.md

Status: IN PROGRESS (static route discovery complete; runtime workflow verification pending)

## Route Group Governance (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/141_operator_routes_tree.txt`

Observed:
- Protected pages exist under `apps/operator/src/app/(protected)/*` with group `layout.tsx`.
- A login page exists outside any route group: `apps/operator/src/app/login/page.tsx`.

Assessment (static): FAIL vs governance rule “every page must be under explicit route group” (missing `(public)` group for unauth pages).

## LIMS Namespacing (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/141_operator_routes_tree.txt`

Observed:
- LIMS namespaced routes exist under `/(protected)/lims/*` (expected).
- Non-namespaced duplicates also exist (e.g., `/(protected)/worklist`, `/(protected)/encounters`, `/(protected)/results`, `/(protected)/verification`, `/(protected)/sample-collection`, `/(protected)/registrations`). Presence of these routes indicates the “/lims/* only” constraint is not strictly enforced in current filesystem routes.

Assessment (static): PARTIAL/FAIL vs governance rule “all LIMS routes must be under /lims/*”.

## Operator Workflow Coverage (Static Presence)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/141_operator_routes_tree.txt`

Observed routes (presence only; not runtime-verified):
- Registration: `/(protected)/lims/registrations/new`
- Worklist: `/(protected)/lims/worklist`
- Encounter detail: `/(protected)/lims/encounters/[id]`
- Sample collection: `/(protected)/lims/sample-collection`
- Results: `/(protected)/lims/results` and `/(protected)/lims/results/[orderedTestId]`
- Verification: `/(protected)/lims/verification` and `/(protected)/lims/verification/encounters/[encounterId]`
- Reports: `/(protected)/lims/reports`

Pending:
- Verify each route uses command endpoints (not CRUD mutation), respects RBAC, and handles loading/error/empty states (requires runtime + network capture).
