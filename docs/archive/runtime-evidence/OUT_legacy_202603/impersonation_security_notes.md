# Admin Impersonation Security Notes (Read-Only)

## Read-only enforcement
- Effective impersonation identity is applied server-side in `JwtAuthGuard` by validating `pgsims_impersonation`.
- During active impersonation, all non-safe methods are blocked globally (`POST`, `PUT`, `PATCH`, `DELETE`) except control endpoints under `/api/admin/impersonation/*`.
- Blocked writes return:
  - `403 Forbidden`
  - `{"message":"Impersonation is read-only. Stop impersonation to perform this action."...}`

## Cookie trust model
- Transport cookie: `pgsims_impersonation`
- Cookie payload is HMAC-signed (`sha256`) and includes:
  - `session_id`
  - `impersonated_user_id`
  - `mode=READ_ONLY`
  - `exp`
- Cookie attributes:
  - `HttpOnly`
  - `SameSite=Lax`
  - `Secure` in production
  - `Path=/`
- Invalid/expired impersonation cookies are cleared.

## Auditability captured
- `impersonation.start` audit event: actor, target, reason, mode, correlationId, IP, user-agent.
- `impersonation.stop` audit event: actor, session, endedAt, correlationId, IP, user-agent.
- `impersonation.write_blocked` audit event: actor, endpoint/method metadata, correlationId.
- `ImpersonationSession` also tracks:
  - `requestCount`
  - `blockedWriteCount`
  - `lastBlockedMethod`
  - `lastBlockedPath`
  - `lastBlockedAt`

## No JS-readable token model changes
- Access token and refresh token handling remain unchanged.
- No new JS-readable auth secret/token was introduced.
- Impersonation state is controlled by server-trusted `HttpOnly` cookie only.
