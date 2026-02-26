# Admin Tenant Scope Governance (Drift Prevention)

## Purpose
Prevent tenant-admin UI drift across:
- tenant scope semantics (explicit selector vs current auth tenant)
- API contract coverage (OpenAPI vs runtime endpoints)
- UI affordances vs actual backend behavior

## Root Cause of the Drift (Observed)
The earlier drift happened due to a combination of three factors:

1. Mixed tenant-scope models in Admin UI
- `Branding` and `Feature Flags` support explicit tenant selection (`tenantId` query + tenant picker).
- `Users`, `Roles`, `Catalog`, and `Documents` are tenant-scoped by authenticated tenant/host and do not consume `tenantId` query.
- A new tenant hub linked to both types of pages using `tenantId`, which made unsupported pages appear switchable.

2. Partial backend migration (legacy + new endpoints coexisting)
- Catalog Import/Export UI used legacy synchronous endpoints (`/catalog/import`, `/catalog/export`).
- Backend still implemented these endpoints.
- OpenAPI had moved to job-based import/export endpoints and omitted the legacy ones.
- Result: UI and backend matched each other, but contract-first governance was violated.

3. No explicit pre-merge audit checklist for tenant-admin pages
- There was no mandatory matrix confirming:
  - page scope mode
  - supported query params
  - exact backend endpoints used
  - OpenAPI coverage for each endpoint

## Policy (Required)

### 1. Every tenant-admin page MUST declare a scope mode
Each page must be one of:
- `explicit` — page supports tenant selection and uses `{tenantId}` endpoints or equivalent explicit tenant context
- `current-auth` — page uses authenticated tenant/host only and MUST NOT imply query-based switching

### 2. Tenant scope must be visible in UI
Tenant-admin pages must render a visible scope indicator/banner stating:
- whether explicit switching is supported
- which tenant is being acted on (name/id if available)
- any scope limitations

### 3. No unsupported tenant query propagation
Do not pass `tenantId` query params into pages that do not consume them.
- Exception: query may be retained only for navigation inside a hub page, but UI copy must state this clearly.

### 4. Contract-first parity is mandatory
If a frontend page calls an endpoint, one of the following must be true before merge:
- endpoint exists in `packages/contracts/openapi.yaml`, or
- frontend is updated to a contract-defined endpoint

Temporary compatibility endpoints are allowed only if:
- they are explicitly documented in OpenAPI as legacy/compatibility
- migration target is named in the endpoint description

### 5. Endpoint/UI coverage matrix required for tenant-admin changes
Any PR that changes tenant-admin pages or tenant-admin APIs must include a short audit matrix:
- UI page / control
- SDK call (method + path)
- OpenAPI path reference
- Scope mode (`explicit` or `current-auth`)

## Implementation Rules (Frontend)
- Use `@vexel/sdk` only (`lib/api-client.ts`) for all HTTP calls.
- Use a shared scope banner component for tenant-admin pages.
- If page is `current-auth`, do not label controls as “selected tenant” unless the page actually consumes tenant selection.

## Implementation Rules (Backend / Contract)
- During migrations, if legacy endpoints remain active and are still called by frontend, they must remain in OpenAPI until frontend cutover is complete.
- When replacing endpoints, remove old UI calls first or in same PR, then remove legacy OpenAPI entries and backend handlers.

## Review Checklist (Add to PR Description)
- [ ] Page scope mode declared (`explicit` or `current-auth`)
- [ ] Scope banner present and accurate
- [ ] No misleading `tenantId` query propagation
- [ ] Every frontend SDK call maps to OpenAPI
- [ ] Every visible tenant-admin action has a backend endpoint
- [ ] Any temporary legacy endpoint is marked as compatibility in OpenAPI

