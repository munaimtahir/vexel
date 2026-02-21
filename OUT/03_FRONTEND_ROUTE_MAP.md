# Frontend Route Map

## Admin App Routes

`find apps/admin/src/app -name "page.tsx" | sort`

```
apps/admin/src/app/(protected)/audit/page.tsx
apps/admin/src/app/(protected)/branding/page.tsx
apps/admin/src/app/(protected)/catalog/import-export/page.tsx
apps/admin/src/app/(protected)/catalog/page.tsx
apps/admin/src/app/(protected)/catalog/panels/page.tsx
apps/admin/src/app/(protected)/catalog/parameters/page.tsx
apps/admin/src/app/(protected)/catalog/tests/page.tsx
apps/admin/src/app/(protected)/dashboard/page.tsx
apps/admin/src/app/(protected)/feature-flags/page.tsx
apps/admin/src/app/(protected)/jobs/page.tsx
apps/admin/src/app/(protected)/roles/page.tsx
apps/admin/src/app/(protected)/system/health/page.tsx
apps/admin/src/app/(protected)/tenants/page.tsx
apps/admin/src/app/(protected)/users/page.tsx
apps/admin/src/app/login/page.tsx
apps/admin/src/app/page.tsx
```

### Admin Route Details

| Route | Protected | Key SDK Calls |
|---|---|---|
| `/` (page.tsx) | No (redirect) | None |
| `/login` | No | `api.POST('/auth/login', ...)` |
| `/dashboard` | ✅ Yes | `api.GET('/health')`, `api.GET('/jobs/failed-count')`, `api.GET('/audit-events', {limit:10})` |
| `/tenants` | ✅ Yes | `api.GET('/tenants')`, `api.POST('/tenants', ...)`, tenant update calls |
| `/users` | ✅ Yes | `api.GET('/users')`, `api.GET('/roles')`, `api.POST('/users', ...)`, `api.PATCH('/users/${id}', ...)` |
| `/roles` | ✅ Yes | SDK calls (roles management) |
| `/feature-flags` | ✅ Yes | SDK calls for `/feature-flags` |
| `/catalog` | ✅ Yes | Catalog overview |
| `/catalog/tests` | ✅ Yes | `api.GET('/catalog/tests')`, `api.POST('/catalog/tests', ...)` |
| `/catalog/panels` | ✅ Yes | Catalog panel CRUD |
| `/catalog/parameters` | ✅ Yes | Catalog parameter CRUD |
| `/catalog/import-export` | ✅ Yes | `api.GET('/catalog/import-jobs' as any)`, `api.GET('/catalog/export-jobs' as any)` — `as any` required (SDK stale) |
| `/audit` | ✅ Yes | `api.GET('/audit-events', {params:{query:{...}}})` |
| `/jobs` | ✅ Yes | `api.GET('/jobs' as any)`, `api.GET('/jobs/failed' as any)`, `api.POST('/jobs/${id}:retry' as any)` — `as any` required |
| `/system/health` | ✅ Yes | SDK health calls |
| `/branding` | ✅ Yes | Branding management |

---

## Operator App Routes

`find apps/operator/src/app -name "page.tsx" | sort`

```
apps/operator/src/app/(protected)/encounters/[id]/page.tsx
apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx
apps/operator/src/app/(protected)/encounters/[id]/results/page.tsx
apps/operator/src/app/(protected)/encounters/[id]/verify/page.tsx
apps/operator/src/app/(protected)/encounters/new/page.tsx
apps/operator/src/app/(protected)/encounters/page.tsx
apps/operator/src/app/(protected)/patients/new/page.tsx
apps/operator/src/app/(protected)/patients/page.tsx
apps/operator/src/app/login/page.tsx
apps/operator/src/app/page.tsx
```

### Operator Route Details

| Route | Protected | Key SDK Calls |
|---|---|---|
| `/` (page.tsx) | No (redirect) | None |
| `/login` | No | `api.POST('/auth/login', ...)` |
| `/patients` | ✅ Yes | `api.GET('/patients')` |
| `/patients/new` | ✅ Yes | `api.POST('/patients', ...)` |
| `/encounters` | ✅ Yes | `api.GET('/encounters')` |
| `/encounters/new` | ✅ Yes | `api.GET('/patients')`, `api.POST('/encounters', ...)` |
| `/encounters/[id]` | ✅ Yes | `api.GET('/encounters/{encounterId}', ...)`, `api.POST('/encounters/{encounterId}:cancel', ...)` |
| `/encounters/[id]/results` | ✅ Yes | `api.GET('/encounters/{encounterId}', ...)`, `api.POST('/encounters/{encounterId}:result', ...)` |
| `/encounters/[id]/verify` | ✅ Yes | `api.GET('/encounters/{encounterId}', ...)`, `api.POST('/encounters/{encounterId}:verify', ...)` |
| `/encounters/[id]/publish` | ✅ Yes | `api.GET('/encounters/{encounterId}', ...)`, `api.POST('/documents/report:generate', {body: ... as any})`, `api.GET('/documents/{documentId}', ...)`, `api.POST('/documents/{documentId}:publish', ...)`, `api.GET('/documents/{documentId}/download', ...)` — **DRIFT: uses `{documentId}` but OpenAPI uses `{id}`** |

---

## Notes

- Admin app has `(protected)` route group — implies auth middleware/layout wrapping.
- Operator app also uses `(protected)` route group.
- All workflow pages in operator app use `getApiClient` — no raw fetch.
- Publish page uses `as any` casts for document calls because SDK types are stale.
