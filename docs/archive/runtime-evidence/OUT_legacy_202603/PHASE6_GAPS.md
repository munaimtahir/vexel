# Phase 6 — Remaining Gaps

**Only genuine gaps listed. Style/minor issues omitted.**

---

## Contract

| # | Gap | File | Priority |
|---|---|---|---|
| C-1 | SDK `api.d.ts` is stale — 19 paths missing (document endpoints, catalog parameters/reference-ranges/import-export). `pnpm sdk:generate` must be run and output committed. | `packages/sdk/src/generated/api.d.ts` | P1 |
| C-2 | `/tenants/{tenantId}/feature-flags` in OpenAPI does not match controller path `/feature-flags`. HTTP calls to the contract path return 404. | `apps/api/src/feature-flags/feature-flags.controller.ts` OR `packages/contracts/openapi.yaml` | P3 |

---

## UI

| # | Gap | File | Priority |
|---|---|---|---|
| U-1 | Publish page uses `/documents/{documentId}` as path template; OpenAPI/SDK defines `/documents/{id}`. After SDK regeneration, TypeScript will error. Fix: rename path template and param key to `{id}`. | `apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx` | P2 |
| U-2 | Admin jobs page uses `as any` casts for `/jobs`, `/jobs/failed`, `/catalog/import-jobs`, `/catalog/export-jobs`, `/documents`. Will be resolved automatically once SDK is regenerated (Gap C-1). | `apps/admin/src/app/(protected)/jobs/page.tsx` | P2 (blocked on C-1) |

---

## API

| # | Gap | File | Priority |
|---|---|---|---|
| A-1 | Feature-flags controller path mismatch (see C-2 above). | `apps/api/src/feature-flags/feature-flags.controller.ts` | P3 |

---

## Worker

_No gaps. `document-render.processor.ts`, `catalog-import.processor.ts`, `catalog-export.processor.ts` all present and wired._

---

## PDF

_No gaps. `.NET` service with `/render` endpoint present in `apps/pdf/Program.cs`._

---

## Ops

| # | Gap | Priority |
|---|---|---|
| O-1 | Docker stack is not running. Runtime health checks, smoke tests, and end-to-end verification cannot be completed until `docker compose up -d` is run and all services reach `healthy` state. | P4 |

---

## Summary Count

| Category | Gaps |
|---|---|
| Contract | 2 |
| UI | 2 (1 blocked on contract fix) |
| API | 1 (same root as C-2) |
| Worker | 0 |
| PDF | 0 |
| Ops | 1 (runtime, not a code bug) |
| **Total** | **4 distinct root causes** |

The two highest-priority items (C-1 SDK regeneration + U-1 path param fix) can be resolved in a single PR.
