# Template Provisioning

This document describes how system blueprint templates are provisioned into tenant-owned templates.

## Provisioning Model

The platform ships with **TemplateBlueprint** rows — system-owned starter definitions for each supported template family.

When a new tenant is onboarded (or when explicitly triggered), selected blueprints are copied into tenant-owned `PrintTemplate` rows. From that point on, the tenant owns their templates and can modify them independently. **Tenants are not live-bound to blueprints.**

## Starter Blueprint Pack

The following blueprints are seeded at startup:

| Code | Name | Family | Schema |
|------|------|--------|--------|
| `general_table_v1` | Standard General Report | `GENERAL_TABLE` | `TABULAR` |
| `two_column_table_v1` | Compact Two Column Report | `TWO_COLUMN_TABLE` | `TABULAR` |

## Provisioning Rules

- Blueprints are provisioned as `ACTIVE` `PrintTemplate` rows with `templateVersion = 1`.
- Templates are marked `isSystemProvisioned = true`.
- If a tenant already has an active template sourced from the same blueprint, it is **skipped** (unless `overwriteExisting = true` is passed).
- Each tenant gets independent copies — modifying one tenant's template does not affect any other tenant.

## How to Provision

### During onboarding

Call the provisioning service from your onboarding flow:

```typescript
await templatesService.provisionDefaults(tenantId, actorUserId, correlationId);
```

This provisions all active blueprints for the tenant.

### Via Admin API

Admin users with `templates.provision` permission can trigger provisioning:

```
POST /admin/template-blueprints/provision-defaults
Body: { "blueprintCodes": ["general_table_v1"], "overwriteExisting": false }
```

Omitting `blueprintCodes` provisions all active blueprints.

### Via Seed Script

The seed file provisions a default `GENERAL_TABLE` template for the system tenant. Existing tenant provisioning should be triggered via the API or onboarding service after tenants are created.

## Post-Provisioning Behavior

After provisioning:
1. The tenant has at least one `ACTIVE` template.
2. Any `TABULAR` tests that are mapped via `TestTemplateMap` will resolve to this template at report time.
3. If no explicit `TestTemplateMap` exists for a test, `resolveReportTemplate()` falls back to the tenant's active `GENERAL_TABLE` template.
4. Existing documents generated before the template system was introduced continue to work unchanged.

## Audit Trail

Every provisioning action is logged via `AuditService`:

```json
{
  "action": "template.provision",
  "entityType": "PrintTemplate",
  "entityId": "<template-id>",
  "tenantId": "<tenant-id>",
  "actorUserId": "<user-id>",
  "after": { "code": "general_table_v1", "blueprintId": "bp-general-table-v1" }
}
```

## Adding New Blueprints

1. Add a new entry to the `templateBlueprints` upsert block in `apps/api/prisma/seed.ts`.
2. Use a stable, globally unique `id` (e.g. `bp-peripheral-film-v1`).
3. Set `isActive: true` and `sortOrder` appropriately.
4. Run the seed script on the target environment.
5. Existing tenants do **not** automatically receive new blueprints — provisioning must be triggered explicitly.
