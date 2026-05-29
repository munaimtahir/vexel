# Auth Refresh/Logout/Session Audit

## Refresh Token Lifecycle
- **Storage:** Persisted in PostgreSQL `refresh_tokens` table.
- **Security:** Tokens are hashed in the database using `bcrypt`.
- **Expiration:** Configured for 7 days (`REFRESH_TOKEN_TTL_DAYS`).
- **Rotation:** Every `POST /auth/refresh` call revokes the old token and issues a new one.
- **Revocation:** Tokens are invalidated on:
    - Explicit logout.
    - Password change.
    - User deactivation (disabled status).
    - Use for rotation.

## Logout and Session Management
- **Endpoint:** `POST /auth/logout`.
- **Action:** Revokes all active refresh tokens for the user in the database.
- **Browser:** `vexel_refresh` cookie is cleared.
- **Same-Browser Session Behavior:** Since logout revokes tokens in the DB, it invalidates sessions across all tabs for that user.

## Audit Logging
- **Login:** `auth.login`.
- **Refresh:** `auth.token_refresh`.
- **Logout:** `auth.logout`.
- **Verification:** All events include `actorUserId` and `tenantId`.

## Required Verdict
**REFRESH & LOGOUT PASS**

## Status Summary
The session management system is secure and resilient. The use of hashed refresh tokens in the database, combined with rotation and proactive revocation on logout or status change, ensures a high level of security. Multi-tab session synchronization is handled via database-level token revocation.
