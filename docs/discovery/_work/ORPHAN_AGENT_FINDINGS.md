# Stage 3 Draft — Orphan, Dormant, Legacy, Duplicate, and Reusable Code

> Agent work product for central reconciliation. Evidence snapshot: `main` at
> `1ffda42e90a77ed86d87486ad0ac7a12dc35e477` on 2026-09-01. No application code
> was changed and no candidate was deleted. The worktree was initially clean;
> `apps/admin/tsconfig.tsbuildinfo`, `apps/operator/tsconfig.tsbuildinfo`, and live
> `apps/e2e` Playwright report/result files became modified during concurrent audit
> activity and are not changes made by this pass.

## Method and caution

This pass inspected current imports, Next route roots and navigation, Nest module/controller
registration, BullMQ producers/consumers, Prisma schema and migration history, frontend
consumers, current tests, root scripts, Docker/CI references, and generated/OpenAPI references.
Static non-reference alone was not treated as proof of dead code: Next page files, Nest
decorator registration, package exports, migrations, generated SDK files, shell entrypoints,
and manual operational scripts all have non-import reachability mechanisms.

The classification count below is by material candidate/group, not by file:

| Classification | Count |
| --- | ---: |
| ACTIVE | 3 |
| DORMANT-BUT-VALID | 3 |
| REUSABLE | 2 |
| REUSABLE-WITH-REFACTOR | 1 |
| DUPLICATE | 5 |
| SUPERSEDED | 3 |
| INCOMPATIBLE-LEGACY | 4 |
| DEAD | 4 |
| UNCERTAIN | 1 |
| **Total material groups** | **26** |

## Material inventory

### ORPHAN-001 — Superseded Operator sidebar

- **Classification:** DUPLICATE
- **Component:** `apps/operator/src/components/sidebar.tsx`
- **Evidence:** No current source import was found. The protected LIMS and OPD layouts use
  `components/shell/app-shell.tsx`, which uses `components/nav/sidebar.tsx`. The old component
  contains unnamespaced links such as `/registrations/new`, `/sample-collection`, `/results`,
  `/encounters`, and `/patients`, contrary to the locked `/lims/*` namespace, and an inline-style
  legacy shell.
- **Canonical implementation:** `apps/operator/src/components/nav/sidebar.tsx` through
  `components/shell/app-shell.tsx`.
- **Compatibility/reuse:** Do not integrate it; all useful behavior (feature-aware navigation,
  logout, sidebar) is represented more completely in the canonical shell.
- **Removal safety:** **HIGH**, after one clean Operator build and route smoke. No import, route,
  test, Docker, or package export reference was found.

### ORPHAN-002 — PublicShell exists but login duplicates it

- **Classification:** REUSABLE
- **Component:** `apps/operator/src/components/shell/public-shell.tsx`
- **Evidence:** No source import. `apps/operator/src/app/login/page.tsx` repeats its branded
  outer wrapper/header markup directly. The governance baseline explicitly requires public pages
  to render inside `PublicShell`.
- **Recommended action:** Wrap login in `PublicShell` and remove the duplicated page shell markup.
- **Compatibility:** Fully compatible with current Next architecture and theme tokens; no API,
  tenancy, permission, or SDK effect.
- **Removal safety:** Not a removal candidate. **HIGH** confidence reuse opportunity.

### ORPHAN-003 — Unused Admin PermissionGuard

- **Classification:** REUSABLE
- **Component:** `apps/admin/src/components/permission-guard.tsx`
- **Evidence:** No current import; it is a complete guard over `useCurrentUser`, with `anyOf`,
  `allOf`, fallback, and loading behavior. Current page/sidebar visibility logic is dispersed.
- **Recommended action:** Evaluate it when consolidating page-level authorization UX, but do not
  mistake client hiding for backend authorization.
- **Compatibility:** Compatible with current auth/RBAC presentation. Backend guards remain the
  authority.
- **Removal safety:** Not a removal candidate. **MEDIUM** confidence reuse; first define which
  pages need client-side permission fallback.

### ORPHAN-004 — Duplicate shared status-badge primitive

- **Classification:** DUPLICATE
- **Component:** `packages/theme/src/status-badge.tsx`
- **Evidence:** No application imports `StatusBadge` from `@vexel/theme`; applications use
  `@vexel/ui-system`. `@vexel/theme` remains active for
  `styles/neoslate-ember.css`, but its TypeScript badge has a separate tone vocabulary
  (`info/warning/success/destructive`) from the canonical UI-system primitive
  (`blue/amber/green/red`).
- **Canonical implementation:** `packages/ui-system/StatusBadge.tsx`.
- **Recommended action:** Preserve theme CSS; remove or explicitly deprecate only the unused
  TypeScript export after confirming no external workspace consumer.
- **Removal safety:** **HIGH** inside this monorepo; **MEDIUM** if unpublished external consumers
  are possible.

### ORPHAN-005 — Two active Operator status-mapping wrappers

- **Classification:** DUPLICATE
- **Components:** `apps/operator/src/components/status-badge.tsx` and
  `apps/operator/src/components/app/status-badge.tsx`
- **Evidence:** Both wrap `@vexel/ui-system`, both define Encounter and Document mappings, but
  labels and fallback coverage differ. Both currently have consumers (direct component imports
  versus the `components/app/index.ts` barrel).
- **Canonical implementation:** Choose `components/app/status-badge.tsx` because the locked UI
  governance names `components/app/*` wrappers, then add `FlagBadge` before migrating direct
  consumers.
- **Removal safety:** **LOW today** because both are ACTIVE; **HIGH after** import migration and
  behavior tests. Consolidation is nontrivial because mappings are not identical.

### ORPHAN-006 — Tenant-settings compatibility redirects

- **Classification:** SUPERSEDED
- **Components:** Admin routes `/tenant-settings`, `/tenant-settings/catalog`,
  `/tenant-settings/documents`, `/tenant-settings/roles`, `/tenant-settings/users`.
- **Evidence:** Every page contains only a server redirect and comments that the hub was removed
  or restructured. No live navigation references were found.
- **Canonical implementations:** `/tenants`, `/catalog`, `/documents`, `/roles`, `/users`.
- **Recommended action:** Retain temporarily only if bookmarks/backward route compatibility is an
  explicit product requirement. The locked baseline says no legacy compatibility, so otherwise
  schedule removal after access-log review.
- **Removal safety:** **MEDIUM**; code references are absent, but external bookmarks cannot be
  proven from repository evidence.

### ORPHAN-007 — Admin OPD navigation points to nonexistent pages

- **Classification:** DEAD
- **Component:** Entries `/opd/providers` and `/opd/schedules` in
  `apps/admin/src/lib/admin-nav.ts`.
- **Evidence:** Only `/opd`, `/opd/doctors`, and `/opd/feature-flags` page files exist. No providers
  or schedules Admin route exists. The links can be displayed based on permissions and therefore
  create reachable 404s.
- **Recommended action:** Remove/hide these nav entries until corresponding canonical pages exist,
  or implement the pages during the OPD contract-first sprint. Do not retain broken navigation as
  a feature placeholder.
- **Removal safety:** **HIGH** for the nav entries; no route exists to lose.

### ORPHAN-008 — Phantom BullMQ `jobs` queue

- **Classification:** INCOMPATIBLE-LEGACY
- **Components:** `apps/api/src/jobs/jobs.service.ts`, `/jobs*` endpoints, and the Admin Jobs and
  Dashboard BullMQ metrics sections.
- **Evidence:** `JobsService` opens only queue `jobs`. Current worker registers only
  `catalog-import`, `catalog-export`, `document-render`, and `ops-backup`; API producers enqueue
  only those four queue names. `apps/worker/src/main.ts` explicitly documents that nothing
  enqueues to `jobs` and that it will always appear empty. Admin nevertheless labels this data
  “All BullMQ Jobs,” “Failed BullMQ Jobs,” and “Worker Queue Depth,” and offers retry against the
  phantom queue.
- **Release/architecture impact:** Active observability is misleading and cannot show or retry
  real queue failures. This is not harmless orphan code because it is wired into production UI.
- **Recommended action:** Replace `JobsService` with a tenant-safe multi-queue registry over the
  actual queues (with explicit per-queue authorization/data redaction) and keep a single canonical
  monitoring surface. Then retire the `jobs` queue assumption.
- **Removal safety:** **LOW** for endpoints/UI because they are active consumers; **HIGH** for the
  literal phantom queue after replacement.

### ORPHAN-009 — Unsupported `ops.storage_target.test` job

- **Classification:** INCOMPATIBLE-LEGACY
- **Components:** `OpsService` enqueue at `apps/api/src/ops/ops.service.ts:522` and
  `processOpsBackup`.
- **Evidence:** API adds `ops.storage_target.test` to `ops-backup` with `{ targetId }` only.
  `processOpsBackup` immediately requires `job.data.runId`, loads an `OpsBackupRun`, and only
  dispatches by run type `FULL`, `TENANT_EXPORT`, `RESTORE`, or `HEALTHCHECK`. There is no
  storage-target-test handler despite the processor header claiming support.
- **Recommended action:** Give storage target testing its own audited handler/job shape, or run it
  through a real OpsBackupRun type. Add producer-consumer contract tests.
- **Removal safety:** Not a deletion candidate while UI/API exposes the operation. **HIGH**
  confidence defect.

### ORPHAN-010 — Mobile application scaffold

- **Classification:** REUSABLE-WITH-REFACTOR
- **Component:** `apps/mobile`
- **Evidence:** Expo app contains login/module/status routes, but LIMS and OPD dashboards consume
  hard-coded `getLimsStatusMock()` / `getOpdStatusMock()`. Its own TODO says to replace mocks with
  generated SDK calls. It does not depend on `@vexel/sdk`, is excluded explicitly from root
  build/dev/lint/typecheck, has no Docker service, and historical current ops documentation calls
  it a non-MVP scaffold.
- **Compatibility:** UI/theme ideas and Expo routing are reusable. It cannot accelerate release
  workflow without adding SDK/auth/refresh/tenant/feature-flag integration and real tests.
- **Recommended action:** Keep dormant outside release scope; before activation, add it to CI and
  enforce the same generated-SDK, auth, tenancy, flags, and no-fake-state rules.
- **Removal safety:** Do not remove. **HIGH** confidence future scaffold; no evidence authorizes
  abandonment.

### ORPHAN-011 — Planned feature-flag definitions

- **Classification:** DORMANT-BUT-VALID
- **Component:** Registry entries with `status: 'planned'`, including LIMS QC/delta/outsource/
  microbiology/blood-bank and OPD appointments/scheduling/vitals/clinical-note/free-text/
  billing/receipt flags.
- **Evidence:** Registry comments explicitly define planned entries as placeholders that cannot be
  toggled. They are filtered through definition metadata and default false.
- **Recommended action:** Retain as roadmap metadata only if Admin continues preventing mutation.
  Reconcile misleading entries whose backend capabilities now exist (canonical OPD appointments,
  schedules, vitals, notes, billing) before calling the registry authoritative.
- **Removal safety:** Not removable solely for being unused. **HIGH** confidence dormant intent.

### ORPHAN-012 — Deprecated feature flags

- **Classification:** SUPERSEDED
- **Components:** `lims.auto_verify`, `lims.print_results`, and
  `lims.operator.verificationPages.enabled`.
- **Evidence:** Registry explicitly marks them deprecated and identifies replacements; definition
  API filters them out. They remain in defaults/resolution for database migration reference.
- **Recommended action:** Inventory tenant rows, migrate/delete rows under a controlled data
  migration, then remove registry entries. Do not simply delete definitions first.
- **Removal safety:** **MEDIUM**, dependent on live TenantFeature data audit.

### ORPHAN-013 — Historical OPD retirement migration

- **Classification:** SUPERSEDED
- **Component:** migration `20260828143500_retire_legacy_opd` and the retired table family
  `providers`, `provider_schedules`, `appointments`, `opd_visits`, `opd_vitals`,
  `opd_clinical_notes`, and `opd_prescriptions`.
- **Evidence:** Migration drops the old table family and `invoices.opdVisitId`; current Prisma
  schema exposes canonical `OpdDoctor`, `OpdSchedule`, `OpdAppointment`, `OpdEncounter`,
  `OpdVital`, `OpdNote`, and canonical prescription models. Current service tests explicitly
  assert no retired `opdVisitId` linkage.
- **Recommended action:** Retain migration history permanently. Do not “clean up” historical
  migration SQL; it is required to reproduce database state.
- **Removal safety:** **NONE**; migrations are not removable orphan code.

### ORPHAN-014 — Deprecated single-item LIMS commands remain active

- **Classification:** DUPLICATE
- **Components:** `/encounters/{encounterId}:verify` versus
  `/verification/encounters/{encounterId}:verify`, and
  `/encounters/{encounterId}:receive-specimen` versus batch
  `/encounters/{encounterId}:receive-specimens`.
- **Evidence:** OpenAPI marks the old verify operation deprecated; the legacy encounter verify
  page still calls it while verification-board pages call the canonical endpoint. Encounter
  sample/receive pages still call singular receive, while the sample-collection board calls the
  canonical batch endpoint. Both families are mounted and implemented.
- **Recommended action:** Migrate remaining pages/tests to canonical command services, verify audit
  and transition semantics are identical, then remove the deprecated routes in a contract-first
  change.
- **Removal safety:** **LOW now**, because production pages consume them; **MEDIUM after** consumer
  migration and full E2E.

### ORPHAN-015 — Duplicate catalog import/export route families

- **Classification:** DUPLICATE
- **Components:** synchronous `/catalog/import`, `/catalog/import/workbook`, `/catalog/export`,
  `/catalog/export/workbook.xlsx`, their `/admin/catalog/*` aliases, and async import/export jobs.
- **Evidence:** `CatalogController` is mounted at both `catalog` and `admin/catalog`; it exposes two
  sync import and two sync export shapes. `CatalogJobsController` is also dual-mounted. Current
  Admin UI uses synchronous `/catalog/import/workbook` but asynchronous `/catalog/export-jobs`.
  OpenAPI labels `/catalog/import` and `/catalog/export` legacy, while the stated summary that the
  current UI uses those exact legacy operations is stale.
- **Canonical implementation:** Async job family for operations requiring jobs/retry/visibility;
  decide separately whether dry-run workbook validation remains synchronous.
- **Removal safety:** **MEDIUM** for exact unused legacy aliases after API-access-log and test
  review; **LOW** for `/catalog/import/workbook`, which is an active UI dependency.

### ORPHAN-016 — Active legacy catalog storage fields

- **Classification:** INCOMPATIBLE-LEGACY
- **Components:** `CatalogTest.sampleType` (“legacy field kept for compat”), parallel
  `sampleTypeId`/`specimenType`, and `LabResult.parameterId` nullable “for legacy single-value
  results.”
- **Evidence:** Prisma comments explicitly claim compatibility; current catalog import, worker,
  DTO output, and document payload logic still read/write fallback string fields. Null
  `parameterId` is still handled in document generation. This is an active compatibility layer,
  contrary to the locked “No legacy compatibility” rule.
- **Recommended action:** First measure live rows and define canonical ownership, then backfill,
  make services and contract canonical-only, add constraints, and remove fallback columns in a
  migration. Never drop columns based on static inspection alone.
- **Removal safety:** **LOW**; active data and workflows depend on them.

### ORPHAN-017 — Duplicated legacy Admin permission compatibility

- **Classification:** INCOMPATIBLE-LEGACY
- **Components:** `LEGACY_ADMIN_ACCESS_PERMISSIONS` in API account service and duplicate
  `legacyAdminAccessPermissions` in Admin `admin-access.ts`.
- **Evidence:** Both lists grant Admin-app access based on old non-`admin.*` permissions, duplicate
  the same policy in backend and frontend, and are actively evaluated. The contract baseline says
  no legacy compatibility and backend authority must prevail.
- **Recommended action:** Define one backend-authoritative Admin-access policy/contract, migrate
  roles to canonical permissions, then remove frontend policy duplication and legacy fallback.
- **Removal safety:** **LOW** until seeded and live roles are migrated and authorization tests prove
  intended access.

### ORPHAN-018 — Hard-coded historical Admin screenshot script

- **Classification:** DEAD
- **Component:** `scripts/audit-admin-ui.ts`
- **Evidence:** No package/CI/ops reference; hard-codes credentials, a dated verification output
  directory, pre-basePath localhost URLs, and selectors/navigation that do not match current login
  markup (`input[name=...]` is absent). It is not part of current Playwright configuration.
- **Recommended action:** Preserve any needed test intent in Playwright specs; then remove the
  script. Credentials should not live in utility scripts even when demo-only.
- **Removal safety:** **HIGH**.

### ORPHAN-019 — Transfer-branch artifact restore script

- **Classification:** UNCERTAIN
- **Component:** `scripts/pull-transfer-artifacts.sh`
- **Evidence:** No current package/CI/ops documentation reference found. It destructively switches
  branches and extracts an ignored-artifact archive from a special transfer branch. It may be a
  one-off server migration tool, but repository evidence cannot prove it is obsolete.
- **Recommended action:** Ask the infrastructure owner whether the transfer workflow is retired;
  move to archived ops documentation if retained.
- **Removal safety:** **LOW**. Do not remove without owner confirmation.

### ORPHAN-020 — Tracked transient build/test output at live app paths

- **Classification:** DEAD
- **Components:** `apps/admin/tsconfig.tsbuildinfo`, `apps/operator/tsconfig.tsbuildinfo`,
  `apps/e2e/playwright-report/index.html`, and `apps/e2e/test-results/*`.
- **Evidence:** 164 tracked paths matched build/test-output patterns overall; many are intentionally
  preserved under dated documentation evidence, but these live-path artifacts are regenerated by
  typecheck/Playwright and `.gitignore` already ignores Playwright live output. The two tsbuildinfo
  files changed during this audit without source edits, demonstrating churn.
- **Recommended action:** Untrack only the live-path transient artifacts and add `*.tsbuildinfo` to
  ignore. Preserve dated evidence under `docs/**` as historical records.
- **Removal safety:** **HIGH** for the four live artifact groups; do not bulk-delete matched
  `docs/**` evidence.

### ORPHAN-021 — Mock gateway and fixtures

- **Classification:** DORMANT-BUT-VALID
- **Components:** `scripts/mock-gateway`, `scripts/mock-smoke.js`, and `docs/mocks/fixtures`.
- **Evidence:** Root scripts `mock:api`, `dev:ui-mock`, and `mock:smoke` reference the gateway;
  Docker Compose has a mock profile. This is intentional contract-first UI infrastructure, not a
  production path.
- **Recommended action:** Retain; ensure production Compose/profile and production environment do
  not enable mock services or `x-mock-scenario` behavior.
- **Removal safety:** Not a removal candidate. **HIGH** confidence intentional dormancy.

### ORPHAN-022 — Historical discovery/audit/runtime evidence

- **Classification:** DORMANT-BUT-VALID
- **Components:** `docs/_audit`, `docs/_discovery`, `docs/_fresh_audit`, `docs/_implementation`,
  `docs/_verification`, and `docs/archive` (about 35 MB combined).
- **Evidence:** These directories are not executable input but preserve prior claims, traces,
  reports, and incident evidence. Current instructions explicitly require historical context not
  be overwritten.
- **Recommended action:** Retain, clearly date/label as historical, and link from a small index.
  Consider artifact storage outside Git in a separate maintenance task, preserving immutable
  hashes and discoverability.
- **Removal safety:** **LOW**; bulk deletion would destroy audit evidence.

### ORPHAN-023 — Canonical current UI-system/theme CSS packages

- **Classification:** ACTIVE
- **Components:** `packages/ui-system` and `packages/theme/styles/neoslate-ember.css`.
- **Evidence:** Both Admin and Operator depend on/transpile these workspaces; UI-system components
  are imported widely and its tokens feed Tailwind; both apps import the theme CSS.
- **Recommended action:** Treat UI-system as canonical for components and theme as canonical for
  CSS tokens. This boundary resolves ORPHAN-004.
- **Removal safety:** Not removable.

### ORPHAN-024 — Canonical API modules and worker processors

- **Classification:** ACTIVE
- **Components:** All modules imported by `apps/api/src/app.module.ts`; current worker processors
  imported/registered in `apps/worker/src/main.ts`.
- **Evidence:** Nest modules are decorator-registered rather than referenced from arbitrary source;
  worker processors are explicit `Worker` callbacks. These must not be labeled orphan by a simple
  export/import tool.
- **Recommended action:** Use AppModule and worker main as reachability roots in cleanup tooling.
- **Removal safety:** Not removable.

### ORPHAN-025 — Canonical OPD implementation after retirement

- **Classification:** ACTIVE
- **Components:** `apps/api/src/opd`, current canonical OPD Prisma models, Operator OPD pages, Admin
  doctors page, and OPD contract/SDK operations.
- **Evidence:** `OpdModule` is imported by AppModule; controller/service are mounted; Operator pages
  call generated SDK paths; schema models replaced the dropped legacy family. Exact release
  readiness is assessed in Stage 2, but this code is not orphan merely because feature flags can
  disable it.
- **Recommended action:** Reconcile and test rather than rewrite from retired implementations.
- **Removal safety:** Not removable.

### ORPHAN-026 — Stale Admin utility

- **Classification:** DEAD
- **Component:** `apps/admin/src/lib/utils.ts`
- **Evidence:** No current import was found. UI-system owns its own `cn` utility; Admin pages do not
  use this local helper.
- **Recommended action:** Remove after Admin typecheck/build.
- **Removal safety:** **HIGH**.

## Architectural drift findings surfaced by Stage 3

| ID | Finding | Evidence | Impact | Action |
| --- | --- | --- | --- | --- |
| ARCH-P0-ORPH-001 | Production job observability monitors a nonexistent `jobs` queue. | JobsService queue name versus worker/producer queue names; explicit warning in worker main. | Failures/depth/retry for real queues are invisible or misleading. | Implement actual multi-queue registry and tests. |
| ARCH-P1-ORPH-002 | Storage target test producer and processor contracts do not match. | API enqueues `{targetId}`; processor requires `{runId}`. | Reachable operation deterministically fails. | Add real handler/run type and contract test. |
| ARCH-P1-ORPH-003 | Active legacy compatibility remains in schema/service and permissions. | Explicit Prisma “legacy ... compat” comments and legacy Admin permission lists. | Violates locked no-legacy baseline and duplicates authority. | Data/role migration, then remove fallbacks. |
| ARCH-P1-ORPH-004 | Deprecated command endpoints remain used by current Operator pages. | Old verify and singular receive consumers coexist with canonical pages. | Duplicate transition semantics can drift. | Migrate consumers and retire old paths contract-first. |
| ARCH-P1-ORPH-005 | Admin OPD navigation exposes routes that do not exist. | `/opd/providers` and `/opd/schedules` nav entries; no page files. | Feature-enabled users hit 404. | Hide until real routes exist. |
| ARCH-P2-ORPH-006 | Operator login does not compose `PublicShell`. | Shell has zero imports; login duplicates shell HTML. | Violates permanent UI shell governance. | Reuse PublicShell. |
| ARCH-P2-ORPH-007 | Mobile scaffold is outside all root quality gates. | Root scripts explicitly filter `!@vexel/mobile`. | Dormant mock UI can look more complete than it is. | Keep out of release or add full SDK/CI closure. |
| ARCH-P2-ORPH-008 | Feature registry status is stale for several capabilities. | OPD appointment/scheduling/vitals/notes/billing flags say planned while canonical schema/service paths exist; `module.rad`/`module.ipd` say implemented without modules. | Admin flag metadata does not describe executable truth. | Reconcile status from capability matrix. |

## Reuse opportunities before new implementation

1. Use `PublicShell` for Operator public pages instead of writing another login shell.
2. Assess `PermissionGuard` as the standard client presentation guard, while retaining backend
   authorization as authoritative.
3. Reuse the current canonical OPD service/schema/UI work; never resurrect the dropped legacy OPD
   tables.
4. Reuse `packages/ui-system/StatusBadge` and consolidate only mapping wrappers.
5. The mobile scaffold can preserve Expo navigation and visual primitives, but only after generated
   SDK/auth/tenancy/flags integration; its mock dashboard data is not reusable business logic.

## Proposed eventual removal list (nothing removed in this audit)

### HIGH confidence

- `apps/operator/src/components/sidebar.tsx` after one build/smoke.
- Broken Admin nav entries `/opd/providers` and `/opd/schedules` (entries only).
- `packages/theme/src/status-badge.tsx` export, while retaining theme CSS.
- `scripts/audit-admin-ui.ts`.
- `apps/admin/src/lib/utils.ts`.
- Live-path tsbuildinfo and Playwright report/result artifacts after untracking/ignore update.

### MEDIUM confidence / prerequisite required

- Tenant-settings redirect pages after external access-log/bookmark window.
- Deprecated feature-flag definitions after TenantFeature row migration.
- Exact unused synchronous catalog aliases after access logs and contract consumer search.
- Deprecated LIMS command endpoints after all frontend/test consumers migrate.

### LOW confidence / do not automate

- Either active Operator status wrapper before behavior/import migration.
- `scripts/pull-transfer-artifacts.sh` without infrastructure-owner confirmation.
- Any historical migration or dated `docs/**` audit evidence.
- Active legacy schema fields before database profiling/backfill and contract migration.

## Verification required before cleanup PR

1. Generate a source/import graph using Next pages, Nest AppModule, worker main, package exports,
   shell scripts, migrations, and CI/Docker files as explicit roots.
2. Search production access logs for deprecated routes and compatibility redirects.
3. Query live TenantFeature rows for deprecated keys and database rows using legacy nullable/string
   catalog/result fields.
4. Run SDK freshness, API tests, Admin/Operator typecheck and builds, and route smoke.
5. Run LIMS E2E specifically through receive and verify after command consumer migration.
6. Add worker producer-consumer tests for every queue/job name and shape.
7. Confirm no external package consumers before removing exported theme primitives.
