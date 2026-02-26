# Feature Flag Governance — Vexel Health Platform

## Overview

Feature flags in Vexel are **backend-authoritative and tenant-scoped**. The frontend never decides feature availability — it always reads from the backend-resolved flag map.

---

## Where Things Live

| Artifact | Path | Purpose |
|----------|------|---------|
| **Registry** (source of truth) | `apps/api/src/feature-flags/registry.ts` | All flag definitions — must be updated here before any flag is used |
| **Service** | `apps/api/src/feature-flags/feature-flags.service.ts` | DB reads, default merging, module cascade, audit |
| **Controller** | `apps/api/src/feature-flags/feature-flags.controller.ts` | REST endpoints |
| **OpenAPI contract** | `packages/contracts/openapi.yaml` | Contract for new endpoints |
| **SDK types** | `packages/sdk/src/generated/api.d.ts` | Auto-generated — do not edit |
| **Operator hook** | `apps/operator/src/hooks/use-feature-flags.ts` | Fetches resolved flags, 30s TTL cache |
| **Operator nav config** | `apps/operator/src/components/nav/nav-config.ts` | Sidebar uses `featureFlag` key to show/hide items |
| **Admin UI** | `apps/admin/src/app/(protected)/feature-flags/page.tsx` | Admin controls for per-tenant flags |

---

## Naming Conventions

```
module.<app>                          # Main app kill-switches
<app>.<feature>.enabled               # Boolean feature flag
<app>.<feature>.<sub>.enabled         # Sub-feature boolean flag
<app>.operator.<feature>.enabled      # Operator UI visibility (keep minimal)
```

### Rules
- All keys are **lowercase** with dots as separators
- Module keys: `module.<app>` (e.g., `module.lims`, `module.opd`)
- Feature keys under an app: `<app>.<feature>` (e.g., `lims.verification.enabled`)
- Never use `_` in new keys — use `.` only
- Operator UI visibility flags are only for features where the UI toggle is meaningfully separate from the backend feature. Avoid creating redundant pairs.

---

## Status Values

| Status | Meaning |
|--------|---------|
| `implemented` | Fully built — toggling has runtime effect |
| `scaffold` | Code skeleton exists, toggle partially wired |
| `planned` | Listed as placeholder only — toggle has NO runtime effect yet |
| `deprecated` | Superseded by another key — kept for DB migration only |

## Build Status Values

| Build Status | Meaning |
|-------------|---------|
| `built` | Feature is fully implemented and deployed |
| `scaffold` | Basic structure exists, not production-ready |
| `planned` | Not yet started |

---

## Dependency Rules (Module Cascading)

When `module.X` is **OFF**, all flags with `dependsOn: ['module.X']` are **forced OFF** in `getResolvedFlags()` output, regardless of their DB value.

Example:
```
module.lims = false
→ lims.verification.enabled = false (effective)
→ lims.operator.sample.receiveSeparate.enabled = false (effective)
→ lims.operator.barcode.enabled = false (effective)
```

This is enforced server-side in `FeatureFlagsService.getResolvedFlags()`. Clients receive the already-cascaded result from `GET /api/feature-flags/resolved`.

---

## Verification Flag (Canonical)

**Single flag**: `lims.verification.enabled`  
**Default**: `true` (verification is ON by default)

| Value | Behavior |
|-------|----------|
| `true` | Verification step is active. Results submission creates "pending verification" state. A verifier must approve before publishing. Verification nav/pages are shown in Operator UI. |
| `false` | No separate verification. Results submission auto-transitions to verified. Verification nav disappears from Operator UI. Direct navigation to `/lims/verification/*` redirects to `/lims/results`. |

**Verification Mode** (when `lims.verification.enabled=true`):

| `lims.verification.mode` | Behavior |
|--------------------------|----------|
| `separate` (default) | Dedicated Verification worklist page. Operators submit; verifiers verify separately. |
| `inline` | Operators can Submit & Verify in one action on the results entry screen. |

### Deprecated verification flags
- `lims.operator.verificationPages.enabled` — was redundant with `lims.verification.enabled`. Nav now only checks `lims.verification.enabled`.
- `lims.auto_verify` — was a confusingly named inverse of `lims.verification.enabled`. Deprecated.

---

## How to Add a New Flag

1. **Add to registry** (`apps/api/src/feature-flags/registry.ts`):
   ```typescript
   {
     key: 'lims.my_new_feature.enabled',
     app: 'lims',
     group: 'app-features',
     label: 'My New Feature',
     description: 'What this does when enabled.',
     valueType: 'boolean',
     status: 'planned',        // change to 'implemented' when built
     buildStatus: 'planned',   // change to 'built' when shipped
     defaultValue: false,
     dependsOn: ['module.lims'],
   }
   ```

2. **Use in backend service**:
   ```typescript
   const enabled = await this.featureFlagsService.isEnabled(tenantId, 'lims.my_new_feature.enabled');
   ```

3. **Use in Operator UI** (add to nav or gate a component):
   ```typescript
   // In nav-config.ts (for sidebar items):
   { label: 'My Feature', href: '/lims/my-feature', icon: SomeIcon, featureFlag: 'lims.my_new_feature.enabled' }

   // In a component:
   const { flags } = useFeatureFlags();
   if (!flags['lims.my_new_feature.enabled']) return null;
   ```

4. **Update OpenAPI** if the flag affects an API endpoint (add notes to endpoint description).

5. **Rebuild API** → Admin UI will automatically show the new flag in the Feature Flags page (pulled from `/feature-flags/definitions`).

---

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/feature-flags/definitions` | JWT | Registry definitions (Admin UI) |
| `GET` | `/feature-flags/resolved` | JWT | Effective resolved flags for current tenant |
| `GET` | `/feature-flags` | JWT + `feature_flag:read` | Raw DB values for tenant |
| `PUT` | `/feature-flags/:key` | JWT + `feature_flag:set` | Set a single flag |
| `GET` | `/tenants/:id/feature-flags` | JWT + `feature_flag:read` | Admin: read flags for any tenant |
| `PUT` | `/tenants/:id/feature-flags` | JWT + `feature_flag:set` | Admin: set flags for any tenant |

Every write operation produces an `AuditEvent` with `action: 'feature_flag.set'` or `'feature_flag.set_variant'`.

---

## Tenant Isolation

- Every `TenantFeature` row has `tenantId` — all reads/writes are tenant-scoped
- `getResolvedFlags(tenantId)` always requires an explicit `tenantId`
- Cross-tenant reads are prohibited — each tenant sees only its own flag values
- System-wide defaults live in the registry `defaultValue` field (not in DB)

---

## Current Flag Catalog

### Main Apps

| Key | Label | Build Status | Default |
|-----|-------|-------------|---------|
| `module.lims` | LIMS | Built | true |
| `module.opd` | OPD | Scaffold | false |
| `module.rad` | Radiology | Scaffold | false |
| `module.ipd` | IPD | Scaffold | false |
| `module.printing` | Printing | Built | true |

### LIMS Features

| Key | Label | Build Status | Default |
|-----|-------|-------------|---------|
| `lims.verification.enabled` | Verification Step | Built | true |
| `lims.verification.mode` | Verification Mode | Built | `separate` |
| `lims.operator.sample.receiveSeparate.enabled` | Separate Specimen Receive | Built | false |
| `lims.operator.barcode.enabled` | Barcode Scanning | Scaffold | false |
| `lims.printing.results` | Print from Results | Planned | false |
| `lims.barcode.labels` | Barcode Labels | Planned | false |
| `lims.qc.enabled` | Quality Control | Planned | false |
| `lims.delta_checks.enabled` | Delta Checks | Planned | false |
| `lims.outsource.enabled` | Outsource Tests | Planned | false |
| `lims.microbiology.enabled` | Microbiology | Planned | false |
| `lims.blood_bank.enabled` | Blood Bank | Planned | false |

### OPD Features (all Planned/Scaffold)

| Key | Label |
|-----|-------|
| `opd.providers` | Providers |
| `opd.appointments` | Appointments |
| `opd.scheduling` | Scheduling |
| `opd.vitals` | Vitals |
| `opd.clinical_note` | Clinical Notes |
| `opd.prescription_free_text` | Free-text Prescription |
| `opd.billing` | Billing |
| `opd.invoice_receipt_pdf` | Invoice/Receipt PDF |

### Deprecated Keys (do not use in new code)

| Key | Replaced by |
|-----|-------------|
| `lims.auto_verify` | `lims.verification.enabled=false` |
| `lims.print_results` | `lims.printing.results` (planned) |
| `lims.operator.verificationPages.enabled` | `lims.verification.enabled` |
