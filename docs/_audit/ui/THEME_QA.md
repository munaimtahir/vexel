# Theme QA (NeoSlate + Ember)

Generated: 2026-02-26T03:13:06+05:00

## QA Method

- Source audit: semantic token usage, no hard-coded hex/rgb in UI code
- Lint enforcement: `pnpm ui:color-lint`
- Build/lint verification: see command results section
- Visual QA: checklist prepared per app (manual browser pass on local build/deploy recommended after merge)

## Per-App Checklist

### apps/operator

- [x] Shared token CSS imported (`apps/operator/src/app/globals.css`)
- [x] Primary CTA drift removed (blue/violet/cyan/emerald/amber class drift normalized to `primary`)
- [x] Sidebar uses sidebar tokens with Ember active indicator (`apps/operator/src/components/nav/sidebar.tsx`)
- [x] Status badges/chips harmonized (shared `StatusBadge` + status token utilities)
- [x] Legacy inline hex/rgb color literals removed from UI code
- [x] Login page uses NeoSlate + Ember tokenized surfaces and CTA
- [x] Table/list surfaces use neutral card/muted/border tokens in core LIMS pages/components
- [ ] Manual browser visual verification completed for landing/table/form/login (pending runtime check)

### apps/admin

- [x] Shared token CSS imported (`apps/admin/src/app/globals.css`)
- [x] Warm beige palette removed (now inherits NeoSlate shared tokens)
- [x] Sidebar uses sidebar tokens with Ember active indicator (`apps/admin/src/components/sidebar.tsx`)
- [x] Blue/purple CTA drift normalized to Ember primary in admin pages/OPD pages
- [x] Legacy inline hex/rgb color literals removed from UI code
- [x] Login page CTA and surfaces tokenized
- [x] Table/list surfaces use card/muted/border tokens across key admin pages
- [ ] Manual browser visual verification completed for dashboard/table/form/login (pending runtime check)

## Cross-App Rule Checks

- [x] No component-level hex colors remain in `apps/admin/src` and `apps/operator/src`
- [x] No Tailwind arbitrary hex classes (`bg-[#...]`, `text-[#...]`) remain in UI code
- [x] Shared token source established at `packages/theme/styles/neoslate-ember.css`
- [x] Shared `StatusBadge` component implemented in `packages/theme/src/status-badge.tsx`
- [x] Repo-level `ui:color-lint` added and CI wired

## Command Results

- `pnpm ui:color-lint`: PASS
- `pnpm --filter @vexel/operator lint`: FAIL (`eslint` package missing in workspace; Next lint exits before rule execution)
- `pnpm --filter @vexel/admin lint`: FAIL (`eslint` package missing in workspace; Next lint exits before rule execution)
- `pnpm --filter @vexel/operator build`: PASS (build completed; emitted non-fatal trace-copy warning for one client-reference-manifest file during standalone copy)
- `pnpm --filter @vexel/admin build`: PASS

## Notes

- Error vs empty-state branching was spot-checked in key list pages (`operator` worklist/results/sample collection, `admin` documents/encounters/patients/jobs). Patterns already mostly followed `!loading && !error && empty`; no business logic changes were made.
- A full visual browser pass should be run against local builds or the deployed stack before production deployment.
