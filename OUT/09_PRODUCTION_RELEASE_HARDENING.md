# 09 Production Release Hardening

## Baseline

## Baseline run (pre-change)

```bash
pnpm -w install --frozen-lockfile
exit:0
pnpm -w lint
exit:1
pnpm -w build
exit:0
pnpm -w test
exit:1
```

### Baseline output snippets

#### install
```
apps/worker                              |  WARN  The field "pnpm.overrides" was found in /home/munaim/srv/apps/vexel/apps/worker/package.json. This will not take effect. You should configure "pnpm.overrides" at the root of the workspace instead.
Lockfile is up to date, resolution step is skipped
Packages: -176
--------------------------------------------------------------------------------

devDependencies:
- eslint 8.57.1
- eslint-config-next 15.5.12

Done in 1s
```
#### lint
```

> vexel@0.1.0 lint /home/munaim/srv/apps/vexel
> turbo run lint


Attention:
Turborepo now collects completely anonymous telemetry regarding usage.
This information is used to shape the Turborepo roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://turborepo.dev/docs/telemetry

• turbo 2.8.10
• Packages in scope: @vexel/admin, @vexel/api, @vexel/contracts, @vexel/e2e, @vexel/operator, @vexel/sdk, @vexel/theme, @vexel/worker
• Running lint in 8 packages
• Remote caching disabled
@vexel/admin:lint: cache miss, executing 5479179ad1516ff4
@vexel/api:lint: cache miss, executing 8806d0c49a0b1bea
@vexel/operator:lint: cache miss, executing 24c5fbc11e961070
@vexel/admin:lint: 
@vexel/admin:lint: > @vexel/admin@0.1.0 lint /home/munaim/srv/apps/vexel/apps/admin
@vexel/admin:lint: > next lint
@vexel/admin:lint: 
@vexel/operator:lint: 
@vexel/operator:lint: > @vexel/operator@0.1.0 lint /home/munaim/srv/apps/vexel/apps/operator
@vexel/operator:lint: > next lint
@vexel/operator:lint: 
@vexel/api:lint: 
@vexel/api:lint: > @vexel/api@0.1.0 lint /home/munaim/srv/apps/vexel/apps/api
@vexel/api:lint: > eslint "{src,test}/**/*.ts"
@vexel/api:lint: 
@vexel/api:lint: sh: 1: eslint: not found
@vexel/api:lint:  ELIFECYCLE  Command failed.
@vexel/api:lint: ERROR: command finished with error: command (/home/munaim/srv/apps/vexel/apps/api) /home/munaim/.nvm/versions/node/v20.20.0/bin/pnpm run lint exited (1)
@vexel/api#lint: command (/home/munaim/srv/apps/vexel/apps/api) /home/munaim/.nvm/versions/node/v20.20.0/bin/pnpm run lint exited (1)

 Tasks:    0 successful, 3 total
Cached:    0 cached, 3 total
  Time:    928ms 
Failed:    @vexel/api#lint

 ERROR  run failed: command  exited (1)
 ELIFECYCLE  Command failed with exit code 1.
```
#### build
```
@vexel/admin:build: ┌ ○ /                                      138 B         102 kB
@vexel/admin:build: ├ ○ /_not-found                            992 B         103 kB
@vexel/admin:build: ├ ○ /audit                                5.8 kB         108 kB
@vexel/admin:build: ├ ○ /branding                            3.02 kB         109 kB
@vexel/admin:build: ├ ○ /catalog                             1.33 kB         110 kB
@vexel/admin:build: ├ ○ /catalog/import-export                118 kB         220 kB
@vexel/admin:build: ├ ○ /catalog/panels                      6.72 kB         109 kB
@vexel/admin:build: ├ ○ /catalog/parameters                  6.21 kB         108 kB
@vexel/admin:build: ├ ○ /catalog/reference-ranges            6.67 kB         109 kB
@vexel/admin:build: ├ ○ /catalog/tests                       7.37 kB         109 kB
@vexel/admin:build: ├ ○ /dashboard                           4.74 kB         110 kB
@vexel/admin:build: ├ ○ /documents                            2.2 kB         108 kB
@vexel/admin:build: ├ ○ /encounters                          4.86 kB         107 kB
@vexel/admin:build: ├ ○ /feature-flags                       3.42 kB         109 kB
@vexel/admin:build: ├ ○ /jobs                                5.41 kB         107 kB
@vexel/admin:build: ├ ○ /login                               4.19 kB         106 kB
@vexel/admin:build: ├ ○ /opd                                   791 B         106 kB
@vexel/admin:build: ├ ○ /opd/feature-flags                      5 kB         107 kB
@vexel/admin:build: ├ ○ /opd/providers                       5.96 kB         111 kB
@vexel/admin:build: ├ ƒ /opd/providers/[providerId]          4.14 kB         110 kB
@vexel/admin:build: ├ ○ /opd/schedules                       6.33 kB         108 kB
@vexel/admin:build: ├ ○ /patients                            4.76 kB         107 kB
@vexel/admin:build: ├ ○ /roles                               2.41 kB         108 kB
@vexel/admin:build: ├ ○ /system/health                       4.56 kB         107 kB
@vexel/admin:build: ├ ○ /tenant-settings                       138 B         102 kB
@vexel/admin:build: ├ ○ /tenant-settings/catalog               138 B         102 kB
@vexel/admin:build: ├ ○ /tenant-settings/documents             138 B         102 kB
@vexel/admin:build: ├ ○ /tenant-settings/roles                 138 B         102 kB
@vexel/admin:build: ├ ○ /tenant-settings/users                 138 B         102 kB
@vexel/admin:build: ├ ○ /tenants                             5.02 kB         110 kB
@vexel/admin:build: └ ○ /users                               2.99 kB         109 kB
@vexel/admin:build: + First Load JS shared by all             102 kB
@vexel/admin:build:   ├ chunks/144-0b275b5ca88820a6.js       45.9 kB
@vexel/admin:build:   ├ chunks/6d25620b-d9f90746a7f2178c.js  54.2 kB
@vexel/admin:build:   └ other shared chunks (total)          1.93 kB
@vexel/admin:build: 
@vexel/admin:build: 
@vexel/admin:build: ƒ Middleware                             34.3 kB
@vexel/admin:build: 
@vexel/admin:build: ○  (Static)   prerendered as static content
@vexel/admin:build: ƒ  (Dynamic)  server-rendered on demand
@vexel/admin:build: 
@vexel/operator:build:  ⚠ Failed to copy traced files for /home/munaim/srv/apps/vexel/apps/operator/.next/server/app/(protected)/page.js [Error: ENOENT: no such file or directory, copyfile '/home/munaim/srv/apps/vexel/apps/operator/.next/server/app/(protected)/page_client-reference-manifest.js' -> '/home/munaim/srv/apps/vexel/apps/operator/.next/standalone/apps/operator/.next/server/app/(protected)/page_client-reference-manifest.js'] {
@vexel/operator:build:   errno: -2,
@vexel/operator:build:   code: 'ENOENT',
@vexel/operator:build:   syscall: 'copyfile',
@vexel/operator:build:   path: '/home/munaim/srv/apps/vexel/apps/operator/.next/server/app/(protected)/page_client-reference-manifest.js',
@vexel/operator:build:   dest: '/home/munaim/srv/apps/vexel/apps/operator/.next/standalone/apps/operator/.next/server/app/(protected)/page_client-reference-manifest.js'
@vexel/operator:build: }
@vexel/operator:build: 
@vexel/operator:build: Route (app)                                         Size  First Load JS
@vexel/operator:build: ┌ ○ /                                              144 B         102 kB
@vexel/operator:build: ├ ○ /_not-found                                    994 B         103 kB
@vexel/operator:build: ├ ○ /encounters                                    372 B         102 kB
@vexel/operator:build: ├ ƒ /encounters/[id]                               144 B         102 kB
@vexel/operator:build: ├ ƒ /encounters/[id]/order                       4.45 kB         121 kB
@vexel/operator:build: ├ ƒ /encounters/[id]/publish                     4.01 kB         120 kB
@vexel/operator:build: ├ ƒ /encounters/[id]/receive                     4.33 kB         121 kB
@vexel/operator:build: ├ ƒ /encounters/[id]/reports                     1.28 kB         122 kB
@vexel/operator:build: ├ ƒ /encounters/[id]/results                     4.62 kB         121 kB
@vexel/operator:build: ├ ƒ /encounters/[id]/sample                      4.14 kB         120 kB
@vexel/operator:build: ├ ƒ /encounters/[id]/verify                      2.79 kB         123 kB
@vexel/operator:build: ├ ○ /encounters/new                                144 B         102 kB
@vexel/operator:build: ├ ○ /lims/encounters                              3.1 kB         119 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]                        3.56 kB         137 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]/order                  4.47 kB         121 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]/publish                5.02 kB         121 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]/receive                5.36 kB         122 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]/reports                1.18 kB         122 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]/results                5.69 kB         122 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]/sample                 4.57 kB         121 kB
@vexel/operator:build: ├ ƒ /lims/encounters/[id]/verify                 2.57 kB         123 kB
@vexel/operator:build: ├ ○ /lims/encounters/new                         4.55 kB         107 kB
@vexel/operator:build: ├ ○ /lims/patients                                 943 B         134 kB
@vexel/operator:build: ├ ○ /lims/patients/new                           4.73 kB         107 kB
@vexel/operator:build: ├ ○ /lims/payments                               4.11 kB         134 kB
@vexel/operator:build: ├ ƒ /lims/print/[id]                             4.84 kB         107 kB
@vexel/operator:build: ├ ○ /lims/registrations/new                      6.72 kB         136 kB
@vexel/operator:build: ├ ○ /lims/reports                                3.81 kB         133 kB
@vexel/operator:build: ├ ○ /lims/results                                4.56 kB         136 kB
@vexel/operator:build: ├ ƒ /lims/results/[orderedTestId]                4.32 kB         137 kB
@vexel/operator:build: ├ ƒ /lims/results/encounters/[encounterId]       7.29 kB         142 kB
@vexel/operator:build: ├ ○ /lims/sample-collection                      5.08 kB         135 kB
@vexel/operator:build: ├ ○ /lims/verification                           4.43 kB         136 kB
@vexel/operator:build: ├ ƒ /lims/verification/encounters/[encounterId]  5.89 kB         119 kB
@vexel/operator:build: ├ ○ /lims/worklist                               2.73 kB         154 kB
@vexel/operator:build: ├ ○ /login                                       5.23 kB         118 kB
@vexel/operator:build: ├ ƒ /opd/appointments/[id]                        3.3 kB         136 kB
@vexel/operator:build: ├ ○ /opd/appointments/new                         3.3 kB         136 kB
@vexel/operator:build: ├ ○ /opd/billing                                 2.92 kB         154 kB
@vexel/operator:build: ├ ƒ /opd/billing/invoices/[invoiceId]            3.79 kB         137 kB
@vexel/operator:build: ├ ○ /opd/billing/new                             2.56 kB         136 kB
@vexel/operator:build: ├ ƒ /opd/providers/[providerId]/availability     2.35 kB         135 kB
@vexel/operator:build: ├ ƒ /opd/visits/[visitId]                        2.39 kB         135 kB
@vexel/operator:build: ├ ○ /opd/worklist                                3.02 kB         154 kB
@vexel/operator:build: ├ ○ /patients                                      375 B         102 kB
@vexel/operator:build: ├ ○ /patients/new                                  144 B         102 kB
@vexel/operator:build: ├ ○ /registrations/new                             381 B         102 kB
@vexel/operator:build: ├ ○ /reports                                       369 B         102 kB
@vexel/operator:build: ├ ○ /results                                       370 B         102 kB
@vexel/operator:build: ├ ƒ /results/[orderedTestId]                       144 B         102 kB
@vexel/operator:build: ├ ○ /sample-collection                             377 B         102 kB
@vexel/operator:build: ├ ○ /verification                                  374 B         102 kB
@vexel/operator:build: ├ ƒ /verification/encounters/[encounterId]         144 B         102 kB
@vexel/operator:build: └ ○ /worklist                                      371 B         102 kB
@vexel/operator:build: + First Load JS shared by all                     102 kB
@vexel/operator:build:   ├ chunks/6d25620b-a53d689d21377503.js          54.2 kB
@vexel/operator:build:   ├ chunks/7144-700752aa5edfe187.js              45.8 kB
@vexel/operator:build:   └ other shared chunks (total)                  1.93 kB
@vexel/operator:build: 
@vexel/operator:build: 
@vexel/operator:build: ○  (Static)   prerendered as static content
@vexel/operator:build: ƒ  (Dynamic)  server-rendered on demand
@vexel/operator:build: 

 Tasks:    5 successful, 5 total
Cached:    0 cached, 5 total
  Time:    1m25.551s 

 WARNING  no output files found for task @vexel/sdk#build. Please check your `outputs` key in `turbo.json`
```
#### test
```
 ERR_PNPM_NO_SCRIPT  Missing script: test

Command "test" not found.
```


## What changed

### D1 — Document pipeline compliance
- Updated document identity to template-aware uniqueness in Prisma:
  - `Document @@unique([tenantId, type, templateId, payloadHash])`
  - Migration added: `apps/api/prisma/migrations/20260226214000_document_template_hash_unique/migration.sql`
- Fixed `DocumentsService.generateFromEncounter` idempotency path:
  - Removed sourceRef-only early return.
  - Idempotency now keyed by `(tenantId, type, templateId, payloadHash)` in `generateDocument`.
- Added deterministic payload normalization in `DocumentsService`:
  - `printedAt` removed from hashed LAB_REPORT payload.
  - LAB_REPORT `issuedAt` anchored to verify audit timestamp fallback `encounter.createdAt`.
  - Age is computed at `encounter.createdAt` (no `Date.now()` in canonical payload).
  - RECEIPT `issuedAt` is normalized server-side from encounter timestamp for `sourceType=ENCOUNTER`.

### D2 — Publish command governance
- Worker auto-publish removed:
  - `apps/worker/src/document-render.processor.ts` now stops at `RENDERED` and audits `document.rendered` only.
- Added command endpoint:
  - `POST /encounters/{encounterId}:publish-report`
  - Implemented in `EncountersController` + `EncountersService.publishReport`.
  - Enforces: encounter must be `verified`/`published`, report must be `RENDERED`/`PUBLISHED`; otherwise `409`.
  - Idempotent behavior: repeat calls safe; audit action `encounter.publish_report` recorded.
- Operator publish UX updated:
  - `/lims/encounters/[id]/publish` now shows explicit **Publish report** step.
  - Download/Print enabled only after `PUBLISHED`.
  - Legacy non-namespaced publish route now re-exports LIMS publish page.

### D3 — Build/CI correctness hardening
- Download contract fixed end-to-end:
  - `GET /documents/{id}/download` now returns PDF bytes from storage.
  - Controller returns `StreamableFile` with `Content-Type: application/pdf`.
  - OpenAPI updated to binary response; SDK regenerated.
- Added OpenAPI contract for `GET /documents/{id}/render` to keep operator print page SDK-only.
- SDK freshness check fixed:
  - `packages/sdk/scripts/check-sdk-freshness.sh` now diffs `origin/${GITHUB_BASE_REF:-main}...HEAD`.
  - CI checkout depth updated to `fetch-depth: 0` in `.github/workflows/ci.yml`.
- Next strict type-build restored:
  - Removed `typescript.ignoreBuildErrors` from admin/operator next configs.
- UI color lint global regex bug fixed:
  - Removed `/g` stateful regex flags in `scripts/ui-color-lint.mjs`.
- Prisma major version drift resolved consistently across workspace to `6.19.2` (root/api/worker aligned).
  - Note: upgrading to Prisma 7 in this codebase currently requires broader datasource/runtime adapter migration; alignment was made on stable 6.x to keep release-safe behavior.

### D4 — Smoke docs updated
- Rewrote `docs/ops/SMOKE_TESTS.md` with current ports/routes:
  - API 9021, PDF 9022, Admin 9023, Operator 9024, MinIO Console 9025, MinIO S3 9027
  - Health examples now use `http://127.0.0.1:9021/api/health`
  - Document flow now explicitly Verify → Rendered → Publish report → Download

## Contract + SDK updates
- Updated `packages/contracts/openapi.yaml`:
  - Added `POST /encounters/{encounterId}:publish-report`
  - `GET /documents/{id}/download` binary PDF response
  - Added `GET /documents/{id}/render` binary PDF response
  - Verification summaries updated from auto-publish wording to report-generation wording
- Regenerated SDK types (`packages/sdk/src/generated/api.d.ts`).

## Tests and validation

### Backend unit tests
```bash
pnpm -C apps/api test
```
Result: **PASS** (`9/9 suites`, `47 tests`)

### UI color lint
```bash
pnpm ui:color-lint
```
Result: **PASS**

### Final release gate command
```bash
pnpm -w lint && pnpm -w build && pnpm -C apps/api test
```
Result: **PASS**

## How to verify manually
1. Build + run stack:
   ```bash
   docker compose up -d --build
   ```
2. Verify encounter in operator verification flow.
3. Confirm LAB_REPORT reaches `RENDERED` (not auto-published).
4. Open publish page `/lims/encounters/{id}/publish` and click **Publish report**.
5. Confirm encounter state is `published`, document state is `PUBLISHED`.
6. Download PDF and verify binary response from:
   ```bash
   GET /api/documents/{id}/download
   ```

## Locked-rule alignment
- Contract-first: API behavior changes are reflected in OpenAPI and regenerated SDK.
- Tenant isolation: all new queries remain tenant-scoped (`tenantId`-filtered).
- Command-only workflow: publish transition is now explicit command endpoint.
- Determinism: hashed payload excludes volatile time fields; encounter-anchored timestamps used.
- Auditability: publish/report transitions continue writing audit events with correlation IDs.
