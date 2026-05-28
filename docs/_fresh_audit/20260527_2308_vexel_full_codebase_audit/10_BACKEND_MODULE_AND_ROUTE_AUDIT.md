# Backend Module and Route Audit (apps/api)

Scope: static discovery of backend modules/controllers/routes, plus initial security/tenancy/audit signals. Detailed OpenAPI↔SDK↔backend↔frontend parity and runtime checks are handled in Phase 7B and later phases.

Primary evidence:
- API source file list: `logs/phase7_api_src_files.txt`
- Controller locations: `logs/phase7_api_controllers.txt`
- Route decorator hits: `logs/phase7_api_route_decorators.txt`
- Security/tenant/audit keyword hits: `logs/phase7_api_security_tenant_audit_hits.txt`
- Global prefix evidence: `logs/phase7_api_global_prefix.txt`
- Snapshots: `logs/apps_api_src_main.ts`, `logs/apps_api_src_app.module.ts`

## Verified findings (static)

### Global API prefix
`apps/api/src/main.ts` sets `app.setGlobalPrefix('api')`. (Evidence: `logs/apps_api_src_main.ts`, `logs/phase7_api_global_prefix.txt`)

Implication:
- Controller paths like `@Controller('auth')` are expected to be served under `/api/auth` at runtime.

### CORS / headers
`apps/api/src/main.ts` enables CORS with `allowedHeaders` including `Authorization`, `x-tenant-id`, and `x-correlation-id`. (Evidence: `logs/apps_api_src_main.ts`)

### Controllers discovered (static list)
Controllers include (non-exhaustive summary; full list in evidence log):
- `auth`, `me`
- `health`
- `tenants`, `users`, `roles`, `feature-flags`
- `catalog` + `admin/catalog` variants + `operator/catalog/tests`
- `patients`, `encounters`, `results`, `verification`, `sample-collection`
- `documents`, `templates`, `audit-events`, `jobs`, `ops`
- OPD-related controllers under `opd` namespace (e.g. `opd`, `opd/billing`, `appointments/opd`)
(Evidence: `logs/phase7_api_controllers.txt`)

Notes:
- Some controllers use `@Controller()` with no base path (`sample-collection.controller.ts`, `account.controller.ts`), implying routes are fully defined at method-level. This needs deeper inspection during truthmap.

## Endpoint inventory status

At this phase, we captured raw decorator hits for route methods:
- 27 controller annotations
- 272 method route decorator occurrences (`@Get/@Post/@Patch/@Put/@Delete`)
(Evidence: `logs/phase7_api_controllers.txt`, `logs/phase7_api_route_decorators.txt`)

Detailed endpoint table (method/path/controller/service/auth/tenant/audit/contract) is deferred to Phase 7B where we correlate:
- OpenAPI operations
- Generated SDK methods
- Backend controller methods
- Frontend consumers

## Phase 7 status

Backend discovery: **IN PROGRESS (static inventory captured; detailed mapping pending)**

