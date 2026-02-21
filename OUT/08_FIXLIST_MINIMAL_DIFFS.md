# Fix List — Minimal Diffs

Based on evidence from OUT/02 through OUT/07, the following genuine gaps were identified.

---

## Gap 1 — SDK is Stale (19 paths missing)

**What's wrong:**  
`packages/sdk/src/generated/api.d.ts` was generated from an older version of `openapi.yaml`. The current OpenAPI spec has 55 paths / 78 operationIds; the SDK has 36 paths. Missing: all document endpoints, catalog parameters, reference-ranges, import/export jobs.

**File:** `packages/sdk/src/generated/api.d.ts` (generated artifact — regenerate, don't hand-edit)

**Minimal fix:**
```bash
pnpm sdk:generate
# then commit packages/sdk/src/generated/api.d.ts
```
This runs `openapi-typescript` against the current `packages/contracts/openapi.yaml` and regenerates the typed client.

**Acceptance criteria:**
- `grep -c "documents/{id}" packages/sdk/src/generated/api.d.ts` → returns ≥ 1
- `grep -c "documents/report:generate" packages/sdk/src/generated/api.d.ts` → returns ≥ 1
- Total paths in SDK equals 55 (matches OpenAPI)
- CI freshness gate (`check-sdk-freshness.sh`) passes on a clean diff

---

## Gap 2 — Operator Publish Page: Wrong Path Parameter Key for Document Endpoints

**What's wrong:**  
`apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx` calls:
- `api.GET('/documents/{documentId}', { params: { path: { documentId: docId } } })`
- `api.POST('/documents/{documentId}:publish', { params: { path: { documentId: document.id } } })`
- `api.GET('/documents/{documentId}/download', { params: { path: { documentId: document.id } } })`

But OpenAPI spec (and the SDK when regenerated) defines these paths as `/documents/{id}` with param key `id`, not `{documentId}`.

After SDK regeneration, TypeScript will reject these calls with type errors.

**File:** `apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx`

**Minimal fix:** Change 3 path strings and their corresponding `path` parameter keys:

```diff
- api.GET('/documents/{documentId}', { params: { path: { documentId: docId } } })
+ api.GET('/documents/{id}', { params: { path: { id: docId } } })

- api.POST('/documents/{documentId}:publish', { params: { path: { documentId: document.id } } })
+ api.POST('/documents/{id}:publish', { params: { path: { id: document.id } } })

- api.GET('/documents/{documentId}/download', { params: { path: { documentId: document.id } } })
+ api.GET('/documents/{id}/download', { params: { path: { id: document.id } } })
```

Also remove `body as any` on the `generateReport` call once SDK is regenerated and types are available.

**Acceptance criteria:**
- `tsc --noEmit` passes in `apps/operator` after SDK regeneration
- No `as any` casts on document API calls
- Publish page renders without TypeScript errors

---

## Gap 3 — Feature-Flags Path Mismatch (OpenAPI vs Controller)

**What's wrong:**  
OpenAPI spec defines `/tenants/{tenantId}/feature-flags` as the path for GET and PUT feature flag operations. The actual controller is mounted at `/feature-flags` (derives tenantId from JWT). Any HTTP client calling the OpenAPI-specified path gets a 404.

**File:** `apps/api/src/feature-flags/feature-flags.controller.ts`

**Minimal fix (Option A — preferred):** Add a new route alias in the controller, or move to tenant-scoped path:

```typescript
// Change @Controller('feature-flags') to register under both paths,
// or add a TenantFeatureFlagsController under tenants/:tenantId/feature-flags
// that delegates to FeatureFlagsService with tenantId from path param.
```

Alternatively, update `packages/contracts/openapi.yaml` to reflect the actual path `/feature-flags` (Option B — simpler, no controller change, but loses the tenant-in-path explicitness).

**Acceptance criteria (Option A):**
- `curl http://localhost:9021/api/tenants/{tenantId}/feature-flags` returns 200 with valid bearer token
- Old `/feature-flags` path continues to work (no regression)

**Acceptance criteria (Option B):**
- OpenAPI path updated to `/feature-flags` 
- SDK regenerated
- All frontend calls to `/feature-flags` remain valid

---

## Gap 4 — Docker Stack Not Running (Runtime Verification Incomplete)

**What's wrong:**  
`docker compose ps` shows 0 running containers. Health endpoints at `127.0.0.1:9021` and `127.0.0.1:9022` are unreachable.

**File:** N/A (operational gap, not a code gap)

**Minimal fix:**
```bash
cd /home/munaim/srv/apps/vexel
docker compose up -d
# Wait for containers to be healthy, then run smoke tests per docs/ops/SMOKE_TESTS.md
```

**Acceptance criteria:**
- `docker compose ps` shows all 6+ services as `running`
- `curl http://127.0.0.1:9021/api/health` returns `{"status":"ok"}`
- `curl http://127.0.0.1:9022/health` (or `/health/pdf`) returns 200
- Smoke tests in `docs/ops/SMOKE_TESTS.md` pass

---

## No Other Critical Gaps

All other conditions are met:
- Operator workflow pages exist with real SDK calls ✅
- Contract-first discipline structurally enforced ✅ (SDK is the only import path)
- Document pipeline is fully wired (canonical, hash, idempotency, worker, PDF) ✅
- Auditability: 6 audit calls in encounters.service, correlationId middleware on every request ✅
- Tenant isolation: every query uses JWT-derived tenantId, tests pass ✅
- No secrets committed ✅
- 36/36 unit tests pass ✅
