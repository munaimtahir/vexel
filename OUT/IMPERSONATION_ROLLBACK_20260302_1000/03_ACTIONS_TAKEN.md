# 03 — ACTIONS TAKEN

## Rollback Method: Surgical Removal (Option 3)

The introducing commit (`65fd941 final`) contained many other legitimate changes (catalog search, admin UI improvements, PDF fixes, etc.) so full git revert was not safe. Surgical removal was applied.

---

## Step-by-Step Actions

### API Backend

1. **Deleted** `apps/api/src/impersonation/` directory (6 files):
   - `impersonation.controller.ts`
   - `impersonation.service.ts`
   - `impersonation.types.ts`
   - `impersonation.constants.ts`
   - `impersonation.signing.ts`
   - `impersonation.module.ts`

2. **Deleted** `apps/api/src/auth/jwt-auth.guard.impersonation.spec.ts`

3. **Reverted** `apps/api/src/auth/jwt-auth.guard.ts`:
   - Removed `@Optional() impersonation` constructor injection
   - Removed static shared service storage pattern
   - Removed `async` from `handleRequest` (back to sync)
   - Removed all impersonation cookie handling, `applyToRequest` call, write-blocking logic
   - Removed imports: `ImpersonationService`, `SAFE_HTTP_METHODS`, `CORRELATION_ID_HEADER`, `Optional`
   - Restored simple `return user;` exit

4. **Removed** `ImpersonationModule` import from `apps/api/src/auth/auth.module.ts`

5. **Removed** `ImpersonationModule` import from `apps/api/src/app.module.ts`

### Database / Prisma

6. **Removed** from `apps/api/prisma/schema.prisma`:
   - `enum ImpersonationMode { READ_ONLY }`
   - `model ImpersonationSession { ... }` (full model + indexes + relations)
   - `impersonationSessions ImpersonationSession[]` from `Tenant` model
   - `startedImpersonationSessions ImpersonationSession[] @relation(...)` from `User` model
   - `impersonatedSessions ImpersonationSession[] @relation(...)` from `User` model

7. **Dropped** `impersonation_sessions` table from live PostgreSQL DB directly via `psql`
8. **Dropped** `"ImpersonationMode"` enum from live PostgreSQL DB
9. **Removed** migration `20260302090000_add_impersonation_sessions` row from `_prisma_migrations` table
10. **Deleted** migration directory `apps/api/prisma/migrations/20260302090000_add_impersonation_sessions/`

### OpenAPI + SDK

11. **Removed** from `packages/contracts/openapi.yaml`:
    - Path `POST /admin/impersonation/start`
    - Path `POST /admin/impersonation/stop`
    - Path `GET /admin/impersonation/status`
    - Schema `AdminImpersonationStartRequest`
    - Schema `AdminImpersonationUser`
    - Schema `AdminImpersonationStartResponse`
    - Schema `AdminImpersonationStatusInactive`
    - Schema `AdminImpersonationStatusActive`
    - Schema `AdminImpersonationStatusResponse`
    - Reverted `Forbidden` response description to plain `"Forbidden"` (was "Forbidden (including read-only impersonation write blocking)")

12. **Regenerated** `packages/sdk/src/generated/api.d.ts` via `pnpm sdk:generate`

### Admin UI

13. **Deleted** `apps/admin/src/components/impersonation-banner.tsx`
14. **Removed** `<ImpersonationBanner />` and its import from `apps/admin/src/app/(protected)/layout.tsx`
15. **Removed** from `apps/admin/src/app/(protected)/users/page.tsx`:
    - State vars: `impersonateUser`, `impersonateReason`, `impersonateError`, `impersonating`
    - Function `getImpersonationLanding()`
    - Function `handleImpersonateStart()`
    - Impersonation modal JSX block
    - "Act as (Read-only)" action button in DataTable

### Operator UI

16. **Deleted** `apps/operator/src/components/impersonation-banner.tsx`
17. **Removed** `<ImpersonationBanner />` and its import from `apps/operator/src/app/(protected)/layout.tsx`

### E2E Tests

18. **Removed** test `'read-only impersonation blocks writes and can be stopped'` from `apps/e2e/tests/02-admin-crud.spec.ts`
