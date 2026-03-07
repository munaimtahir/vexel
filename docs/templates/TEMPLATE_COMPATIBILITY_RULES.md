# Template Compatibility Rules

This document defines the validation rules that govern which templates can be used with which tests.

## Core Constraint

**A template may only be mapped to a test if:**
1. Both belong to the same tenant.
2. The template is not `ARCHIVED`.
3. The template's `schemaType` matches the test's `resultSchemaType`.

Violation of any constraint returns a `400 Bad Request` from the API.

## Family ↔ Schema Type Matrix

Not every template family supports every schema type. The compatibility matrix is defined in `apps/api/src/templates/templates-validation.ts`:

| Template Family | Allowed Schema Types |
|----------------|---------------------|
| `GENERAL_TABLE` | `TABULAR` |
| `TWO_COLUMN_TABLE` | `TABULAR` |
| `PERIPHERAL_FILM_REPORT` | `DESCRIPTIVE_HEMATOLOGY` |
| `HISTOPATH_NARRATIVE` | `HISTOPATHOLOGY` |
| `GRAPHICAL_SCALE_REPORT` | `GRAPH_SERIES` |
| `IMAGE_REPORT` | `IMAGE_ATTACHMENT` |

This matrix is validated at template **creation** time. A template's `schemaType` must be in the list of allowed schema types for its `templateFamily`.

## Creation-Time Validation

When creating a template:

```
validateFamilySchemaCompatibility(templateFamily, schemaType)
→ { valid: boolean, message?: string }
```

If `valid` is false, the request is rejected with `400 Bad Request` and the error message explains the incompatibility.

## Mapping-Time Validation

When mapping a template to a test via `PUT /admin/catalog/tests/{testId}/templates`:

1. **Tenant match**: `template.tenantId === test.tenantId` — enforced server-side; frontend cannot bypass.
2. **Status check**: `template.status !== 'ARCHIVED'`
3. **Schema match**: `template.schemaType === test.resultSchemaType`
4. **Single default**: At most one mapping per test may have `isDefault = true`

If any validation fails, the entire mapping update is rejected — the existing mappings remain unchanged.

## One Default Per Test

Only one `TestTemplateMap` row per `testId` may have `isDefault = true` at any given time.

Attempting to set two mappings as default in the same `PUT` request returns:
```json
{ "error": "Only one mapping may be set as default" }
```

## Archiving Constraints

A template **cannot be archived** if it is the `isDefault = true` mapping for any enabled `TestTemplateMap`. The error response will indicate how many tests are affected. The admin must reassign the default first.

## `allowTemplateOverride`

When `CatalogTest.allowTemplateOverride = true`, the operator can choose from any enabled mapped template at publish time (operator-side UI — not yet implemented, reserved for a future phase).

When `allowTemplateOverride = false` (default), only the default mapped template is used for that test.

## Fallback Resolution

If no `TestTemplateMap` exists for a test:
1. `resolveReportTemplate()` falls back to the tenant's active `GENERAL_TABLE` template.
2. If no `GENERAL_TABLE` template exists for the tenant, returns `null` → backward-compatible legacy behavior (no template metadata in payload).

## Error Codes

| Scenario | HTTP Status | Message Pattern |
|----------|-------------|-----------------|
| Invalid family | 400 | `Invalid templateFamily: X` |
| Invalid schema type | 400 | `Invalid schemaType: X` |
| Family/schema incompatibility | 400 | `Template family X is not compatible with schema type Y` |
| Template not found in tenant | 400 | `Template X not found in this tenant` |
| Template is archived | 400 | `Template X is archived and cannot be mapped` |
| Schema type mismatch on mapping | 400 | `Template X schemaType (A) does not match test schemaType (B)` |
| Multiple defaults | 400 | `Only one mapping may be set as default` |
| Archive blocked by default mapping | 409 | `Cannot archive: this template is the default for N test(s)` |
| Activate non-DRAFT | 409 | `Cannot activate — template is X (must be DRAFT)` |
| New version of non-ACTIVE | 409 | `Cannot create new version — template must be ACTIVE (current: X)` |

## Extending the Matrix

To add a new family/schema combination:

1. Edit `FAMILY_SCHEMA_COMPATIBILITY` in `apps/api/src/templates/templates-validation.ts`.
2. Add unit tests for the new combination.
3. No database migration needed.
