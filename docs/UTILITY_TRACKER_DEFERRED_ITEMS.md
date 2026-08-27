# Utility Tracker Deferred Items

## 2026-08-27 — canonical scheduling boundary

**Question:** Should scheduling remain in the final OPD canonical model, or should this release be walk-in-only?

**Options:** complete scheduling with atomic reservations and full lifecycle proof; or remove incomplete scheduling paths and document walk-in-only scope.

**Recommendation:** make the decision during canonical discovery before contract/migration cutover. Leaving both partial paths active is prohibited.

**Impact:** this is a release-scope decision affecting OpenAPI, Prisma retirement/reconciliation, Admin/Operator routes, tests, and migration evidence. Until resolved, release status remains `NOT READY`.
