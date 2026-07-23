# UI Flow Audit — LIMS Production Gate

## Operator App Route Coverage

All active LIMS routes are under `/lims/*` as required by the UI Shell Governance rules.
Non-lims routes (`/encounters/*`) are redirect stubs.

| Route | Purpose | Status |
|-------|---------|--------|
| `/lims/worklist` | Encounter worklist | ✅ Present |
| `/lims/registrations/new` | Patient registration + order | ✅ Present |
| `/lims/encounters/[id]` | Encounter detail | ✅ Present |
| `/lims/encounters/[id]/order` | Lab ordering | ✅ Present |
| `/lims/encounters/[id]/sample` | Sample collection | ✅ Present |
| `/lims/encounters/[id]/receive` | Sample receipt | ✅ Present |
| `/lims/encounters/[id]/results` | Results entry | ✅ Present |
| `/lims/encounters/[id]/verify` | Verification | ✅ Present |
| `/lims/encounters/[id]/publish` | Publish report | ✅ Present |
| `/lims/encounters/[id]/reports` | View reports | ✅ Present |
| `/lims/sample-collection` | Sample collection worklist | ✅ Present |
| `/lims/results` | Results worklist | ✅ Present |
| `/lims/results/[orderedTestId]` | Single test result entry | ✅ Present |
| `/lims/results/encounters/[encounterId]` | Encounter results | ✅ Present |
| `/lims/verification` | Verification queue | ✅ Present |
| `/lims/verification/encounters/[encounterId]` | Patient verification | ✅ Present |
| `/lims/reports` | Published documents | ✅ Present |
| `/lims/print/[id]` | Print view | ✅ Present |
| `/lims/payments` | Cash payments | ✅ Present |
| `/lims/patients` | Patient list | ✅ Present |
| `/lims/patients/new` | New patient form | ✅ Present |

## Legacy Route Handling

| Route | Action | Status |
|-------|--------|--------|
| `/encounters` | `router.replace('/lims/encounters')` | ✅ Redirect |
| `/encounters/new` | `redirect('/lims/registrations/new')` | ✅ Redirect |
| `/encounters/[id]/*` | All subpaths duplicated as redirects | ✅ Redirect |

## Shell Compliance

- All `(protected)` pages render inside `AppShell` via `apps/operator/src/app/(protected)/layout.tsx`
- `(public)` pages (login) render without sidebar
- Route groups `(protected)` and `(public)` are correctly separated

## SDK-Only Enforcement

- Every API call in operator uses `getApiClient()` from `@vexel/sdk`
- No raw `fetch()` or `axios` imports found in operator or admin source
- CI job `sdk-only-enforcement` enforces this on every push

## Admin App Coverage (LIMS-relevant)

| Route | Purpose | Status |
|-------|---------|--------|
| `/catalog` | Catalog dashboard | ✅ Present |
| `/catalog/tests` | Test management | ✅ Present |
| `/catalog/parameters` | Parameter management | ✅ Present |
| `/catalog/panels` | Panel management | ✅ Present |
| `/catalog/reference-ranges` | Reference ranges | ✅ Present |
| `/catalog/sample-types` | Sample types | ✅ Present |
| `/catalog/import-export` | Import/Export XLSX | ✅ Present |
| `/encounters` | Encounter list (read-only) | ✅ Present |
| `/documents` | Document list | ✅ Present |
| `/audit` | Audit event log | ✅ Present |
| `/feature-flags` | Tenant feature flags | ✅ Present |
| `/roles` | RBAC role management | ✅ Present |
| `/users` | User management | ✅ Present |
| `/system/health` | System health dashboard | ✅ Present |

## Known UI Limitations (non-blocking for release)

- Results entry page (`/lims/results/[orderedTestId]`) — not smoke-tested end-to-end in this audit run
- Verification flow — pages exist, not smoke-tested in this audit run
- Admin branding UI — form exists, not fully end-to-end verified
