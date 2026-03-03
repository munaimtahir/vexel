# 03 — API Implementation Checks

---

## Controller: apps/api/src/catalog/catalog-operator.controller.ts

```typescript
@ApiTags('Catalog')
@Controller('operator/catalog/tests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CatalogOperatorController {
  constructor(private readonly svc: CatalogService) {}

  @Get('search')
  @RequirePermissions(Permission.CATALOG_READ)
  searchTests(@Req() req: Request, @Query('q') q: string, @Query('limit') limit?: string) {
    return this.svc.searchTestsForOperator((req as any).user.tenantId, {
      q,
      limit: limit === undefined ? undefined : Number(limit),
    });
  }

  @Get('top')
  @RequirePermissions(Permission.CATALOG_READ)
  listTopTests(@Req() req: Request) {
    return this.svc.listTopTestsForOperator((req as any).user.tenantId);
  }
}
```

✅ `tenantId` extracted from `req.user.tenantId` (JWT) — not a query param  
✅ `Permission.CATALOG_READ` enforced on both endpoints  
✅ `limit` passed as Number() cast (avoids string-to-Prisma-take bug)  

---

## Controller: apps/api/src/catalog/catalog-admin-top.controller.ts

```typescript
@Controller('admin/catalog/tests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CatalogAdminTopController {
  @Put('top')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  setTopTests(@Req() req, @Body() body, @Headers(...) correlationId?) {
    const user = (req as any).user;
    return this.svc.setTopTests(user.tenantId, body?.testIds ?? [], user.userId, correlationId);
  }
}
```

✅ `tenantId` from JWT, not from body  
✅ `catalog.manage` required  
✅ Audit event logged with `correlationId`  

---

## Service: normalizeCatalogSearchQuery (line 166)

```typescript
private normalizeCatalogSearchQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase();
}
```

✅ Trim leading/trailing whitespace  
✅ Collapse multiple spaces  
✅ Lowercase (case-insensitive normalization)  

---

## Service: getCatalogSearchRank (line 192)

```typescript
private getCatalogSearchRank(
  row: { name: string; testCode: string; userCode: string },
  q: string
): number {
  if (row.testCode === q || row.userCode === q) return 1;  // exact code match
  if (row.testCode.startsWith(q) || row.userCode.startsWith(q) || row.name.startsWith(q)) return 2;  // prefix
  return 3;  // contains
}
```

✅ Rank 1: exact testCode or userCode match  
✅ Rank 2: prefix match (testCode, userCode, or name)  
✅ Rank 3: contains match (fallback)  

---

## Service: searchTestsForOperator (line 198)

```typescript
async searchTestsForOperator(tenantId: string, opts: { q: string; limit?: number }) {
  const q = this.normalizeCatalogSearchQuery(opts.q ?? '');
  if (!q) throw new BadRequestException('q is required');

  const requestedLimit = Number(opts.limit ?? 20);
  const limit = Math.min(Math.max(requestedLimit || 20, 1), 50);  // clamp 1–50

  const matches = await this.prisma.catalogTest.findMany({
    where: {
      tenantId,              // ← tenant-scoped
      isActive: true,
      OR: [
        { name:       { contains: q, mode: 'insensitive' } },
        { externalId: { contains: q, mode: 'insensitive' } },
        { userCode:   { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id, name, externalId, userCode, department, sampleType, price, sampleTypeRef }
  });

  return matches
    .map(row => ({ ...row, _rank: this.getCatalogSearchRank(...) }))
    .sort((a, b) => a._rank - b._rank || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(row => this.formatCatalogTestSearchResult(row));
}
```

✅ `tenantId` in WHERE — no cross-tenant leakage  
✅ `mode: 'insensitive'` — DB-level case-insensitive ILIKE  
✅ Searches `name`, `externalId` (testCode), `userCode` — all required fields  
✅ NOT fetch-all-then-filter: single `findMany` with OR filters  
✅ In-memory sort/rank applied AFTER DB returns tenant-scoped matches  
✅ `limit` clamped: `Math.min(Math.max(..., 1), 50)` — cap enforced  
✅ Empty q throws 400 (`BadRequestException`)  

---

## Service: listTopTestsForOperator (line 250)

```typescript
async listTopTestsForOperator(tenantId: string) {
  const rows = await this.prisma.tenantTopTest.findMany({
    where: { tenantId },            // ← tenant-scoped
    orderBy: { rank: 'asc' },
    include: { test: { select: {..., isActive: true } } }
  });
  return rows
    .filter(row => row.test?.isActive)   // soft-deleted tests excluded
    .map(row => this.formatCatalogTestSearchResult(row.test))
    .slice(0, 10);                        // hard cap 10
}
```

✅ `tenantId` in WHERE  
✅ Ordered by `rank` (preserves admin-defined order)  
✅ Inactive tests filtered out client-side after join  
✅ Hard cap of 10  

---

## Service: setTopTests (line 277)

```typescript
async setTopTests(tenantId, testIds, actorUserId, correlationId?) {
  // validates array, max 10, no duplicates
  // verifies all testIds belong to THIS tenant and are active
  await this.prisma.$transaction(async tx => {
    await tx.tenantTopTest.deleteMany({ where: { tenantId } });  // atomic replace
    await tx.tenantTopTest.createMany({ data: ... });
  });
  await this.audit.log({ action: 'catalog.test.top.update', tenantId, ... });
  return this.listTopTestsForOperator(tenantId);
}
```

✅ Validates testIds belong to tenant before saving  
✅ Atomic transaction (delete + create)  
✅ Audit event logged  
✅ No cross-tenant update possible  

---

## Verdict

| Check | Result |
|---|---|
| tenantId enforced in all queries | ✅ From JWT, never query param |
| Normalization: trim + lowercase + collapse spaces | ✅ `normalizeCatalogSearchQuery` |
| Search by name | ✅ `{ name: { contains: q, mode: 'insensitive' } }` |
| Search by testCode (externalId) | ✅ `{ externalId: { contains: q, mode: 'insensitive' } }` |
| Search by userCode | ✅ `{ userCode: { contains: q, mode: 'insensitive' } }` |
| Ranking: exact > prefix > contains | ✅ `getCatalogSearchRank` returns 1/2/3 |
| limit default 20, cap 50 | ✅ `Math.min(Math.max(..., 1), 50)` |
| No fetch-all-then-filter | ✅ WHERE clause used, not post-load filter |
| Empty q → 400 | ✅ `throw new BadRequestException` |
| No alias logic | ✅ Confirmed absent |
