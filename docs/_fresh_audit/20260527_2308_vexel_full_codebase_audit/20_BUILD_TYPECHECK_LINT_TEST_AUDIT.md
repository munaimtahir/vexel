# Build, Typecheck, Lint, Test Audit

Primary evidence:
- Install: `logs/phase17_pnpm_install.txt` (+ exitcode file)
- UI color lint: `test-results/phase17_ui_color_lint.txt`
- API tests: `test-results/phase17_api_test.txt`
- Root lint: `test-results/phase17_root_lint.rerun.txt` (+ exitcode)
- Root build: `test-results/phase17_root_build.txt` (+ exitcode)
- SDK build: `test-results/phase17_sdk_build.txt`
- SDK test: `test-results/phase17_sdk_test.rerun.txt` (+ exitcode)
- Playwright smoke: `test-results/phase16_e2e_smoke.rerun.txt`

## Command matrix (this run)

| Command | Area | Exit Code | PASS/FAIL | Log Path | Blocking? | Notes |
|---|---|---:|---|---|---|---|
| `pnpm install --frozen-lockfile` | root | 0 | PASS | `logs/phase17_pnpm_install.txt` | Yes | Warning: pnpm.overrides in worker not effective |
| `pnpm ui:color-lint` | UI tokens | 0 | PASS | `test-results/phase17_ui_color_lint.txt` | Yes | No hard-coded hex outside token files |
| `pnpm --filter @vexel/api test` | API | 0 | PASS | `test-results/phase17_api_test.txt` | Yes | 28/28 suites, 204 tests; warns about leaked handles and queue probe |
| `pnpm lint` | monorepo | 1 | FAIL | `test-results/phase17_root_lint.rerun.txt` | Yes (repo-wide gate) | Failure: `apps/mobile` missing `@expo/vector-icons` import resolution |
| `pnpm build` | monorepo | 0 | PASS | `test-results/phase17_root_build.txt` | Yes | Turbo build succeeded |
| `pnpm --filter @vexel/sdk build` | SDK | 0 | PASS | `test-results/phase17_sdk_build.txt` | Yes | `tsc --noEmit` |
| `pnpm --filter @vexel/sdk test` | SDK | 1 | FAIL | `test-results/phase17_sdk_test.rerun.txt` | Medium | `jest` not found in sdk package env |
| `pnpm --filter @vexel/e2e e2e:smoke` | E2E | 0 | PASS | `test-results/phase16_e2e_smoke.rerun.txt` | Yes | 41 passed |

## Summary (this run)

Passes:
- Build, API tests, UI color lint, E2E smoke.

Failures:
- Repo-wide lint fails due to mobile app dependency resolution.
- SDK test script fails (`jest` not installed/available).

