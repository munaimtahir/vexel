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

## Manual Checklist (run after each deploy)
- [ ] `/login` renders with branded header, no sidebar
- [ ] `/lims/worklist` renders with sidebar + topbar
- [ ] Sidebar collapses and state persists across reload
- [ ] Dark mode toggle works
- [ ] DUE badge appears in red for encounters with outstanding balance
- [ ] No `fetch(` in operator or admin source files

## How to Run All Gates
```bash
cd /srv/apps/vexel
cd apps/operator && npx tsc --noEmit && npx next lint
cd ../admin && npx tsc --noEmit && npx next lint
```
