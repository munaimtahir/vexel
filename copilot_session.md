# Vexel Full Codebase + Runtime Audit (Fresh, Evidence-Backed)

Audit objective: Determine the true current status of the Vexel Health Platform codebase and runtime (from scratch) and issue an evidence-backed **GO / CONDITIONAL GO / NO-GO** verdict. Prior audits under `docs/_audit/`, `docs/_discovery/`, etc. are treated as historical artifacts only and are **not used as evidence** for this verdict.

Repo path: `/home/munaim/srv/apps/vexel`
Current UTC timestamp: `2026-05-27 23:08`
Evidence folder (this run): `docs/_fresh_audit/20260527_2308_vexel_full_codebase_audit/`

Branch/commit (start of run):
- Branch: `main`
- Commit: `7e31b8d42c29b47e2c296ee120f11e5f32f10a8d`
- Worktree: **DIRTY** (see baseline log)

Execution plan (phases)
1. Phase 0: Audit initialization (environment + repo baseline, create evidence folder + command log)
2. Phase 1: Repository structure discovery (actual monorepo layout, key files)
3. Phase 2: Package manager + scripts discovery
4. Phase 3: Environment/config audit
5. Phase 4: OpenAPI contract audit (lint/validate)
6. Phase 5: SDK generation/usage audit
7. Phase 6: Frontend API guardrail audit (no `fetch`, no `axios`, no Prisma)
8. Phase 7: Backend module/route inventory
9. Phase 7B: Frontend↔Backend truthmap (static + runtime)
10. Phase 8: DB schema/migrations audit (Prisma)
11. Phase 9: Tenancy static + runtime proof
12. Phase 10: Auth/RBAC/session static + runtime proof
13. Phase 11: LIMS workflow command audit (static + runtime)
14. Phase 12: Document/PDF pipeline audit (static + runtime)
15. Phase 13: Worker/Redis/BullMQ audit (static + runtime)
16. Phase 14-16: Admin/Operator app audits + Playwright/browser smoke
17. Phase 17: Build/typecheck/lint/test audit
18. Phase 18: Docker runtime health audit
19. Phase 19-21: Security, observability/auditability, route governance
20. Phase 22-26: Deployment readiness, risks, way-forward plan, final verdict, evidence index

Checklist status
- Phase 0: completed
- Phase 1: completed
- Phase 2: completed
- Phase 3: completed
- Phase 4: completed
- Phase 5: completed
- Phase 6: completed
- Phase 7: completed (static inventory)
- Phase 7B: in_progress
- Phase 8: completed (static)
- Phase 9: completed (partial)
- Phase 10: completed (partial)
- Phase 11: completed
- Phase 12: completed
- Phase 13: completed (partial)
- Phase 14: pending
- Phase 15: pending
- Phase 16: completed
- Phase 17: in_progress
- Phase 18: pending
- Phase 19: pending
- Phase 20: pending
- Phase 21: pending
- Phase 22: pending
- Phase 23: pending
- Phase 24: pending
- Phase 25: pending
- Phase 26: pending

Commands run so far (see full log)
- Baseline capture saved at: `docs/_fresh_audit/20260527_2308_vexel_full_codebase_audit/logs/phase0_baseline.txt`

Current blockers
- `.NET (dotnet)` is not installed on this machine (`dotnet --version` not found). PDF build/runtime verification may be blocked unless PDF is container-only.

Completed phases (notes)
- Phase 0: Evidence folder created. Baseline environment and repo metadata captured.
- Phase 1: Repository structure discovered and documented in `03_MONOREPO_STRUCTURE_AUDIT.md` with raw listings saved under evidence `logs/`.
- Phase 2: Package scripts discovered and documented in `05_PACKAGE_MANAGER_AND_SCRIPT_DISCOVERY.md` with JSON summary under evidence `logs/`.
- Phase 3: Environment/config discovery captured and documented in `06_ENVIRONMENT_AND_CONFIGURATION_AUDIT.md` with masked snapshots under evidence `logs/`.
- Phase 4: OpenAPI existence/shape/security/operationId uniqueness verified and documented in `07_OPENAPI_CONTRACT_AUDIT.md` with evidence under `logs/` and `contracts/openapi/`.
- Phase 5: SDK presence + frontend usage verified; OpenAPI→SDK types freshness proven via evidence-only generation + diff (see `08_SDK_GENERATION_AND_USAGE_AUDIT.md`).
- Phase 6: Frontend API guardrail static scan completed (no forbidden direct calls detected); documented in `09_FRONTEND_API_GUARDRAIL_AUDIT.md`.
- Phase 7: Backend module/route static inventory captured; documented in `10_BACKEND_MODULE_AND_ROUTE_AUDIT.md`.
- Phase 8: Prisma schema/migration static inventory captured; documented in `11_DATABASE_SCHEMA_AND_MIGRATION_AUDIT.md`.
- Phase 9: Tenancy static+runtime evidence captured; documented in `12_TENANCY_STATIC_AND_RUNTIME_AUDIT.md` (verdict currently PARTIAL).
- Phase 10: Auth/RBAC static+runtime evidence captured; documented in `13_AUTH_RBAC_SESSION_AUDIT.md` (verdict currently PARTIAL).
- Phase 11: LIMS workflow runtime command proof captured; documented in `14_LIMS_WORKFLOW_COMMAND_AUDIT.md`.
- Phase 12: Document/PDF pipeline runtime proof captured; documented in `15_DOCUMENT_PDF_PIPELINE_AUDIT.md`.
- Phase 13: Worker/queue/redis evidence captured; documented in `16_WORKER_QUEUE_REDIS_AUDIT.md` (verdict currently PARTIAL).
- Phase 16: Playwright smoke PASS after installing browsers; documented in `19_UI_BROWSER_E2E_SMOKE_AUDIT.md`.

Pending phases (next up)
- Phase 7B: Complete truthmap correlation (OpenAPI↔SDK↔backend↔frontend) and produce final truthmap verdict + missing/orphan maps.
- Phase 17: Finish build/typecheck/lint/test audit writeup and remaining commands as needed.
- Phase 18+: Continue remaining phases through final verdict.

Final evidence folder path
- `docs/_fresh_audit/20260527_2308_vexel_full_codebase_audit/`
