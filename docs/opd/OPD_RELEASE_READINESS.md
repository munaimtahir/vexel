# OPD Release Readiness

> **SUPERSESSION NOTICE:** LIMS/platform verdicts and earlier OPD slice records are historical only. They are not OPD production evidence.

**Decision: OPD NOT READY**

## Current verdict (2026-08-29)

The prior `OPD PRODUCTION READY` promotion was not supported by its own evidence set and is withdrawn. Static gates pass, and the canonical billing routing regression introduced during legacy retirement has been repaired and live-smoked. Mandatory production gates remain open.

Release blockers include:

- the retirement migration unconditionally drops legacy OPD tables and data without reconciliation, preflight counts, export, or rollback proof;
- real database concurrency/rollback evidence for scheduling, registration, notes, and payments is still missing;
- prescription version publication and deterministic amended-document evidence is still incomplete;
- OPD-specific tenant/RBAC/concurrency/document failure-retry tests are incomplete; PDF failure injection is now implemented but not yet exercised in a committed integration run;
- Operator/Admin production surfaces do not cover the release scope, and the OPD Playwright tests authenticate as the super-admin rather than a least-privilege OPD user;
- the deployment image audit reports 13 high and 1 critical dependency advisories;
- clean-database, representative-data migration, rollback, and complete browser journey evidence is absent; the local same-URL stack is healthy but public production cutover is not certified.

## Passing evidence boundary

- Prisma schema validation passed.
- OpenAPI SDK regeneration/freshness passed before this correction and is rerun as a final gate.
- API typecheck, production build, and 33 Jest suites passed after canonical billing consolidation.
- A rebuilt API returned `200` for health, tenant feature enablement, canonical registration, invoice creation, invoice listing, and invoice retrieval.
- Frontend source scan found no raw `fetch`, Axios, or Prisma import violations.

These results are necessary but insufficient under [`OPD_RELEASE_SCOPE.md`](../releases/OPD_RELEASE_SCOPE.md).

## Decision rule

The status may change to `OPD PRODUCTION READY` only after every mandatory row in the release ledger and requirements traceability matrix has current reproducible passing evidence, no Critical/High security issue remains, no P0/P1 defect remains, and the worktree is clean.
