# Auth, RBAC, and Session Audit

Primary evidence:
- Auth service implementation: `logs/phase10_auth_service.ts`
- Operator login JWT payload: `runtime-responses/auth_login_operator.payload.json`
- Shared-email login ambiguity payload: `runtime-responses/auth_login_shared.payload.json`
- User creation responses (system + tenant B): `runtime-responses/userb_create.json`, `runtime-responses/userb2_create.json`
- API `/me` response evidence: `runtime-responses/me_admin.json`

## Static findings

### Access tokens
- JWT payload includes: `sub` (userId), `email`, `tenantId`, `roles`, `permissions`, `isSuperAdmin`. (Evidence: `logs/phase10_auth_service.ts`)
- `expiresIn: 1h` for access tokens. (Evidence: `logs/phase10_auth_service.ts`)

### Refresh tokens
- Refresh tokens are stored in DB as bcrypt hashes (model `RefreshToken.token`).
- On refresh, the matched refresh token is revoked and a new refresh token is created (rotation on use).
(Evidence: `logs/phase10_auth_service.ts`, schema excerpt in Phase 8 evidence.)

### Logout
- Logout revokes all refresh tokens for the user.
- Audit log for logout currently hardcodes `tenantId: 'system'` (potential tenancy correctness issue for non-system tenants).
(Evidence: `logs/phase10_auth_service.ts`)

### RBAC
- Permissions are derived from role permissions plus a fixed set of self-service permissions.
- Super-admin is represented via `isSuperAdmin` and used in some controller logic.
(Evidence: `logs/phase10_auth_service.ts`, controller snapshots in Phase 9.)

## Runtime findings (this run)

### Operator token contents (example)
Operator demo user JWT payload includes expected role/permission set:
- roles: `operator`
- permissions include `patient.manage`, `encounter.manage`, `result.enter`, `document.generate`.
(Evidence: `runtime-responses/auth_login_operator.payload.json`)

### Critical: tenant-ambiguous login
Schema allows duplicate emails across tenants (`@@unique([tenantId,email])`), but `AuthService.login()` is not tenant-scoped:
- query is `user.findFirst({ where: { email, status:'active' } })`

Runtime proof:
- After creating `shared@example.com` in two different tenants, login produces a token for the system-tenant user (tenantId `system`), making the tenant B account effectively unreachable when emails collide.
(Evidence: `logs/phase10_auth_service.ts`, `runtime-responses/auth_login_shared.payload.json`, user create responses.)

## Auth/RBAC verdict (this run)

**AUTH PARTIAL**

Rationale:
- PASS: JWT issuance, permission embedding, refresh rotation-on-use behavior are implemented.
- FAIL (multi-tenant readiness): login is not tenant-aware when emails are duplicated across tenants; logout audit tenantId appears hardcoded.

