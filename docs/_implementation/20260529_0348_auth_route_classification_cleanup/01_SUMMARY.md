# Summary of Auth Route Classification Cleanup

This task addresses incorrect and misleading classification wording for `/api/auth/*` routes in the Vexel Health Platform. 

## Objectives Achieved
1. **Removed Obsolete Classification**: Replaced `PUBLIC_UNRESOLVED` for `/api/auth/*` with precise classifications indicating that authentication relies on tenant context.
2. **Clarified Tenant Resolution Rule**: Explicitly documented that `/api/auth/login` is public (unauthenticated) but strictly tenant-resolved before any credential lookup. The backend resolves the tenant from Host/domain and verifies matching credentials using `tenantId + email + active status`.
3. **Corrected Route Documentation**: Updated `docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/truthmap/route_classification.md` and `docs/specs/AUTH.md` to distinguish `PUBLIC_TENANT_RESOLVED`, `PUBLIC_TENANT_OPTIONAL`, and `PROTECTED_TENANT_REQUIRED` states.
4. **Validated Endpoint Contexts**: Ensure refresh, logout, and `/api/me` are correctly classified and preserve tenant/user safety.
