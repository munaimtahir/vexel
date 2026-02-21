# Phase 6 Evidence Log

Commands run and output captured on 2026-02-21.

## Git SHA

```
$ git rev-parse HEAD
58d4f56074ab15cc99fdb579ac1eaa5441e7bda9
```

## OpenAPI Hash

```
$ sha256sum packages/contracts/openapi.yaml
a0e555b27c35ca30df0df868d778958722de44e7ffd306247a1533e42ccd2e06  packages/contracts/openapi.yaml
```

## Operator Routes

```
$ find apps/operator/src/app -name "*.tsx" | sort
apps/operator/src/app/(protected)/encounters/[id]/page.tsx
apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx
apps/operator/src/app/(protected)/encounters/[id]/results/page.tsx
apps/operator/src/app/(protected)/encounters/[id]/verify/page.tsx
apps/operator/src/app/(protected)/encounters/new/page.tsx
apps/operator/src/app/(protected)/encounters/page.tsx
apps/operator/src/app/(protected)/layout.tsx
apps/operator/src/app/(protected)/patients/new/page.tsx
apps/operator/src/app/(protected)/patients/page.tsx
apps/operator/src/app/layout.tsx
apps/operator/src/app/login/page.tsx
apps/operator/src/app/page.tsx
```

## Test Files Count

```
$ cd apps/api && npx jest --listTests 2>/dev/null | wc -l
7
```

## SDK operationId Count

```
$ grep -c "operationId:" packages/contracts/openapi.yaml
78
```

## Test Run Summary

```
$ cd apps/api && npm test -- --passWithNoTests --testPathPattern="spec.ts$"

PASS src/catalog/__tests__/catalog-import.spec.ts
PASS src/documents/__tests__/document-idempotency.spec.ts
PASS src/rbac/permissions.guard.spec.ts
PASS src/documents/__tests__/canonical.spec.ts
PASS src/documents/__tests__/documents.service.spec.ts
PASS src/tenant/tenant-resolver.middleware.spec.ts
PASS src/encounters/__tests__/encounter-workflow.spec.ts

Test Suites: 7 passed, 7 total
Tests:       36 passed, 36 total
Snapshots:   0 total
Time:        8.945 s
```
