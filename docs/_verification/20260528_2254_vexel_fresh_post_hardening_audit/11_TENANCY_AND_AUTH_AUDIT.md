# Tenancy and Auth Audit

## Authentication Design
- **Mechanism:** JWT Access Token + DB-persisted Refresh Token.
- **Tenant Awareness:** Login requires `tenantId`, and queries with `email + tenantId + status:active`.
- **Live Validation:** `JwtStrategy` re-validates user `status` and `isSuperAdmin` flag against the database on every request.
- **Refresh Token:** Rotates on use; stored in `httpOnly` cookie.
- **Logout:** Revokes all active refresh tokens for the user.

## Tenant Resolution Audit

| Method | Priority | Security Guard | Fresh Evidence |
| ------ | -------- | -------------- | -------------- |
| `Host`/`Domain` | 1 | Verified via `TenantService.findByDomain` | `tenant-resolver.middleware.ts` |
| `x-tenant-id` | 2 | Gated by `TENANCY_DEV_HEADER_ENABLED === 'true'` | `tenant-resolver.middleware.ts` |
| Authenticated User | 3 | `JwtAuthGuard` overrides header with user's JWT `tenantId` | `jwt-auth.guard.ts` |

## RBAC and Permissions
- **Mechanism:** `PermissionsGuard` + `RequirePermissions` decorator.
- **Granularity:** Permission-based (e.g., `result.enter`, `result.verify`).
- **Super-Admin:** `isSuperAdmin: true` bypasses permission checks (Live DB check).

## Security Findings
- **Tenant Leakage:** Prevented by `JwtAuthGuard` which rejects cross-tenant header overrides for authenticated requests.
- **Deactivation Latency:** Prevented by Live DB check in `JwtStrategy`.

## Required Verdict
**TENANCY & AUTH PASS**

## Status Summary
The authentication and tenancy systems are robustly implemented. Logins are tenant-scoped, and the system correctly resolves and enforces tenant isolation at both the middleware and guard layers. Live DB validation ensures that deactivations and permission changes take effect immediately.
