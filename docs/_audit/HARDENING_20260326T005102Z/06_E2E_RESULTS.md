# E2E Results

Command:
- `pnpm --filter @vexel/e2e test`

Initial full run identified failures in a few auth/admin specs; targeted fixes were applied.

Final full run stats (`apps/e2e/test-results/results.json`):
- expected: `116`
- unexpected: `0`
- skipped: `3`
- flaky: `0`

Artifacts:
- JSON: `apps/e2e/test-results/results.json`
- HTML report: `apps/e2e/playwright-report/index.html`
