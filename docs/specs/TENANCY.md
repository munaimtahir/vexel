# Tenancy Model (Target)

## Tenant resolution (locked)
- Production: resolve tenant by request **Host** (domain mapping).
- DEV: allow `x-tenant-id` only when `TENANCY_DEV_HEADER_ENABLED=true`.

## DB rules (locked)
- Every customer-owned entity has `tenantId`.
- Every uniqueness rule is tenant-scoped (no global uniques unless truly global).
- Every query must include tenant filter by default.

## Admin safety (locked)
- Admin app is tenant-aware.
- Super-admin “global view” (all tenants) is allowed only with explicit permission and audit logging.

## Evidence/audit
- Every request + job has a `correlationId`.
- Audit events store: tenantId, actorUserId, action, entityRef, before/after (where relevant).
