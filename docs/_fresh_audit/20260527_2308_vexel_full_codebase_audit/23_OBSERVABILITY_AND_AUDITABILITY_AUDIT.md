# Observability and Auditability Audit

Primary evidence:
- Correlation id propagation in SDK client: `packages/sdk/src/client.ts`
- API CORS allows `x-correlation-id`: `logs/apps_api_src_main.ts`
- Audit events queried by correlationId: `runtime-responses/truthmap/audit_events_verify.json`

## Correlation IDs
- Frontend SDK client sets `x-correlation-id` header when provided (and Admin/Operator API clients generate one if missing). (Evidence: `packages/sdk/src/client.ts`, `apps/*/src/lib/api-client.ts`)
- API allows `x-correlation-id` header via CORS config. (Evidence: `logs/apps_api_src_main.ts`)

Runtime proof:
- Audit events returned include `correlationId` matching the request header used for verification.
(Evidence: `runtime-responses/truthmap/audit_events_verify.json`)

## Audit events
Runtime proof shows multiple audited actions for a single workflow correlationId, including:
- encounter verified
- document generate/render/publish
(Evidence: `runtime-responses/truthmap/audit_events_verify.json`)

## Verdict (this run)

**OBSERVABILITY PASS (correlationId + audit trail proven for core workflow)**

