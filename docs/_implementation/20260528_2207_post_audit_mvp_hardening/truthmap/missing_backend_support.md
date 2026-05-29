# Missing Backend Support (Preliminary — Phase 7B static)

This file lists frontend SDK calls that do not match any OpenAPI (method, path) pair in `packages/contracts/openapi.yaml`.

Evidence source:
- `contracts/openapi_sdk_backend_frontend_map.json` -> `calls_missing_openapi_match`

Items (from scratch, this run):

1. Admin Catalog Panels:
- `PATCH /catalog/panels/{id}` (file: `apps/admin/src/app/(protected)/catalog/panels/page.tsx`)
- `DELETE /catalog/panels/{id}` (file: `apps/admin/src/app/(protected)/catalog/panels/page.tsx`)

2. Admin Catalog Tests:
- `PATCH /catalog/tests/{id}` (file: `apps/admin/src/app/(protected)/catalog/tests/page.tsx`)
- `DELETE /catalog/tests/{id}` (file: `apps/admin/src/app/(protected)/catalog/tests/page.tsx`)

3. Admin Jobs Retry:
- `POST /jobs/${pendingRetry.id}:retry` (file: `apps/admin/src/app/(protected)/jobs/page.tsx`)
  - OpenAPI expects template path: `/jobs/{jobId}:retry`

4. Admin OPD Provider Delete:
- `DELETE /opd/providers/{providerId}` (file: `apps/admin/src/app/(protected)/opd/providers/page.tsx`)
  - OpenAPI defines `GET`/`PATCH` only for this path.

5. Operator OPD Invoice Payments:
- `POST /opd/billing/invoices/{invoiceId}/payments` (file: `apps/operator/src/app/(protected)/opd/billing/invoices/[invoiceId]/page.tsx`)
  - OpenAPI defines `GET` only; payment commands are separately modeled (e.g. `:record-payment`).

Status: NOT YET RUNTIME-VERIFIED.

