# 10_AUTH_RBAC_AUDIT.md

Status: IN PROGRESS (static review complete; runtime token tests pending)

## Auth Architecture (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_auth.service.ts.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_jwt.strategy.ts.txt`

Findings:
- Access token expiry: `1h` (JWT `expiresIn: '1h'`). (PASS vs baseline)
- Refresh token TTL: `7 days` (`REFRESH_TOKEN_TTL_DAYS = 7`). (PASS vs baseline)
- Refresh token persistence: stored in DB (`prisma.refreshToken.create`). (PASS)
- Refresh token storage: hashed (bcrypt) in DB (`token: refreshTokenHash`). (PASS)
- Refresh token rotation: on refresh, matched token is revoked (`revokedAt = now`) and a new token is created. (PASS)
- Logout revokes refresh tokens: `updateMany` sets `revokedAt` for all active tokens for the user. (PASS)

## Permissions “Loaded Live From DB”

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_jwt.strategy.ts.txt`

Observed:
- `JwtStrategy.validate()` loads `userRole` → `rolePermissions` from DB on every request and derives permissions dynamically. (PASS vs baseline)
- `isSuperAdmin` is loaded from DB and not trusted from JWT claim. (PASS vs baseline)

Potential issue (static):
- Returned `roles` in request context come from JWT payload (`roles: payload.roles`) even though userRoles are loaded from DB; if role names change, the `roles` array could be stale (permissions remain live). (Risk: Low/Medium depending on usage.)

## Audit Events for Auth

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_auth.service.ts.txt`

Observed:
- `auth.login` is audited with tenantId = user.tenantId.
- `auth.token_refresh` is audited with tenantId = user.tenantId.
- `auth.logout` audit currently logs `tenantId: 'system'` (not user.tenantId). This may reduce tenant-scoped audit traceability. (Risk: Medium; verify intent.)

## Security Notes (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_jwt.strategy.ts.txt`

Observed:
- JWT secret fallback default: `process.env.JWT_SECRET ?? 'vexel-dev-secret-change-in-production'`. This is safe only if production always sets `JWT_SECRET` and config prevents startup with defaults. (Risk: High until verified via env/compose.)

## Runtime Verification (Planned)

Status: NOT VERIFIED (requires stack boot)

Planned runtime checks:
- Login → access protected endpoint.
- Refresh token rotation: reuse old refresh token should fail.
- Logout → refresh should fail.
- Permission enforcement: restricted endpoint returns 403 without permission.
