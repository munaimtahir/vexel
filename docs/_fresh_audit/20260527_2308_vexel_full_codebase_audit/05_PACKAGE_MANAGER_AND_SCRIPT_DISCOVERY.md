# Package Manager and Script Discovery

Primary evidence:
- Package.json paths: `logs/phase2_package_json_paths.txt`
- Machine-readable summary (name/scripts/deps lists): `logs/phase2_package_json_summary.json`

Package manager indicators
- Root lockfile: `pnpm-lock.yaml` present (suggests pnpm as the primary package manager).
- Additional lockfiles exist in subpackages (e.g., `apps/api/package-lock.json`, `apps/e2e/package-lock.json`), which is a **risk for dependency drift** until reviewed in build/test phases.

Discovered packages (path -> name -> scripts)

- `./package.json` -> `vexel`
  - Scripts: `build`, `check:admin-openapi-parity`, `dev`, `dev:full`, `dev:ui-mock`, `lint`, `mock:api`, `mock:smoke`, `sdk:generate`, `ui:color-lint`, `mcp:playwright`, `mcp:playwright:install-browsers`, `mcp:playwright:install-runtime-libs`

- `apps/api/package.json` -> `@vexel/api`
  - Scripts: `build`, `dev`, `lint`, `start`
  - Prisma scripts: `prisma:dev`, `prisma:generate`, `prisma:migrate`, `prisma:seed`
  - Tests: `test`, `test:watch`, `test:cov`

- `apps/admin/package.json` -> `@vexel/admin`
  - Scripts: `dev`, `build`, `start`, `lint`

- `apps/operator/package.json` -> `@vexel/operator`
  - Scripts: `dev`, `build`, `start`, `lint`, `ui:color-lint`

- `apps/worker/package.json` -> `@vexel/worker`
  - Scripts: `dev`, `build`, `start`

- `apps/e2e/package.json` -> `@vexel/e2e`
  - Scripts: many Playwright-style suites such as `e2e:smoke`, `e2e:tenancy`, `e2e:lims`, plus `test:*` variants and `report`

- `apps/mobile/package.json` -> `@vexel/mobile`
  - Scripts: `start`, `web`, `android`, `ios`, `lint`, `typecheck`

- `packages/contracts/package.json` -> `@vexel/contracts`
  - Scripts: `sdk:generate`

- `packages/sdk/package.json` -> `@vexel/sdk`
  - Scripts: `build`, `test`

- `packages/theme/package.json` -> `@vexel/theme`
  - Scripts: none declared

- `packages/ui-system/package.json` -> `@vexel/ui-system`
  - Scripts: none declared

- `scripts/mock-gateway/package.json` -> `mock-gateway`
  - Scripts: none declared (runtime usage to be verified via root `dev:ui-mock` / `mock:*` scripts)

Commands planned for later phases (only from discovered scripts)
- Contract/SDK: `pnpm sdk:generate`, `pnpm check:admin-openapi-parity`
- Repo-level checks: `pnpm lint`, `pnpm build`, `pnpm ui:color-lint`
- API: `pnpm --filter @vexel/api test`, `pnpm --filter @vexel/api prisma:generate`, `pnpm --filter @vexel/api prisma:migrate`, `pnpm --filter @vexel/api prisma:seed`
- E2E: `pnpm --filter @vexel/e2e e2e:smoke` (and other suites) once runtime is available

