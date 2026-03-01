# Base Catalog Seeding

## Overview

When LIMS is enabled for a tenant via `POST /tenants/{tenantId}:enable-lims`, the system can optionally seed that tenant's catalog from the platform base catalog artifact. After seeding, all catalog data is fully tenant-scoped — changes in one tenant never affect others.

## Base Catalog Artifact

**Location:** `apps/api/resources/catalog/`

| File | Description |
|------|-------------|
| `base_catalog_v1.xlsx` | Immutable XLSX workbook with all base catalog data |
| `base_catalog_v1.json` | Metadata: `{ baseVersion, notes, sha256 }` |

**Contents (v1):**
- 3 sample types: Whole Blood, Serum, Urine
- 40 parameters: glucose, CBC parameters, liver/kidney/thyroid/lipid panels, electrolytes, coagulation
- 12 tests: CBC, Blood Sugar (random/fasting), HbA1c, LFT, KFT, Lipid Profile, TFT, Electrolytes, Coag, Uric Acid, Urinalysis
- 3 panels: Basic Metabolic Panel, Comprehensive Metabolic Panel, Thyroid Panel
- Reference ranges for all tests

**SHA256:** `2edfd7dcf7535374cb50f6f5a488592e33e516eecde8787c5a34762cd1e55f95`

## Data Model

New fields added to `Tenant` table:

| Field | Type | Description |
|-------|------|-------------|
| `catalogSeedMode` | `String?` | `BASE_ON_ENABLE` \| `EMPTY` \| `CUSTOM_UPLOAD` |
| `catalogSeededAt` | `DateTime?` | When catalog was seeded (null = not seeded) |
| `catalogSeedBaseVersion` | `String?` | Base version string used (e.g., `2026-03-01`) |
| `catalogSeedHash` | `String?` | SHA256 of XLSX at time of seeding |

## Command Endpoint

```
POST /api/tenants/{tenantId}:enable-lims
Authorization: Bearer <super-admin-token>
Content-Type: application/json

{
  "seedCatalog": true,
  "seedMode": "BASE_ON_ENABLE"
}
```

**Response:**
```json
{
  "limsEnabled": true,
  "catalogSeeded": true,
  "catalogAlreadySeeded": false,
  "seedSummary": {
    "inserted": 58,
    "updated": 0,
    "skipped": 0,
    "baseVersion": "2026-03-01",
    "hash": "2edfd7dc..."
  },
  "tenant": { ... }
}
```

## Idempotency

The `catalogSeededAt` field is the idempotency guard. If it is non-null, calling `enable-lims` again returns `catalogAlreadySeeded: true` and does **not** re-seed. This ensures retries are safe.

## Tenancy Isolation

The `importFromWorkbook()` call writes all rows with the target `tenantId`. All Prisma queries in the catalog import service include `tenantId` in WHERE conditions and `data: { tenantId }` on creation. Cross-tenant contamination is impossible by construction.

## Audit Events

| Action | When |
|--------|------|
| `catalog.seed_from_base` | After successful catalog seed |
| `tenant.lims.enable` | After LIMS flag is set (always) |

Both events include `correlationId`, `tenantId`, `actorUserId`.

## Admin UI

The Tenants page (`/admin/tenants`) shows:
- 🔬 **Enable LIMS** button on each tenant card
- Seed status (seeded date, base version, hash) when already seeded
- Modal with seed mode selection
- Real-time result after enabling

## Seed Modes

| Mode | Behavior |
|------|---------|
| `BASE_ON_ENABLE` | Seeds from `base_catalog_v1.xlsx` (default) |
| `EMPTY` | Enables LIMS with empty catalog; operator imports their own |
| `CUSTOM_UPLOAD` | Intent marker; seeding is handled separately via catalog import UI |
