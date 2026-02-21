# UI Action Linkage Map

## Overview

Operator workflow pages mapped to SDK calls and OpenAPI operationIds.

---

## `/encounters/[id]/results` — Enter Results Page

`grep -n "api\.\|getApiClient\|POST\|GET" apps/operator/src/app/(protected)/encounters/[id]/results/page.tsx`

```
5:  import { getApiClient } from '@/lib/api-client';
30:  const api = getApiClient(getToken() ?? undefined);
31:  api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
58:  const api = getApiClient(getToken() ?? undefined);
66:  const { error: apiError } = await api.POST('/encounters/{encounterId}:result', {
```

| UI Action | SDK Call | OpenAPI operationId | Status |
|---|---|---|---|
| Load encounter on mount | `api.GET('/encounters/{encounterId}', ...)` | `getEncounter` | ✅ LINKED |
| Submit result form | `api.POST('/encounters/{encounterId}:result', ...)` | `enterResult` | ✅ LINKED |

---

## `/encounters/[id]/verify` — Verify Page

`grep -n "api\.\|getApiClient\|POST\|GET" apps/operator/src/app/(protected)/encounters/[id]/verify/page.tsx`

```
5:  import { getApiClient } from '@/lib/api-client';
21: const api = getApiClient(getToken() ?? undefined);
22: api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
34: const api = getApiClient(getToken() ?? undefined);
35: const { error: apiError, response } = await api.POST('/encounters/{encounterId}:verify', {
```

| UI Action | SDK Call | OpenAPI operationId | Status |
|---|---|---|---|
| Load encounter on mount | `api.GET('/encounters/{encounterId}', ...)` | `getEncounter` | ✅ LINKED |
| Verify button | `api.POST('/encounters/{encounterId}:verify', ...)` | `verifyEncounter` | ✅ LINKED |

---

## `/encounters/[id]/publish` — Publish / Document Page

`grep -n "api\.\|getApiClient\|POST\|GET" apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx`

```
5:  import { getApiClient } from '@/lib/api-client';
34: const api = getApiClient(getToken() ?? undefined);
35: api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
48: const api = getApiClient(getToken() ?? undefined);
49: const { data } = await api.GET('/documents/{documentId}', { params: { path: { documentId: docId } } });
66: const api = getApiClient(getToken() ?? undefined);
91: const { data, error: apiError } = await api.POST('/documents/report:generate', { body: body as any });
110: const api = getApiClient(getToken() ?? undefined);
111: const { data, error: apiError } = await api.POST('/documents/{documentId}:publish', {
125: const api = getApiClient(getToken() ?? undefined);
126: const { data, error: apiError } = await api.GET('/documents/{documentId}/download', {
```

| UI Action | SDK Call | OpenAPI Path | Status |
|---|---|---|---|
| Load encounter on mount | `api.GET('/encounters/{encounterId}', ...)` | `getEncounter` | ✅ LINKED |
| Poll document status | `api.GET('/documents/{documentId}', ...)` | `/documents/{id}` (OpenAPI) | ⚠️ DRIFT — path param key mismatch (`{documentId}` vs `{id}`) |
| Generate report button | `api.POST('/documents/report:generate', {body: ... as any})` | `generateReport` | ⚠️ PARTIAL — `body as any` (SDK stale, type cast required) |
| Publish button | `api.POST('/documents/{documentId}:publish', ...)` | `/documents/{id}:publish` (OpenAPI) | ⚠️ DRIFT — path param key mismatch (`{documentId}` vs `{id}`) |
| Download button | `api.GET('/documents/{documentId}/download', ...)` | `/documents/{id}/download` (OpenAPI) | ⚠️ DRIFT — path param key mismatch (`{documentId}` vs `{id}`) |

**Root cause:** SDK was generated before document endpoints were added to openapi.yaml. Frontend hardcoded `{documentId}` as path template name. OpenAPI spec uses `{id}`. When SDK is regenerated, TypeScript will reject these calls unless path template strings AND param keys are corrected.

---

## Additional Operator Pages

### `/encounters/[id]` — Encounter Detail

| UI Action | SDK Call | operationId | Status |
|---|---|---|---|
| Load encounter | `api.GET('/encounters/{encounterId}', ...)` | `getEncounter` | ✅ LINKED |
| Cancel encounter | `api.POST('/encounters/{encounterId}:cancel', ...)` | `cancelEncounter` | ✅ LINKED |

### `/encounters/new` — New Encounter

| UI Action | SDK Call | operationId | Status |
|---|---|---|---|
| Load patients list | `api.GET('/patients')` | `listPatients` | ✅ LINKED |
| Create encounter | `api.POST('/encounters', ...)` | `createEncounter` | ✅ LINKED |

### `/patients/new` — New Patient

| UI Action | SDK Call | operationId | Status |
|---|---|---|---|
| Create patient form | `api.POST('/patients', ...)` | `createPatient` | ✅ LINKED |

---

## Drift Summary

| # | Page | Drift | Severity |
|---|---|---|---|
| 1 | `/publish` — poll doc | `{documentId}` vs `{id}` path param | HIGH — will fail after SDK regeneration |
| 2 | `/publish` — publish button | `{documentId}` vs `{id}` path param | HIGH |
| 3 | `/publish` — download button | `{documentId}` vs `{id}` path param | HIGH |
| 4 | `/publish` — generate report | `body as any` type cast (SDK stale) | MED — masked at runtime, type unsafe |
