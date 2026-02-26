# UI QA Gates

## Automated Gates

### 1. No-fetch ESLint Rule
- Location: `apps/operator/.eslintrc.json` and `apps/admin/.eslintrc.json`
- Rule: `no-restricted-globals` blocks direct `fetch()` usage in operator and admin apps
- Purpose: Enforce SDK-only data access. All HTTP calls must go through `@vexel/sdk` via `lib/api-client.ts`
- Run: `cd apps/operator && npx next lint`

### 2. TypeScript Strict Check
- Run: `cd apps/operator && npx tsc --noEmit`
- Must exit 0 before any merge

### 3. Tenant-Admin Scope/Contract Audit (manual but mandatory for tenant-admin changes)
- Applies when touching Admin tenant pages (`/tenant-settings*`, `/branding`, `/feature-flags`, tenant-scoped admin workflows)
- Must review `docs/specs/ADMIN_TENANT_SCOPE_GOVERNANCE.md`
- Confirm each changed page declares correct scope mode (`explicit` vs `current-auth`)
- Confirm scope banner is present and accurate
- Confirm every SDK endpoint used by changed pages exists in OpenAPI

## Manual Checklist (run after each deploy)
- [ ] `/login` renders with branded header, no sidebar
- [ ] `/lims/worklist` renders with sidebar + topbar
- [ ] Sidebar collapses and state persists across reload
- [ ] Dark mode toggle works
- [ ] DUE badge appears in red for encounters with outstanding balance
- [ ] No `fetch(` in operator or admin source files
- [ ] Tenant-admin pages show correct tenant scope banner / scope messaging
- [ ] No tenant selector UX implies switching on pages that do not support explicit tenant switching

## How to Run All Gates
```bash
cd /srv/apps/vexel
cd apps/operator && npx tsc --noEmit && npx next lint
cd ../admin && npx tsc --noEmit && npx next lint
```
