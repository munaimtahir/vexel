# Authentication Design (Vexel Health Platform)

## Strategy: JWT Access Token + DB-persisted Refresh Token

### Decision
We use **JWT access tokens** (short-lived, 1 hour) combined with **database-persisted refresh tokens** (7 days, rotated on every use).

This is preferred over JWT-only because:
- Refresh tokens can be individually revoked (e.g., on logout, suspicious activity, user disable)
- Rotation means a stolen refresh token becomes invalid after first use
- Audit events capture auth events (login, logout, refresh)

---

## Token Lifetimes

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access Token (JWT) | 1 hour | Client memory / Authorization header |
| Refresh Token (opaque UUID) | 7 days | DB: `refresh_tokens` table (hashed) |

---

## Flow

### Login
```
POST /api/auth/login
Body: { email, password }

→ Find user by email (status: active)
→ bcrypt.compare(password, passwordHash)
→ Sign JWT with { sub, email, tenantId, roles, isSuperAdmin }
→ Generate opaque UUID refresh token
→ Store bcrypt(refreshToken) in refresh_tokens table with expiresAt
→ Return { accessToken, refreshToken, expiresIn: 3600 }
```

### Authenticated Requests
```
GET /api/users
Authorization: Bearer <accessToken>

→ JwtStrategy validates JWT signature + expiry
→ Loads live permissions from DB (userRoles → rolePermissions)
→ Injects user context into request
→ PermissionsGuard checks required permissions
```

### Token Refresh
```
POST /api/auth/refresh
Body: { refreshToken }

→ Find unexpired, non-revoked refresh tokens in DB
→ bcrypt.compare(incoming, stored hash) for each — O(n) across active tokens
→ On match: revoke old token (revokedAt = now)
→ Issue new accessToken + refreshToken
→ Return { accessToken, refreshToken, expiresIn: 3600 }
```

### Logout
```
POST /api/auth/logout
Authorization: Bearer <accessToken>

→ Revoke ALL refresh tokens for the user (revokedAt = now)
→ Write audit event: auth.logout
→ Return 204 No Content
```

---

## Security Properties

| Property | How Enforced |
|----------|-------------|
| Refresh token confidentiality | Stored as bcrypt hash in DB; raw token only returned once |
| Refresh token rotation | Each use revokes old + issues new |
| Revocation on logout | All refresh tokens revoked |
| Revocation on user disable | Existing tokens still valid until expiry (TODO: active revocation on disable) |
| Privilege changes take effect | Permissions loaded live from DB on every request (not cached in JWT) |
| Audit trail | Login, logout, refresh events logged to AuditEvent table |

---

## JWT Payload (Access Token)

```json
{
  "sub": "<userId>",
  "email": "user@tenant.com",
  "tenantId": "<tenantId>",
  "roles": ["admin"],
  "isSuperAdmin": false,
  "iat": 1234567890,
  "exp": 1234571490
}
```

Note: `permissions` are NOT included in the JWT — they are loaded live from DB on each request via `JwtStrategy.validate()`.

---

## Super-Admin

- Super-admins have `isSuperAdmin: true` in both DB and JWT payload.
- `PermissionsGuard` short-circuits for super-admins (all permissions granted).
- Super-admin status can only be set directly in DB (no API endpoint to promote).

---

## Tenant Resolution Order

1. Check `x-tenant-id` header IF `TENANCY_DEV_HEADER_ENABLED=true` (development only)
2. Look up `Host` header → `tenant_domains` table → `Tenant`
3. If no tenant resolved → request proceeds without tenant context (some endpoints require it)

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing secret for access tokens (required in production) |
| `TENANCY_DEV_HEADER_ENABLED` | Enables `x-tenant-id` dev override (`true`/`false`) |

---

## TODO (Phase 4)
- [ ] Active revocation of refresh tokens when user is disabled
- [ ] IP-based anomaly detection for refresh token use
- [ ] Rotate JWT secret without downtime (key versioning)
- [ ] MFA support for admin users
