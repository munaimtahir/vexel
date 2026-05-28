# Command Log (Fresh Audit Run)

Rule: Every command executed for this audit is recorded here. Outputs are saved under `logs/`, `test-results/`, `docker/`, `runtime-responses/`, `screenshots/`, or `traces/` as appropriate.

## Phase 0 — Audit Initialization

Timestamp (UTC): `2026-05-27 23:08`

1. `date -u +%Y%m%d_%H%M`
2. `pwd`
3. `whoami`
4. `hostname`
5. `date -u`
6. `uname -a`

7. Create evidence folder tree:
- `mkdir -p docs/_fresh_audit/20260527_2308_vexel_full_codebase_audit/{...subfolders...}`

8. Baseline capture (single transcript):
- Output saved: `logs/phase0_baseline.txt`
- Command block included: `pwd`, `whoami`, `hostname`, `date -u`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git remote -v`, `git log -10 --oneline`, `node -v`, `npm -v`, `pnpm -v`, `yarn -v`, `docker --version`, `docker compose version`, `dotnet --version`, `uname -a`

## Phase 1 — Repository Structure Discovery

1. Directory discovery:
- `find . -maxdepth 2 -type d | sort`
- Output saved: `logs/phase1_dirs_maxdepth2.txt`

2. File discovery (sample):
- `find . -maxdepth 3 -type f | sort | head -1000`
- Output saved: `logs/phase1_files_maxdepth3_head1000.txt`

3. Key file discovery:
- `find . -maxdepth 4 (package.json / lockfiles / Dockerfile / compose / .env / sln/csproj)`
- Output saved: `logs/phase1_key_files_find.txt`

4. Top-level listings:
- `ls -la apps` -> `logs/phase1_ls_apps.txt`
- `ls -la packages` -> `logs/phase1_ls_packages.txt`
- `ls -la docker` -> `logs/phase1_ls_docker.txt`
- `ls -la scripts` -> `logs/phase1_ls_scripts.txt`

## Phase 2 — Package Manager and Script Discovery

1. Package.json discovery:
- `find . -name package.json -not -path */node_modules/* -not -path */.next/* -print | sort`
- Output saved: `logs/phase2_package_json_paths.txt`

2. Package.json summarization (machine-readable):
- Node script to parse each package.json and emit `{ path, name, scripts, deps }`
- Output saved: `logs/phase2_package_json_summary.json`

## Phase 3 — Environment and Configuration Audit

1. Config file discovery:
- `find . -maxdepth 5 (.env*, *compose*.yml, Dockerfile, next.config.*, caddy*, *.config.*) | sort`
- Output saved: `logs/phase3_config_files_find.txt`

2. Mask environment files (values redacted):
- `.env`, `.env.example`, `apps/admin/.env.example`, `scripts/mock-gateway/.env`
- Outputs saved under: `logs/env_masked/`

3. Mask docker-compose files (common secret-like keys redacted):
- `docker-compose.yml`, `docker/docker-compose.yml`
- Outputs saved under: `logs/config_masked/`

4. Snapshot key config files (raw copies):
- `apps/*/Dockerfile`, `apps/*/next.config.ts`, `apps/e2e/playwright.config.ts`
- Outputs saved under: `logs/config_snapshots/`

## Phase 4 — OpenAPI Contract Audit (Started)

1. Snapshot contract-related package manifests and presence of OpenAPI:
- `cp package.json logs/phase4_root_package.json`
- `cp packages/contracts/package.json logs/phase4_contracts_package.json`
- `ls -la packages/contracts/openapi.yaml` -> `logs/phase4_openapi_ls.txt`

2. Admin/OpenAPI parity script:
- `node scripts/check-admin-openapi-parity.js`
- Output: `logs/phase4_check_admin_openapi_parity.txt`

3. Basic OpenAPI static scan (no schema validation):
- Python script to detect OpenAPI version and operationId uniqueness
- Output: `logs/phase4_openapi_yaml_basic_scan.txt`

4. Evidence copy of OpenAPI:
- `cp packages/contracts/openapi.yaml contracts/openapi/openapi.yaml`

5. openapi-typescript availability and evidence-only generation:
- `pnpm -C packages/contracts exec openapi-typescript --version` -> `logs/phase4_openapi_typescript_version.txt`
- `pnpm -C packages/contracts exec openapi-typescript openapi.yaml -o <evidence path>` -> `logs/phase4_openapi_typescript_generate.txt`
- Generated file stored at: `contracts/openapi/openapi-types.d.ts`

6. Contract excerpt scans:
- `rg \"securitySchemes|bearer|jwt\" packages/contracts/openapi.yaml` -> `logs/phase4_openapi_security_scan.txt`

## Phase 5 — SDK Generation and Usage Audit

1. SDK inventory and SDK import discovery:
- `find packages/sdk -maxdepth 4 -type f | sort` -> `logs/phase5_sdk_files.txt`
- `rg \"from '@vexel/sdk'\" apps/admin apps/operator packages` -> `logs/phase5_sdk_imports_all.txt`

2. Evidence-only generation of expected SDK types from OpenAPI and diff against repo:
- `openapi-typescript` run produced `contracts/openapi/sdk_expected_api.d.ts`
- `diff -u packages/sdk/src/generated/api.d.ts contracts/openapi/sdk_expected_api.d.ts`
- Diff output: `logs/phase5_sdk_api_dts_diff.txt` (empty); exit code: `logs/phase5_sdk_api_dts_diff.exitcode.txt` (0)

## Phase 6 — Frontend API Guardrail Audit

Static searches (excluding `node_modules` and `.next`):
- `rg \"\\baxios\\b\" apps/admin apps/operator packages` -> `logs/phase6_rg_axios.txt`
- `rg \"\\bfetch\\(\" apps/admin apps/operator packages` -> `logs/phase6_rg_fetch.txt`
- `rg \"XMLHttpRequest\" apps/admin apps/operator packages` -> `logs/phase6_rg_xhr.txt`
- `rg \"\\bprisma\\b\" apps/admin apps/operator` -> `logs/phase6_rg_prisma.txt`
- `rg \"\\/api\\/\" apps/admin apps/operator` -> `logs/phase6_rg_api_literal.txt`
- `rg \"http://|https://\" apps/admin apps/operator` -> `logs/phase6_rg_http_literals.txt`

## Phase 7 — Backend Module and Route Audit (Static Inventory)

1. API source inventory and controller/route scans:
- `find apps/api/src -maxdepth 6 -type f | sort` -> `logs/phase7_api_src_files.txt`
- `rg \"@Controller\\(\" apps/api/src` -> `logs/phase7_api_controllers.txt`
- `rg \"@(Get|Post|Patch|Put|Delete)\\(\" apps/api/src` -> `logs/phase7_api_route_decorators.txt`
- `rg \"UseGuards\\(|RequirePermissions|tenant|correlation|Audit\" apps/api/src` -> `logs/phase7_api_security_tenant_audit_hits.txt`
- `rg \"setGlobalPrefix\\(\" apps/api/src` -> `logs/phase7_api_global_prefix.txt`

2. Snapshot critical bootstrap/module files:
- `cp apps/api/src/main.ts` -> `logs/apps_api_src_main.ts`
- `cp apps/api/src/app.module.ts` -> `logs/apps_api_src_app.module.ts`

## Phase 7B — Frontend ↔ Backend Truthmap (Static Extraction Started)

1. Enumerate Next.js pages:
- `find apps/admin/src/app -name page.*` -> `logs/phase7b_admin_pages.txt`
- `find apps/operator/src/app -name page.*` -> `logs/phase7b_operator_pages.txt`

2. Extract frontend openapi-fetch calls (SDK client method/path literals):
- Script: `tmp-audit-scripts/extract_openapi_fetch_calls.js`
- Output: `contracts/frontend_backend_truthmap.json` and `contracts/frontend_backend_truthmap.csv`

3. Enrich extracted calls with OpenAPI operationIds (method+path match against canonical contract):
- Output: `contracts/openapi_sdk_backend_frontend_map.json` and `.csv`
- Errors (if any): `logs/phase7b_openapi_enrich.err`, `logs/phase7b_openapi_map_csv.err`

## Phase 16 — Browser/E2E (Playwright)

1. Initial smoke run:
- `pnpm --filter @vexel/e2e e2e:smoke` -> failed due missing chromium executable
- Log: `test-results/phase16_e2e_smoke.txt`

2. Install browser binaries (repo script):
- `pnpm mcp:playwright:install-browsers`
- Log: `logs/phase16_playwright_install_browsers.txt`

3. Smoke rerun:
- `pnpm --filter @vexel/e2e e2e:smoke` -> PASS (41 tests)
- Log: `test-results/phase16_e2e_smoke.rerun.txt`
- Artifacts copied to: `e2e/`

## Phase 17 — Build/Lint/Test (Selected)

- `pnpm install --frozen-lockfile` -> `logs/phase17_pnpm_install.txt`
- `pnpm ui:color-lint` -> `test-results/phase17_ui_color_lint.txt`
- `pnpm --filter @vexel/api test` -> `test-results/phase17_api_test.txt`
- `pnpm --filter @vexel/sdk build` -> `test-results/phase17_sdk_build.txt`
- `pnpm --filter @vexel/sdk test` -> FAIL (`jest` not found) -> `test-results/phase17_sdk_test.rerun.txt`
- `pnpm lint` -> FAIL (mobile lint) -> `test-results/phase17_root_lint.rerun.txt`
- `pnpm build` -> PASS -> `test-results/phase17_root_build.txt`

## Phase 8 — Database Schema and Migration Audit (Static)

1. Prisma schema discovery and scans:
- `find apps/api/prisma -maxdepth 3 -type f | sort` -> `logs/phase8_api_prisma_files.txt`
- `rg \"^model \" apps/api/prisma/schema.prisma` -> `logs/phase8_prisma_models.txt`
- `rg \"tenantId\" apps/api/prisma/schema.prisma` -> `logs/phase8_prisma_tenantid_hits.txt`

2. Audit-only extraction of model→tenantId presence matrix:
- Output: `db/prisma_model_tenancy_matrix.json` and `.csv`

3. Migration listing:
- `find apps/api/prisma/migrations -name migration.sql | sort` -> `logs/phase8_migration_sql_list.txt`
