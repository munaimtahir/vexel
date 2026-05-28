# Frontend ↔ Backend Truthmap Audit (Phase 7B — In Progress)

This phase builds a from-scratch, evidence-backed map across:
- Frontend actions (Admin + Operator)
- Generated SDK usage
- OpenAPI operations (canonical contract)
- Backend controller implementations
- Runtime verification of critical workflows

Status: IN PROGRESS (static extraction started; backend correlation + runtime pending)

Primary evidence (so far):
- Frontend route file lists:
  - Admin pages: `logs/phase7b_admin_pages.txt`
  - Operator pages: `logs/phase7b_operator_pages.txt`
- Extracted frontend SDK calls (openapi-fetch client calls):
  - Raw extraction: `contracts/frontend_backend_truthmap.json`
  - CSV: `contracts/frontend_backend_truthmap.csv`
- OpenAPI correlation of extracted calls:
  - Enriched map: `contracts/openapi_sdk_backend_frontend_map.json`
  - CSV: `contracts/openapi_sdk_backend_frontend_map.csv`
  - Enrichment errors (if any): `logs/phase7b_openapi_enrich.err`

## A) Frontend → SDK → OpenAPI (static)

Extraction method:
- Scan `apps/admin/src` and `apps/operator/src` for openapi-fetch invocations:
  - `.GET('/path')`, `.POST('/path')`, `.PATCH('/path')`, `.PUT('/path')`, `.DELETE('/path')`
- Record: app, file, line, HTTP method, path string literal.

Result (this run):
- Total extracted SDK calls: 282 (Evidence: `contracts/frontend_backend_truthmap.json` + CSV)

OpenAPI correlation:
- Calls with matching (method, path) in `packages/contracts/openapi.yaml`: 275
- Calls missing an OpenAPI match: 7
(Evidence: `contracts/openapi_sdk_backend_frontend_map.json`)

### Critical static findings (contract drift / unsafe typing bypass)

The following frontend calls have **no matching OpenAPI operation** (method+path mismatch), which is a contract-first violation candidate and requires runtime/back-end verification to classify root cause:
- Admin catalog uses `/catalog/*` endpoints with `as any`, while OpenAPI exposes admin catalog under `/admin/catalog/*` (examples in missing list).
- Admin jobs retry uses a template string path (`/jobs/${...}:retry`) rather than the OpenAPI path template `/jobs/{jobId}:retry`.
- OPD actions:
  - Admin attempts `DELETE /opd/providers/{providerId}` but OpenAPI only defines `GET`/`PATCH` for that resource.
  - Operator attempts `POST /opd/billing/invoices/{invoiceId}/payments` but OpenAPI defines `GET` only; payment recording appears to be modeled as command endpoints (e.g. `:record-payment`) in the contract.

Evidence list:
- `contracts/openapi_sdk_backend_frontend_map.json` -> `calls_missing_openapi_match`

Next steps in this phase:
- Correlate backend controllers/routes to OpenAPI paths (Phase 7B B/C).
- Run runtime verification of critical flows and capture network evidence (Phase 7B G + Phases 14–16).
- Produce required truthmap artifacts: reverse map, workflow truthmap, admin safety truthmap, orphan endpoints list, missing actions lists.

