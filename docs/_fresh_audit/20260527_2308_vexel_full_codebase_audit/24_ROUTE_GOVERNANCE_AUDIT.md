# Route Governance Audit (Admin + Operator)

Primary evidence:
- Admin pages list: `logs/phase7b_admin_pages.txt`
- Operator pages list: `logs/phase7b_operator_pages.txt`
- Operator legacy route redirects: `logs/phase21_operator_route_duplicates_snippets.txt`

## Operator module namespacing

Verified:
- Primary LIMS routes exist under `/lims/*`.
- Legacy non-namespaced routes exist (e.g., `/worklist`, `/results`, etc.) but are implemented as client redirects to `/lims/*`.
(Evidence: `logs/phase7b_operator_pages.txt`, `logs/phase21_operator_route_duplicates_snippets.txt`)

Risk/Follow-up:
- Operator also contains OPD routes under `/opd/*` (present in route inventory). OPD is out of LIMS MVP for this audit unless explicitly required; truthmap will classify contract mismatches found in OPD pages.

## Route groups (AGENTS baseline)

The governance baseline requires route groups `(public)` and `(protected)` for Next.js pages.

Observed:
- Many pages live under `(protected)` in both admin and operator.
- Login routes currently appear as `apps/*/src/app/login/page.tsx` (not under `(public)`), which is a governance mismatch relative to the stated baseline.
(Evidence: `logs/phase7b_admin_pages.txt`, `logs/phase7b_operator_pages.txt`)

## Verdict (this run)

**ROUTE GOVERNANCE PARTIAL**

Rationale:
- PASS: `/lims/*` namespacing is enforced in practice; legacy routes are redirects.
- FAIL/PARTIAL: login pages are not under `(public)` route group as required by governance doc.

