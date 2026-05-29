# Command Log — 2026-05-28

1. `pwd && whoami && hostname && date && git status --short && git branch --show-current && git rev-parse HEAD && git remote -v && git log -10 --oneline && node -v && npm -v && pnpm -v && docker --version && docker compose version && dotnet --version && uname -a`
   - Result: Baseline gathered. `dotnet` not found.
2. `mkdir -p docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/...`
   - Result: Audit structure initialized.
3. `cat pnpm-workspace.yaml && cat package.json && ls -d apps/*/ packages/*/`
   - Result: Project structure verified. `mobile` excluded from scripts.
4. `pnpm build`
   - Result: Build successful for all MVP components.
5. `pnpm lint`
   - Result: Lint successful with warnings.
6. `pnpm --filter @vexel/api test`
   - Result: 29 suites, 210 tests passed.
7. `pnpm --filter @vexel/sdk test`
   - Result: 2 suites, 5 tests passed.
8. `find apps/worker apps/admin apps/operator -name "*.spec.ts" -o -name "*.spec.tsx" -o -name "*.test.ts" -o -name "*.test.tsx"`
   - Result: No unit tests found in worker or UI apps.
9. `pnpm sdk:generate`
   - Result: SDK generated successfully.
10. `pnpm check:admin-openapi-parity`
    - Result: PASS. 164 endpoint references checked.
11. `grep_search` on `openapi.yaml` for critical endpoints.
    - Result: All critical endpoints present.
12. `ls -l packages/sdk/src/generated/ && pnpm --filter @vexel/sdk build`
    - Result: SDK files are fresh. Build/typecheck passed.
13. `grep` searches for `axios`, `fetch(`, `prisma`, etc.
    - Result: No prohibited patterns found in frontend code. `as any` used only as SDK call casts.
14. `grep` on `apps/operator/src` to extract API calls.
    - Result: 70+ unique API calls extracted and mapped to backend controllers.
15. `grep` on `schema.prisma` for `tenantId` and uniqueness.
    - Result: Mandatory `tenantId` and tenant-scoped unique constraints verified across all models.
16. `ls -F apps/api/prisma/migrations/`
    - Result: Versioned migration history verified.
17. `read_file` on `auth.service.ts`, `tenant-resolver.middleware.ts`, `jwt-auth.guard.ts`, and `jwt.strategy.ts`.
    - Result: Tenant-aware login, hostname resolution, and Live DB validation verified.
18. `read_file` on `encounters.service.ts` and `encounter-workflow.spec.ts`.
    - Result: LIMS state machine, audit logging, and transition constraints verified.
19. `read_file` on `documents.service.ts`, `canonical.spec.ts`, and `document-idempotency.spec.ts`.
    - Result: Deterministic hashing, idempotency, and failure handling verified.
20. `read_file` on `jobs.service.ts`, `apps/worker/src/main.ts`, and `document-render.processor.ts`.
    - Result: Worker heartbeat, queue concurrency, and processor idempotency verified.
21. `read_file` on `health.service.ts`.
    - Result: Deep health check coverage (API, DB, Redis, Worker, PDF, Storage, Queue) verified.
22. `read_file` on `system-logs.service.ts`.
    - Result: Structured category-wise logging and file persistence verified.
23. `ls` on `apps/admin/src/app/(protected)/system/logs/page.tsx`.
    - Result: Admin log viewer UI presence verified.
24. `pnpm mcp:playwright:install-browsers`
    - Result: Playwright chromium and runtime libs installed.
25. `pnpm --filter @vexel/e2e exec playwright test tests/audit-admin.spec.ts`
    - Result: PASS. Admin UI screenshots captured and verified.
26. `pnpm --filter @vexel/e2e exec playwright test tests/audit-operator.spec.ts`
    - Result: PASS. Operator UI screenshots captured and verified.
27. `docker compose exec api node -e ...`
    - Result: Added `127.0.0.1` to system tenant domains for E2E resolution.
28. `pnpm --filter @vexel/e2e exec playwright test --grep='@smoke'`
    - Result: PASS. 41 tests passed. Core workflows verified.
29. `pnpm build` (Implicitly verify typecheck)
    - Result: PASS for all MVP components.
30. `docker compose config`
    - Result: Configuration verified. All services and ports correctly mapped.
31. `docker compose ps`
    - Result: All 8 services healthy/running.
30. `grep` for "secret", "key", "password" in backend code.
    - Result: Default secrets found in fallbacks; acceptable for dev.
31. `read_file` on `audit.service.ts`.
    - Result: Audit logging stores full before/after blobs; noted for PHI.
32. `find` and `read_file` on route structures and `middleware.ts`.
    - Result: Protected route grouping and edge-level auth enforcement verified.
33. `read_file` on `.github/workflows/manual-e2e.yml`.
    - Result: Workflow exists with manual trigger, but lacks Playwright smoke steps.
    - Result: Protected route grouping and edge-level auth enforcement verified.
