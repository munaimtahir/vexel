# Sprint 2: Tenant-Aware Auth & Tenancy Proof

## Tasks Completed

1. **Harden AuthService.login()**:
   - Prevented search by email alone.
   - Required resolved `tenantId` parameter from Host/domain name mapping.
   - Throws `UnauthorizedException` if `tenantId` is not resolved.
   - Scope queries on the `user` table explicitly to `{ email, tenantId, status: 'active' }`.

2. **Verify Host/Domain Resolution & Dev Overrides**:
   - Analyzed `TenantResolverMiddleware` which extracts hostname or handles `x-tenant-id` header override when `TENANCY_DEV_HEADER_ENABLED === 'true'`.
   - Verified that authenticated users' tokens resolve their tenant context securely.

3. **Harden AuthService.refresh()**:
   - Ensured refresh tokens validate that the referenced user is currently `active`.
   - Disabled/inactive users will throw an `UnauthorizedException` and fail to refresh their tokens.

4. **Correct Logout tenantId Logging**:
   - Updated `AuthService.logout()` to take `tenantId` from JWT payload (parsed request user).
   - Changed audit log to capture the correct `tenantId` instead of hardcoded `'system'`.

5. **Tenant A/B and Regression Tests**:
   - Created the test file `apps/api/src/auth/auth.service.spec.ts`.
   - Covered login with missing tenant context, matching user, password checks, inactive user refresh failure, and logout audit trail tenant ID.
   - Ran all 209 backend unit tests successfully (100% green pass).
