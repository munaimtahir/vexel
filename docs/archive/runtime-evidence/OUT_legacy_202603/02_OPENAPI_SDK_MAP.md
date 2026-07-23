# OpenAPI ↔ SDK Map

## OpenAPI Contract Hash

```
sha256sum packages/contracts/openapi.yaml
a0e555b27c35ca30df0df868d778958722de44e7ffd306247a1533e42ccd2e06  packages/contracts/openapi.yaml
```

## OpenAPI Operation Count

```
grep -c "operationId:" packages/contracts/openapi.yaml
78
```

## OpenAPI Path Count

55 unique paths (extracted from `grep -n "^\s\{2\}/" packages/contracts/openapi.yaml`).

## SDK Entrypoints

`cat packages/sdk/src/index.ts`:

```typescript
/**
 * @vexel/sdk — Generated API client
 *
 * IMPORTANT: This package is the ONLY way frontends should call the API.
 * No direct fetch/axios calls to backend endpoints are allowed.
 *
 * Usage:
 *   import { createApiClient } from '@vexel/sdk';
 *   const api = createApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL, token: '...' });
 *   const { data } = await api.GET('/health');
 */

export { createApiClient, type ApiClient } from './client';
export type { paths, components, operations } from './generated/api';
```

`packages/sdk/src/client.ts` wraps `openapi-fetch` with `createFetchClient<paths>` — correctly typed client factory.

## SDK Coverage — Path Count

```
grep -n "^\s\{4\}\"/" packages/sdk/src/generated/api.d.ts | wc -l
36
```

**SDK has 36 paths vs 55 in OpenAPI. Gap: 19 missing paths (SDK is STALE).**

### Paths present in SDK (36)

```
/health
/health/worker
/health/pdf
/auth/login
/auth/refresh
/auth/logout
/me
/tenants
/tenants/{tenantId}
/tenants/{tenantId}/config
/tenants/{tenantId}/feature-flags
/users
/users/{userId}
/users/{userId}/roles
/roles
/roles/{roleId}
/roles/permissions
/feature-flags
/feature-flags/{key}
/catalog/tests
/catalog/tests/{testId}
/catalog/panels
/audit-events
/jobs
/jobs/failed
/jobs/failed-count
/jobs/{jobId}:retry
/patients
/patients/{patientId}
/encounters
/encounters/{encounterId}
/encounters/{encounterId}:order-lab
/encounters/{encounterId}:collect-specimen
/encounters/{encounterId}:result
/encounters/{encounterId}:verify
/encounters/{encounterId}:cancel
```

### Paths in OpenAPI but MISSING from SDK (19) — DRIFT

```
/catalog/parameters
/catalog/parameters/{parameterId}
/catalog/tests/{testId}/parameters
/catalog/tests/{testId}/parameters/{parameterId}
/catalog/panels/{panelId}/tests
/catalog/panels/{panelId}/tests/{testId}
/catalog/reference-ranges
/catalog/reference-ranges/{id}
/catalog/import-jobs
/catalog/import-jobs/{id}
/catalog/import-jobs/{id}:retry
/catalog/export-jobs
/catalog/export-jobs/{id}
/documents/receipt:generate
/documents/report:generate
/documents
/documents/{id}
/documents/{id}:publish
/documents/{id}/download
```

## SDK Import Verification

`grep -rn "from '@vexel/sdk'" apps/admin/src apps/operator/src`:

```
apps/admin/src/lib/api-client.ts:7:import { createApiClient } from '@vexel/sdk';
apps/operator/src/lib/api-client.ts:5:import { createApiClient } from '@vexel/sdk';
```

✅ Both frontends import exclusively from `@vexel/sdk`. No ad-hoc fetch/axios usage detected.

## Raw Fetch Bypass Check

`grep -rn "fetch\(" apps/admin/src/app apps/operator/src/app --include="*.tsx" --include="*.ts" | grep -v "getApiClient\|api-client"`:

```
(no output)
```

✅ PASS — No raw fetch bypass detected.

## SDK Freshness Gate

`packages/sdk/scripts/check-sdk-freshness.sh` exists and checks if `api.d.ts` was regenerated after `openapi.yaml` changed.  
**Status: script exists but currently SDK is stale — regeneration has NOT been run after document + catalog-advanced paths were added to openapi.yaml.**

## Verdict

| Check | Status |
|---|---|
| SDK module exists and exports typed client | ✅ PASS |
| Both frontends import from `@vexel/sdk` only | ✅ PASS |
| SDK types cover all OpenAPI paths | ❌ FAIL — 19/55 paths missing from `api.d.ts` |
| Freshness CI gate script present | ✅ PASS (script exists) |
| Freshness CI gate enforced (SDK regenerated) | ❌ FAIL — SDK is stale |
