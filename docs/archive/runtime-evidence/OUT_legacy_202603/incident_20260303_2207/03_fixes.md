# Fixes Applied

Commit deployed: `d24bff4fdc940b7faee77b7027915c25459a7d81`

## Code changes
1. `apps/operator/src/components/nav/topbar.tsx`
- Removed token-decoded user identity usage.
- Switched to server-derived current user via SDK-backed `/me` hook (`useCurrentUser`).
- Reason: frontend must not rely on stale/assumed JWT permission claims.

2. `apps/operator/src/hooks/use-feature-flags.ts`
- Added deterministic default for `module.opd` flag.
- Reason: avoid undefined->false jitter impacting initial navigation behavior.

3. `apps/api/src/catalog/catalog.controller.ts`
- `POST /catalog/import/workbook` now throws `BadRequestException` when file missing.
- Reason: return standard JSON error contract instead of ad-hoc response and make client handling explicit.

## Validation executed
- Operator type-check: `pnpm --filter @vexel/operator exec tsc --noEmit`.
- API test: `pnpm --filter @vexel/api exec jest src/catalog/__tests__/catalog-import-multipart.spec.ts --runInBand` (PASS).

## Deploy actions
- `docker compose build operator api --no-cache`
- `docker compose up -d operator api`
- Post-deploy health/API checks recorded in `05_commands.log`.
