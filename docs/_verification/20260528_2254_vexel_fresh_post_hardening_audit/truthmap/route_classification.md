# Route Classification

| Route Group | Classification | Notes |
| ----------- | -------------- | ----- |
| `/(protected)/*` | AUTH_REQUIRED | Enforced via middleware + layout guard. |
| `/login` | PUBLIC | Only accessible for unauthenticated users. |
| `/api/auth/*` | PUBLIC_UNRESOLVED | Tenant resolution not required for login. |
| `/api/health/*` | PUBLIC_UNRESOLVED | Health probes skip tenant resolution. |
