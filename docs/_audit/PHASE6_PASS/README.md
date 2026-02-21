# Phase 6 Pass Evidence

Generated: 2026-02-21

## Git SHA
Run: `git rev-parse HEAD`

## OpenAPI Hash
Run: `sha256sum packages/contracts/openapi.yaml`

## SDK Version
See: packages/sdk/package.json version field

## Test Results
Run: `cd apps/api && npm test`

## How to Rerun
1. `cd /home/munaim/srv/apps/vexel`
2. `cd apps/api && npm test`
3. Manual test: follow docs/ops/PHASE6_MANUAL_TEST.md

## Pass Conditions
- [ ] API unit tests pass (encounter workflow + document idempotency)
- [ ] CI gates: SDK freshness, SDK-only enforcement, no Prisma in frontends
- [ ] Manual test: full workflow from patient create → report download
- [ ] Audit events written for every command
- [ ] Cross-tenant access denied (404)
- [ ] Document generate idempotent (same payload → same Document.id)
- [ ] Publish idempotent (double publish → no error, same doc)
