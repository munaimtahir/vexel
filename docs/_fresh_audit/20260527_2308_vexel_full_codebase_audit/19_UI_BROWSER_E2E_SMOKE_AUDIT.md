# UI Browser E2E Smoke Audit (Playwright)

Primary evidence:
- Initial smoke run (failed due missing browser binaries): `test-results/phase16_e2e_smoke.txt`
- Browser install log: `logs/phase16_playwright_install_browsers.txt`
- Smoke rerun (real execution): `test-results/phase16_e2e_smoke.rerun.txt`
- Playwright report: `e2e/playwright-report/index.html`
- Playwright results: `e2e/test-results/results.json`

## Findings (this run)

### Environment precondition
Initial run failed because Playwright Chromium executables were not installed.
After running the repo-provided install script, Chromium and headless shell were installed successfully.

Evidence:
- `logs/phase16_playwright_install_browsers.txt`
- Initial failure mode is visible in `apps/e2e/test-results/results.json` from the first run (browser executable missing).

### Smoke suite outcome
After installing browsers:
- `pnpm --filter @vexel/e2e e2e:smoke` => **PASS**
- Summary: `41 passed` (operator + admin smoke suites)
(Evidence: `test-results/phase16_e2e_smoke.rerun.txt`)

Coverage highlights (from run output):
- Operator: login, sidebar navigation, protected-route redirects, LIMS single-test workflow, document publish + download UI.
- Admin: login, dashboard renders, sidebar visible after login.
- Tenancy safety checks (spoofed tenant header) included and passed.

## Verdict (this run)

**UI E2E SMOKE PASS**

