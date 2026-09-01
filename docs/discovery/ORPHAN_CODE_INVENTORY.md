# Orphan, dormant, legacy and reusable code inventory

Counts are material candidate groups, not files:

| Classification | Count |
|---|---:|
| ACTIVE | 3 |
| DORMANT-BUT-VALID | 3 |
| REUSABLE | 2 |
| REUSABLE-WITH-REFACTOR | 1 |
| DUPLICATE | 5 |
| SUPERSEDED | 3 |
| INCOMPATIBLE-LEGACY | 4 |
| DEAD | 4 |
| UNCERTAIN | 1 |
| **Total** | **26** |

No code was deleted. Next pages, Nest decorators, workers, package exports, migrations, scripts, CI and Docker were treated as reachability roots to avoid naive false positives.

| ID | Module / Area | Finding | Evidence | Current State | Expected State | Severity | Release Impact | Recommended Action | Dependencies | Verification Required |
|---|---|---|---|---|---|---|---|---|---|---|
| ORPHAN-001 | Operator/nav | Old sidebar is unimported and contains unnamespaced legacy links. | Import search; AppShell uses nav/sidebar | DUPLICATE | Canonical AppShell nav only | Low | None now | Remove later | Route smoke | Build/nav test |
| ORPHAN-002 | Operator/shell | `PublicShell` is unused while login duplicates it. | Zero imports; login markup | REUSABLE | Public pages compose shell | Low | Governance only | Integrate shell | UI check | Login/auth E2E |
| ORPHAN-003 | Admin/RBAC UI | Complete PermissionGuard is unused. | Import search | REUSABLE | Consistent presentation guard | Low | None; backend stays authority | Evaluate/consolidate | Page policy | Permission UX tests |
| ORPHAN-004 | Shared UI | Theme TS badge duplicates UI-system badge. | Imports/exports/tone mismatch | DUPLICATE | UI-system canonical | Low | Maintenance | Deprecate/remove TS export | External consumer check | Workspace build |
| ORPHAN-005 | Operator/status | Two active status wrappers differ. | Both imported, mappings differ | DUPLICATE | One app wrapper | Medium | Visual/semantic drift | Migrate selectively | Mapping decision | Snapshot/route tests |
| ORPHAN-006 | Admin/routes | Tenant-settings pages are redirect-only compatibility routes. | Page bodies and nav search | SUPERSEDED | Canonical tenants/catalog/etc. | Low | Bookmark compatibility | Retain until log review | Access logs | No current consumers |
| ORPHAN-007 | Admin/OPD nav | Providers/schedules links target no pages. | Route inventory | DEAD | Hidden or implemented pages | Medium | Reachable 404 | Remove/hide entries now or implement later | OPD UI plan | Navigation E2E |
| ORPHAN-008 | Jobs/ops | Jobs service/UI observes phantom queue `jobs`. | Producers/workers use four other names | INCOMPATIBLE-LEGACY | Real tenant-safe registry | High | Misleading recovery | Replace, then retire literal queue | Queue policy | Failure/retry E2E |
| ORPHAN-009 | Ops worker | Storage-target test job shape has no processor handler. | Producer `{targetId}`; processor requires `{runId}` | INCOMPATIBLE-LEGACY | Matched job contract | High | Operation always fails | Implement audited handler/run | Ops contract | Producer-consumer test |
| ORPHAN-010 | Mobile | Expo scaffold is mock-driven, SDK-less and outside CI/deploy. | Scripts/deps/root filters | REUSABLE-WITH-REFACTOR | Dormant or full platform client | Low while dormant | False completeness if activated | Keep dormant; reuse UI only after closure | Mobile scope | SDK/auth/tenant/CI proof |
| ORPHAN-011 | Flags | Planned registry entries are intentional placeholders, some metadata now stale. | Registry status/defaults | DORMANT-BUT-VALID | Accurate roadmap metadata | Medium | Misleading Admin | Reconcile metadata | Capability matrix | Definition/use scan |
| ORPHAN-012 | Flags | Deprecated LIMS flags remain for migration. | Registry marks replacements | SUPERSEDED | Tenant rows migrated | Low | Alias drift | Migrate rows then remove | DB inventory | Resolved-flag tests |
| ORPHAN-013 | DB/OPD | Legacy OPD retirement migration drops old table family. | Migration/current schema | SUPERSEDED | Historical migration retained | None | Removing breaks reproducibility | Never delete migration | None | Fresh migration |
| ORPHAN-014 | LIMS commands | Singular receive/legacy verify coexist with canonical commands and still have UI consumers. | OpenAPI/controllers/pages | DUPLICATE | Canonical commands only | High | State drift risk | Migrate consumers then retire | Workflow fix | Full receive/verify E2E |
| ORPHAN-015 | Catalog routes | Sync/async and `/admin` alias import/export families overlap. | Dual mounts and UI consumers | DUPLICATE | Selected canonical job family | Medium | Contract/ops drift | Select after access-log review | Import UX | Reverse truth-map |
| ORPHAN-016 | LIMS schema | Legacy sample-type strings and nullable result parameter remain active fallbacks. | Prisma comments/service reads | INCOMPATIBLE-LEGACY | Canonical FK/parameter model | High | Data/workflow ambiguity | Profile/backfill/migrate | Live data | Migration and report regression |
| ORPHAN-017 | Admin access | Legacy permission policy duplicated in API and Admin. | Two matching lists | INCOMPATIBLE-LEGACY | Backend-authoritative policy | High | Authorization drift | Migrate roles then remove client copy | RBAC matrix | Allow/deny tests |
| ORPHAN-018 | Scripts | Dated screenshot script is unreferenced, stale and hard-codes demo credentials. | No package/CI refs; stale selectors/paths | DEAD | Playwright owns intent | Low/security hygiene | Remove after intent review | Test mapping | Playwright coverage |
| ORPHAN-019 | Ops/transfer | Branch-switching artifact script may be one-off infrastructure. | No refs; destructive behavior | UNCERTAIN | Owner-classified | Unknown | Unknown | Do not remove; ask owner/archive | Infra owner | Operational confirmation |
| ORPHAN-020 | Build/test output | Live tsbuildinfo and Playwright output are tracked and regenerated. | Audit commands changed them | DEAD | Ignored transient output | Low | Churn/noise | Untrack live outputs, preserve dated evidence | Gitignore | Clean gates twice |
| ORPHAN-021 | Mocking | Prism/mock gateway and fixtures are referenced by mock profile/scripts. | Root scripts/Compose profile | DORMANT-BUT-VALID | Contract-first mock tooling | None | None if disabled | Retain; prevent prod activation | Deploy profile | Production env check |
| ORPHAN-022 | Docs/evidence | Historical audit directories are non-runtime but preserve evidence. | ~35 MB dated docs | DORMANT-BUT-VALID | Clearly historical archive | None | Deletion loses evidence | Retain/index; consider artifact store later | Retention policy | Hash/index |
| ORPHAN-023 | Shared UI | UI-system and theme CSS are widely imported. | Workspace imports/deps | ACTIVE | Remain canonical | None | Removing breaks apps | Retain | None | Build |
| ORPHAN-024 | API/worker | AppModule modules and worker processors are decorator/registration reachable. | Registration roots | ACTIVE | Remain active | None | False-positive cleanup risk | Treat as graph roots | None | Boot/worker health |
| ORPHAN-025 | OPD | Current canonical OPD schema/service/UI replaced retired model family. | Mounted module/routes/schema | ACTIVE | Reconcile, do not rewrite | High opportunity | Rewriting wastes compatible work | Fix current implementation | OPD ledger | Full OPD E2E |
| ORPHAN-026 | Admin/util | Local `utils.ts` has no imports; UI-system owns equivalent utility. | Import search | DEAD | No duplicate helper | Low | None | Remove later | Admin build | Typecheck/build |

Full compatibility detail and import evidence: [`_work/ORPHAN_AGENT_FINDINGS.md`](_work/ORPHAN_AGENT_FINDINGS.md).
