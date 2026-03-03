#!/usr/bin/env node
/**
 * finalize-evidence.mjs
 * Post-run script: copies Playwright artifacts into OUT/e2e_runs/YYYYMMDD_HHMM/
 * and produces timings.json, console_errors.log, network_summary.json.
 *
 * Run after playwright test completes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(E2E_ROOT, '..', '..');

// Timestamp for run directory
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

const OUT_DIR = path.join(REPO_ROOT, 'OUT', 'e2e_runs', ts);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'traces'), { recursive: true });

console.log(`[evidence] Writing to ${OUT_DIR}`);

// 1. Copy JSON report
const jsonReportSrc = path.join(E2E_ROOT, 'test-results', 'results.json');
if (fs.existsSync(jsonReportSrc)) {
  fs.copyFileSync(jsonReportSrc, path.join(OUT_DIR, 'report.json'));
  console.log('[evidence] report.json copied');
} else {
  console.warn('[evidence] WARNING: test-results/results.json not found — was JSON reporter enabled?');
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ error: 'not generated' }));
}

// 2. Generate summary HTML from JSON report
let reportJson = {};
try {
  reportJson = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'report.json'), 'utf8'));
} catch {}

const suites = reportJson.suites ?? [];
function flattenTests(suites) {
  const tests = [];
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        tests.push({
          title: `${suite.title} > ${spec.title}`,
          status: test.status,
          durationMs: test.results?.[0]?.duration ?? 0,
          error: test.results?.[0]?.error?.message ?? null,
        });
      }
    }
    if (suite.suites) tests.push(...flattenTests(suite.suites));
  }
  return tests;
}
const allTests = flattenTests(suites);
const passed = allTests.filter((t) => t.status === 'passed' || t.status === 'expected').length;
const failed = allTests.filter((t) => t.status === 'failed' || t.status === 'unexpected').length;
const skipped = allTests.filter((t) => t.status === 'skipped').length;

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Vexel LIMS E2E — ${ts}</title>
<style>body{font-family:sans-serif;max-width:900px;margin:2em auto;padding:0 1em}
h1{color:#1a1a2e}table{border-collapse:collapse;width:100%}
th,td{padding:8px 12px;border:1px solid #ddd;text-align:left}
th{background:#f0f0f0}.pass{color:#166534}.fail{color:#991b1b}.skip{color:#92400e}
</style></head><body>
<h1>Vexel LIMS E2E Evidence — ${ts}</h1>
<p><strong>Summary:</strong> ✅ ${passed} passed, ❌ ${failed} failed, ⏭ ${skipped} skipped</p>
<table>
<tr><th>Test</th><th>Status</th><th>Duration</th><th>Error</th></tr>
${allTests.map((t) => `<tr><td>${t.title}</td>
  <td class="${t.status === 'passed' || t.status === 'expected' ? 'pass' : t.status === 'skipped' ? 'skip' : 'fail'}">${t.status}</td>
  <td>${t.durationMs}ms</td>
  <td>${t.error ? t.error.slice(0, 120) : ''}</td></tr>`).join('\n')}
</table>
<p><em>Full HTML report: apps/e2e/playwright-report/index.html</em></p>
</body></html>`;

fs.writeFileSync(path.join(OUT_DIR, 'report.html'), html);
console.log('[evidence] report.html generated');

// 3. Timings
const timingsRaw = path.join(E2E_ROOT, 'test-results', 'timings-raw.json');
let timingsData = [];
if (fs.existsSync(timingsRaw)) {
  try { timingsData = JSON.parse(fs.readFileSync(timingsRaw, 'utf8')); } catch {}
}

// Also extract per-test durations from JSON report
const testTimings = allTests.map((t) => ({
  test: t.title,
  durationMs: t.durationMs,
  warn: t.durationMs > Number(process.env.E2E_WARN_MS ?? 5000),
  critical: t.durationMs > Number(process.env.E2E_CRITICAL_MS ?? 15000),
}));

const worstOffenders = [...testTimings].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);

const timingsSummary = {
  generated: new Date().toISOString(),
  thresholds: {
    warnMs: Number(process.env.E2E_WARN_MS ?? 5000),
    criticalMs: Number(process.env.E2E_CRITICAL_MS ?? 15000),
  },
  testTimings,
  worstOffenders,
  stepTimings: timingsData,
};

fs.writeFileSync(path.join(OUT_DIR, 'timings.json'), JSON.stringify(timingsSummary, null, 2));
console.log('[evidence] timings.json generated');

// 4. Console errors from chaos test (if any)
const chaosErrors = path.join(E2E_ROOT, 'test-results', 'chaos-console-errors.log');
if (fs.existsSync(chaosErrors)) {
  fs.copyFileSync(chaosErrors, path.join(OUT_DIR, 'console_errors.log'));
} else {
  fs.writeFileSync(path.join(OUT_DIR, 'console_errors.log'), '(no console errors recorded)');
}
console.log('[evidence] console_errors.log written');

// 5. Copy traces/screenshots/videos from test-results/
const tracesSrc = path.join(E2E_ROOT, 'test-results');
if (fs.existsSync(tracesSrc)) {
  for (const entry of fs.readdirSync(tracesSrc)) {
    if (entry.endsWith('.zip') || entry.endsWith('.png') || entry.endsWith('.webm')) {
      fs.copyFileSync(path.join(tracesSrc, entry), path.join(OUT_DIR, 'traces', entry));
    }
  }
}
// Copy subdirectory traces (Playwright puts them in nested dirs)
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      fs.mkdirSync(path.join(dest, entry.name), { recursive: true });
      copyDir(path.join(src, entry.name), path.join(dest, entry.name));
    } else if (entry.name.endsWith('.zip') || entry.name.endsWith('.png') || entry.name.endsWith('.webm')) {
      fs.copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
    }
  }
}
copyDir(tracesSrc, path.join(OUT_DIR, 'traces'));
console.log('[evidence] traces copied');

// 6. Network summary (placeholder — real network capture requires trace parsing)
const networkSummary = {
  note: 'Full network traces in traces/ dir. Extract with: npx playwright show-trace <trace.zip>',
  totalTests: allTests.length,
  passedTests: passed,
  failedTests: failed,
};
fs.writeFileSync(path.join(OUT_DIR, 'network_summary.json'), JSON.stringify(networkSummary, null, 2));

// 7. Final summary
console.log(`\n[evidence] ========== Evidence Pack Complete ==========`);
console.log(`[evidence] Output: ${OUT_DIR}`);
console.log(`[evidence] Tests: ${passed} passed, ${failed} failed, ${skipped} skipped`);

const criticalTimings = testTimings.filter((t) => t.critical);
if (criticalTimings.length > 0) {
  console.warn('[evidence] ⚠️  CRITICAL slow tests (>15s):');
  criticalTimings.forEach((t) => console.warn(`  ${t.test}: ${t.durationMs}ms`));
}

// Exit non-zero if there were failures (propagate to CI)
if (failed > 0) {
  console.error(`[evidence] ❌ ${failed} test(s) FAILED`);
  process.exit(1);
}
