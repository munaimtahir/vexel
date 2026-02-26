# Feature Flags Audit — 2026-02-26

## Summary

This audit documents the state of the feature flag system before and after the governance overhaul implemented in this session.

---

## Current Flag Inventory (pre-overhaul)

| Key | Type | Backend? | Operator UI? | Admin UI? | Notes |
|-----|------|----------|--------------|-----------|-------|
| `module.lims` | boolean | ✅ FLAG_DEFAULTS | ✅ sidebar filter | ✅ | Kill-switch; was not cascading sub-flags |
| `module.opd` | boolean | ✅ FLAG_DEFAULTS | ✅ sidebar filter | ✅ | |
| `module.rad` | boolean | ✅ FLAG_DEFAULTS | — | ✅ | |
| `module.ipd` | boolean | ✅ FLAG_DEFAULTS | — | ✅ | |
| `module.printing` | boolean | ✅ FLAG_DEFAULTS | — | ✅ | |
| `lims.auto_verify` | boolean | ✅ listed | — | ✅ Sub-Features section | **DEPRECATED** — replaced by `lims.verification.enabled=false` |
| `lims.print_results` | boolean | ✅ listed | — | ✅ Sub-Features section | **DEPRECATED** — replaced by `lims.printing.results` |
| `lims.verification.enabled` | boolean | ✅ FLAG_DEFAULTS (default: true) | ✅ hook helper `isVerificationVisible()` | ✅ Verification section | **CANONICAL** verification toggle |
| `lims.verification.mode` | enum/variant | ✅ VARIANT_FLAG_DEFAULTS (default: `{mode:'separate'}`) | ✅ hook helper `getVerificationMode()` | ✅ VariantFlagRow | Values: `separate`, `inline` |
| `lims.operator.verificationPages.enabled` | boolean | ✅ FLAG_DEFAULTS (default: true) | ✅ hook helper `isVerificationVisible()` | ✅ Verification section | **REDUNDANT** with `lims.verification.enabled` — deprecated |
| `lims.operator.sample.receiveSeparate.enabled` | boolean | ✅ FLAG_DEFAULTS (default: false) | ✅ `isReceiveSeparate()` | ✅ Verification section | **CANONICAL** sample receive toggle |
| `lims.operator.barcode.enabled` | boolean | ✅ FLAG_DEFAULTS (default: false) | ✅ `isBarcodeEnabled()` | — not shown | Scaffold |

---

## Problems Found (pre-overhaul)

### 🐛 BUG: Sidebar never shows Verification nav item
- `apps/operator/src/components/nav/nav-config.ts` had `featureFlag: 'lims.verification'`
- Sidebar did: `flags?.['lims.verification']` → always `undefined` → item always hidden
- The real key is `lims.verification.enabled`
- **Fixed**: changed to `featureFlag: 'lims.verification.enabled'`

### 🐛 BUG: Module kill-switches did NOT cascade to sub-features
- `getResolvedFlags()` applied DB overrides but never forced sub-flags OFF when parent module was OFF
- e.g., `module.lims=false` did NOT force `lims.verification.enabled=false` in resolved output
- **Fixed**: Added cascade loop in `getResolvedFlags()` using `dependsOn` from registry

### 🐛 BUG: Stale flag cache in Operator app
- Module-level `_cache` in `use-feature-flags.ts` never expired
- After Admin changed a flag, Operator showed stale values until hard reload + module re-init
- **Fixed**: Added 30-second TTL. Cache busts on re-fetch after TTL expires.

### ⚠️ REDUNDANCY: Three overlapping verification toggles
- `lims.verification.enabled` — controls whether verification step exists
- `lims.operator.verificationPages.enabled` — controls whether verification PAGES show in nav
- `lims.verification.mode` — controls how verification is done (separate/inline)
- The first two were **both required** to be ON for verification nav to appear, but they were exposed as independent toggles, confusing admins
- **Fixed**: `lims.operator.verificationPages.enabled` deprecated. Nav now uses only `lims.verification.enabled`. `lims.verification.mode` kept as it has distinct semantic meaning.

### ⚠️ No typed registry
- Flag definitions were split between `MODULE_KILL_SWITCHES[]`, `FLAG_DEFAULTS{}`, and `VARIANT_FLAG_DEFAULTS{}` in the service
- Frontend defaults duplicated in `use-feature-flags.ts`
- No `status` or `buildStatus` metadata
- **Fixed**: Created `apps/api/src/feature-flags/registry.ts` as single source of truth

### ⚠️ Admin UI unstructured
- All flags shown in 3 flat sections (Module Toggles, Sub-Features, Verification Workflow)
- No search, no build status badges, no planned placeholder visibility
- `lims.verification.mode` shown as dropdown inside same section as boolean toggles
- **Fixed**: Rebuilt Admin UI with two structured sections (Main Apps / App Features), collapsible per-app groupings, build status badges, search filter, "TODO" badges for planned flags

### ⚠️ No route guards on verification pages
- Users could navigate directly to `/lims/verification` even when `lims.verification.enabled=false`
- **Fixed**: Created `layout.tsx` in verification route group that redirects to `/lims/results` when flag is off

---

## Migration Plan

### Keys to keep (canonical)
| Key | Action |
|-----|--------|
| `module.lims` | Keep |
| `module.opd` | Keep |
| `module.rad` | Keep |
| `module.ipd` | Keep |
| `module.printing` | Keep |
| `lims.verification.enabled` | Keep — **single canonical verification toggle** |
| `lims.verification.mode` | Keep — distinct semantic value (separate vs inline) |
| `lims.operator.sample.receiveSeparate.enabled` | Keep |
| `lims.operator.barcode.enabled` | Keep |

### Keys deprecated (no longer functional, kept for data migration)
| Key | Action |
|-----|--------|
| `lims.auto_verify` | **Deprecated** — migrate: if `enabled=true` then set `lims.verification.enabled=false` |
| `lims.print_results` | **Deprecated** — future replacement: `lims.printing.results` |
| `lims.operator.verificationPages.enabled` | **Deprecated** — nav now uses `lims.verification.enabled` |

### One-time DB migration script (optional, not run automatically)
```sql
-- Migrate lims.auto_verify → lims.verification.enabled
UPDATE tenant_features
SET key = 'lims.verification.enabled', enabled = NOT enabled
WHERE key = 'lims.auto_verify';

-- Delete deprecated keys after migration
DELETE FROM tenant_features WHERE key IN (
  'lims.operator.verificationPages.enabled',
  'lims.print_results'
);
```
**Note**: Run this script manually after confirming no tenants depend on the old keys.

---

## Changes Made (this session)

### Backend (`apps/api`)
- Created `apps/api/src/feature-flags/registry.ts` — typed `FeatureFlagDefinition[]` array (single source of truth)
- Updated `feature-flags.service.ts`:
  - Replaced `MODULE_KILL_SWITCHES`, `FLAG_DEFAULTS` hardcoded arrays with registry-derived values
  - Added `getDefinitions()` method
  - Fixed `getResolvedFlags()` to cascade module kill-switches via `dependsOn`
- Updated `feature-flags.controller.ts`: added `GET /feature-flags/definitions` endpoint

### Contract + SDK
- Updated `packages/contracts/openapi.yaml`: added `FeatureFlagDefinition` schema + `/feature-flags/definitions` path
- Regenerated `packages/sdk/src/generated/api.d.ts`

### Operator (`apps/operator`)
- Fixed `components/nav/nav-config.ts`: `featureFlag: 'lims.verification'` → `featureFlag: 'lims.verification.enabled'`
- Fixed `hooks/use-feature-flags.ts`: module-level cache now has 30s TTL; added `invalidateFlagsCache()` export
- Created `app/(protected)/lims/verification/layout.tsx`: route guard redirects to `/lims/results` when verification is disabled

### Admin (`apps/admin`)
- Completely rebuilt `app/(protected)/feature-flags/page.tsx`:
  - Pulls definitions from `GET /feature-flags/definitions`
  - Section 1: "Main Apps" — table with build status badges
  - Section 2: "App Features" — collapsible per-app sections, planned flags show "TODO" badge, toggles disabled for planned flags
  - Search/filter by key or label
  - Toast notification on save

---

## How to Verify Manually

1. **Nav fix**: Log in as operator → should see "Verification" in sidebar (it was always hidden before due to wrong flag key)
2. **Toggle verification OFF**:
   - Admin → Feature Flags → LIMS → Verification Step → toggle OFF
   - Operator → hard refresh → "Verification" disappears from sidebar
   - Navigate directly to `/lims/verification` → should redirect to `/lims/results`
3. **Toggle verification ON** → sidebar shows Verification again
4. **Module kill-switch**:
   - Admin → toggle `module.lims` OFF
   - Call `GET /api/feature-flags/resolved` → all `lims.*` flags should show `false`
5. **Admin UI structure**: Flags page should show two sections with collapsible groups per app, build badges, and search
6. **Planned flags**: LIMS planned features (QC, Delta Checks, etc.) should appear in LIMS section with "TODO" badge and disabled toggle

---

## Remaining Items (not implemented in this session)

- DB migration script to clean deprecated keys (run manually when ready)
- Unit tests for `getResolvedFlags()` cascade logic
- E2E tests (Playwright): toggle verification ON/OFF → sidebar updates
- Workflow semantics: auto-verify on submit when `lims.verification.enabled=false` (currently only the UI hides the verification nav; backend does not auto-verify)
- Remove `lims.verification.mode=disabled` enum option (was used as a third state alongside the deprecated `lims.operator.verificationPages.enabled`; now `lims.verification.enabled=false` is the canonical OFF state)
