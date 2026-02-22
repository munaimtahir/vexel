# Auth Unification Preflight

## 1. Current Auth Contract Map
- POST /auth/login → returns { accessToken, refreshToken, expiresIn, tokenType }
  Body: { email, password }. No cookies set currently.
- POST /auth/refresh → body: { refreshToken }. Returns same shape.
- POST /auth/logout → bearer required. No cookie clearing.
- GET /me → bearer required. Returns UserSummary.

## 2. Current Implementation Map
- apps/api: stateless JWT, no cookie-parser installed, CORS origin:true
- apps/admin: stores vexel_admin_token + vexel_admin_refresh in localStorage
- apps/operator: stores vexel_operator_token + vexel_operator_refresh in localStorage
- Both apps api-client: baseUrl = NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'
- apps/api/src/main.ts: enableCors({ origin: true, credentials: true })

## 3. Root Cause Analysis
Finding 1 (PRIMARY): Different localStorage keys per app.
  Admin:    vexel_admin_token / vexel_admin_refresh
  Operator: vexel_operator_token / vexel_operator_refresh
  Both apps on same domain (vexel.alshifalab.pk) → localStorage IS shared across paths.
  Different keys = blind to each other's session → must log in to each app separately.
  Fix: Unify to vexel_token / vexel_refresh in both apps.

Finding 2 (SECONDARY): Hard-coded x-tenant-id:'system' in raw fetch() calls.
  apps/operator/src/app/(protected)/encounters/[id]/page.tsx line 87
  apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx line 80
  Violates SDK-only + tenancy rules.

Finding 3 (LIKELY PROD CULPRIT): NEXT_PUBLIC_API_URL default is http://localhost:3002.
  If not set as build arg in Docker images, login calls go nowhere in production.

Finding 4 (ARCHITECTURE): No HttpOnly cookies. Refresh tokens in localStorage = XSS risk.

Finding 5 (PROD RISK): CORS origin:true — permissive, needs restriction.

Finding 6 (OK): User provisioning correct — bcrypt 12 rounds, tenant-scoped, password field in admin form.

## 4. V1 Auth Standard
- Cookie name: vexel_refresh
- Domain: AUTH_COOKIE_DOMAIN env var (e.g. vexel.alshifalab.pk)
- Options: HttpOnly; SameSite=Lax; Path=/api/auth; Secure in prod
- Backend still returns body tokens for backward compat
- Frontend stores access token in localStorage (vexel_token), uses cookie for refresh
- credentials:include on /auth/refresh and /me calls
