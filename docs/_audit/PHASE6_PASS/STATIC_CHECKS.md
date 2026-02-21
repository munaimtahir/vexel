# Phase 6 Static Checks

## SDK-Only Enforcement
Command: `grep -rn "fetch\(" apps/operator/src/app apps/admin/src/app --include="*.tsx" | grep -v getApiClient`
Expected: no output (PASS)

## No Prisma in Frontends
Command: `grep -rn "@prisma/client" apps/operator/src apps/admin/src`
Expected: no output (PASS)

## OpenAPI Paths Count
Command: `grep -c "operationId:" packages/contracts/openapi.yaml`
Expected: >= 78 operationIds

## Operator Route Coverage
Routes that must exist:
- apps/operator/src/app/(protected)/patients/new/page.tsx ✓
- apps/operator/src/app/(protected)/encounters/[id]/page.tsx ✓
- apps/operator/src/app/(protected)/encounters/[id]/results/page.tsx ✓
- apps/operator/src/app/(protected)/encounters/[id]/verify/page.tsx ✓
- apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx ✓
