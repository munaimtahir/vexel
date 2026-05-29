# Route Classification

| Route / Endpoint | Classification | Description & Tenant Context |
| ---------------- | -------------- | ---------------------------- |
| `/(protected)/*` | PROTECTED_TENANT_REQUIRED | Enforced via middleware + layout guard. Requires active session and resolved tenant context. |
| `/login` | PUBLIC_TENANT_RESOLVED | Unauthenticated landing/login page, but tenant branding and resolution is performed from Host/domain. |
| `/api/auth/login` | PUBLIC_TENANT_RESOLVED | A public unauthenticated endpoint, but tenant resolution is required before credential lookup. The backend resolves tenant from Host/domain and authenticates using tenantId + email + active status. |
| `/api/auth/refresh` | PUBLIC_TENANT_RESOLVED | Public/unauthenticated endpoint for refreshing tokens, but preserves and resolves tenant/user context through the provided refresh token session. |
| `/api/auth/logout` | PROTECTED_TENANT_REQUIRED | Protected/token-authenticated endpoint. Revokes all refresh tokens and operates within the authenticated tenant-correct context. |
| `/api/me` | PROTECTED_TENANT_REQUIRED | Protected/token-authenticated endpoint. Injects and returns tenant-correct user context. |
| `/api/health` | PUBLIC_TENANT_OPTIONAL | Health probes that do not require active tenant resolution to report service status. |

