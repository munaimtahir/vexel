# Auth Route Classification Rules

In the Vexel Health Platform, all routes and API endpoints fall under strict tenant-aware classifications. This document details the distinction between these classifications and classifies key authentication/session endpoints.

## Route Classification Definitions

### 1. `PUBLIC_TENANT_RESOLVED`
- **Definition**: Public/unauthenticated endpoints that do not require an active JWT session token, but **must** have their tenant context resolved from the request Host/domain (or via development headers) prior to processing.
- **Security Context**: Credential verification or public data queries must operate inside the resolved tenant context. Tenant-scoped users must never be queried by email alone.
- **Example Endpoints**: 
  - `POST /api/auth/login` (Tenant resolved from Host/domain; authenticates via `tenantId + email + active status`).
  - `POST /api/auth/refresh` (Tenant/user session context resolved from the refresh token).
  - `/login` (Frontend login page; displays branding resolved from domain).

### 2. `PUBLIC_TENANT_OPTIONAL`
- **Definition**: Public endpoints that do not require authentication and do not require tenant resolution to function.
- **Security Context**: These endpoints are completely global and bypass tenant resolution checks (or treat them as completely optional/noop).
- **Example Endpoints**:
  - `GET /api/health` (Service health probes).

### 3. `PROTECTED_TENANT_REQUIRED`
- **Definition**: Authenticated endpoints requiring a valid JWT session token and a resolved tenant context.
- **Security Context**: Token verification validates the tenant ID. All database queries must be filtered strictly by `tenantId`. Cross-tenant reads/writes are blocked.
- **Example Endpoints**:
  - `POST /api/auth/logout` (Revokes refresh tokens within the authenticated session context).
  - `GET /api/me` (Returns the current authenticated user's profile and roles context).
  - `/(protected)/*` (All authenticated application shell/dashboard routes).

---

## Detailed Classification of Session Endpoints

| Route Path | Classification | Authentication Required? | Tenant Resolved? | Lookup Strategy |
| --- | --- | --- | --- | --- |
| `/api/auth/login` | `PUBLIC_TENANT_RESOLVED` | No | Yes | Resolves `tenantId` from Host/domain. Finds user using `tenantId + email + active status`. |
| `/api/auth/refresh` | `PUBLIC_TENANT_RESOLVED` | No | Yes | Verifies valid opaque UUID refresh token in DB. Resolves associated tenant/user context. |
| `/api/auth/logout` | `PROTECTED_TENANT_REQUIRED` | Yes | Yes | Operates on active JWT session token to revoke user refresh tokens. |
| `/api/me` | `PROTECTED_TENANT_REQUIRED` | Yes | Yes | Requires valid JWT token. Fetches user details under resolved `tenantId` context. |
