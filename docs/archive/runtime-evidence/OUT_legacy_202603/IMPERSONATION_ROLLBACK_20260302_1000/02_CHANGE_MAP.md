# 02 — CHANGE MAP

## Responsible Commit

| SHA | Message | Date | Scope |
|-----|---------|------|-------|
| `65fd941` | `final` | 2026-03-02 14:28:16 +0500 | Introduced entire impersonation feature (bundled with other fixes) |

## Files Changed by Commit (impersonation-related subset)

```
apps/api/src/impersonation/                          ← NEW directory (6 files)
apps/api/src/auth/jwt-auth.guard.ts                  ← MODIFIED (added impersonation middleware)
apps/api/src/auth/jwt-auth.guard.impersonation.spec.ts ← NEW test
apps/api/src/auth/auth.module.ts                     ← MODIFIED (added ImpersonationModule import)
apps/api/src/app.module.ts                           ← MODIFIED (added ImpersonationModule)
apps/api/prisma/schema.prisma                        ← MODIFIED (+ImpersonationSession model, enum, relations)
apps/api/prisma/migrations/20260302090000_add_impersonation_sessions/ ← NEW migration
packages/contracts/openapi.yaml                      ← MODIFIED (+3 paths, +6 schemas, Forbidden description changed)
packages/sdk/src/generated/api.d.ts                 ← REGENERATED (with impersonation endpoints)
apps/admin/src/components/impersonation-banner.tsx   ← NEW
apps/admin/src/app/(protected)/layout.tsx            ← MODIFIED (added ImpersonationBanner)
apps/admin/src/app/(protected)/users/page.tsx        ← MODIFIED (added impersonation modal + action button)
apps/operator/src/components/impersonation-banner.tsx ← NEW
apps/operator/src/app/(protected)/layout.tsx         ← MODIFIED (added ImpersonationBanner)
apps/e2e/tests/02-admin-crud.spec.ts                 ← MODIFIED (added impersonation E2E test)
OUT/impersonation_openapi.json                       ← NEW artifact
OUT/impersonation_status_sample.json                 ← NEW artifact
OUT/impersonation_backend_tests.txt                  ← NEW artifact
OUT/impersonation_playwright.txt                     ← NEW artifact
OUT/impersonation_security_notes.md                  ← NEW artifact
```

## Behavior Introduced

1. **API endpoints** — `POST /admin/impersonation/start|stop`, `GET /admin/impersonation/status`
2. **Cookie-based session** — HMAC-signed `pgsims_impersonation` cookie; TTL 2h default
3. **JWT guard override** — When cookie present, `req.user` was replaced with impersonated user's identity
4. **Write blocking** — Non-safe HTTP methods (POST/PUT/PATCH/DELETE) returned 403 during impersonation
5. **Admin UI** — "Act as (Read-only)" button in Users table + modal with reason input
6. **Banner UI** — Amber banner in both Admin and Operator shells showing impersonated user
7. **DB sessions table** — Tracks impersonation sessions with audit fields
8. **Audit events** — `impersonation.start`, `impersonation.stop`, `impersonation.write_blocked` logged
