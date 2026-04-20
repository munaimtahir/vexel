# Repository Reality

## Monorepo shape (actual)
- Apps present: `apps/api`, `apps/admin`, `apps/operator`, `apps/worker`, `apps/pdf`, `apps/e2e`, `apps/mobile`, `apps/docs`.
- Packages present: `packages/contracts`, `packages/sdk`, `packages/ui`, `packages/config-*`, `packages/tsconfig`.
- Workspace/tooling present: `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `docker-compose.yml`.

## Build/tooling reality
- Package manager and scripts are wired at root (`pnpm` + `turbo`).
- Contract and SDK generation scripts exist in root and contracts package.
- CI workflow exists and includes governance checks (`.github/workflows/ci.yml`).
- Docker compose topology exists for DB/cache/API/worker/pdf/admin/operator/minio.
- Migrations and seed scripts exist under `apps/api/prisma`.

## Runtime truth in this pass
- Local runtime was not active:
  - `curl http://127.0.0.1:9021/api/health` failed (connection).
  - `docker compose ps` showed no running stack in this session context.
- Therefore endpoint runtime behavior is **Unverified** for local stack during this audit.

## Backend reality (high level)
- Implemented modules for auth/RBAC/tenancy/audit/patients/encounters/results/verification/documents/catalog/opd exist in API source.
- Global middleware wiring for correlation + tenant resolution exists (`apps/api/src/main.ts`, tenancy middleware module).

## Frontend reality (high level)
- Operator and Admin route-group shell patterns are present (`(public)`/`(protected)` layouts and shell components).
- Shared SDK client pattern exists (`apps/operator/src/lib/api-client.ts`, `apps/admin/src/lib/api-client.ts`).
- Legacy/redirect route coexistence remains in operator, but `/lims/*` namespace is present.

## Additional reality
- Mobile app remains partial/scaffolded with mocked API client methods and TODO markers (`apps/mobile/src/api/client.ts`).
- Worker package warns about misplaced `pnpm.overrides` in `apps/worker/package.json` (non-fatal tooling drift).
