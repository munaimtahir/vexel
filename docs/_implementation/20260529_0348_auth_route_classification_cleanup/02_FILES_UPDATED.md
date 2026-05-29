# Files Updated

The following files in the repository were modified to correct `/api/auth/*` route classifications and tenant resolution rules:

1. **`docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/truthmap/route_classification.md`**
   - Removed `PUBLIC_UNRESOLVED` classification for `/api/auth/*` and `/api/health/*`.
   - Introduced `PUBLIC_TENANT_RESOLVED` for `/login`, `/api/auth/login`, and `/api/auth/refresh`.
   - Introduced `PROTECTED_TENANT_REQUIRED` for `/(protected)/*`, `/api/auth/logout`, and `/api/me`.
   - Introduced `PUBLIC_TENANT_OPTIONAL` for `/api/health` probes.
   - Documented the exact tenant-aware login resolution mechanism.

2. **`docs/specs/AUTH.md`**
   - Corrected the login flow description step to state that the host is resolved to a `tenantId` first, and the user search is performed via `tenantId + email + active status` (never by email alone).
