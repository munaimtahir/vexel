# 01 — OpenAPI Endpoints

Source: `packages/contracts/openapi.yaml`

---

## GET /operator/catalog/tests/search

Lines 3688–3716

```yaml
/operator/catalog/tests/search:
  get:
    operationId: operatorCatalogTestsSearch
    summary: Search catalog tests for operator registration (tenant-scoped)
    tags: [Catalog]
    parameters:
      - name: q
        in: query
        required: true
        schema: { type: string }
      - name: limit
        in: query
        required: false
        schema:
          type: integer
          minimum: 1
          maximum: 50
          default: 20
    responses:
      "200":
        description: Ranked test search results
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/CatalogTestSearchResult'
```

**Auth:** bearerAuth (inherited from controller `@UseGuards(JwtAuthGuard, PermissionsGuard)`)  
**Permission required:** `catalog.read`  
✅ `q` is required  
✅ `limit` optional, default 20, max 50  

---

## GET /operator/catalog/tests/top

Lines 3717–3732

```yaml
/operator/catalog/tests/top:
  get:
    operationId: operatorCatalogTestsTop
    summary: List tenant pinned top tests (up to 10)
    tags: [Catalog]
    responses:
      "200":
        description: Top tests
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/CatalogTestSearchResult'
```

**Auth:** bearerAuth + `catalog.read`  
✅ No query params — returns tenant's pinned list  

---

## PUT /admin/catalog/tests/top

Lines 5090–5112

```yaml
/admin/catalog/tests/top:
  put:
    operationId: adminSetCatalogTopTests
    summary: Set tenant pinned top tests (max 10)
    tags: [Catalog]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/TenantTopTestsUpdate'
    responses:
      "200":
        description: Updated top tests
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/CatalogTestSearchResult'
```

**Auth:** bearerAuth + `catalog.manage`  

---

## Schemas

### CatalogTestSearchResult (lines 462–482)

```yaml
CatalogTestSearchResult:
  type: object
  required: [id, name]
  properties:
    id:           { type: string }
    name:         { type: string }
    testCode:     { type: string, nullable: true }
    userCode:     { type: string, nullable: true }
    sampleTypeName: { type: string, nullable: true }
    departmentName: { type: string, nullable: true }
    price:        { type: number, minimum: 0, nullable: true }
```

### TenantTopTestsUpdate (lines 487–494)

```yaml
TenantTopTestsUpdate:
  type: object
  required: [testIds]
  properties:
    testIds:
      type: array
      maxItems: 10
      items: { type: string }
```

---

## Verdict

| Endpoint | Present | Auth | Correct params |
|---|---|---|---|
| GET /operator/catalog/tests/search | ✅ | bearerAuth + catalog.read | ✅ q required, limit 1-50 default 20 |
| GET /operator/catalog/tests/top | ✅ | bearerAuth + catalog.read | ✅ no params needed |
| PUT /admin/catalog/tests/top | ✅ | bearerAuth + catalog.manage | ✅ testIds array maxItems 10 |
