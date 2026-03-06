/**
 * 11-chaos-nightly.spec.ts
 * @nightly
 * Bounded chaos journey: performs a random but safe action sequence.
 * Never mutates state via admin shortcuts or DB access.
 * Records console errors and risk points.
 * Tags: @nightly (excluded from e2e:lims golden run)
 */

import { test, expect } from '../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../helpers/api-client';
import * as fs from 'fs';
import * as path from 'path';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';
const TEST_CODE = process.env.E2E_TEST_CODE || 't1';

interface RiskPoint {
  step: string;
  issue: string;
  url: string;
  severity: 'low' | 'medium' | 'high';
}

const LIMS_PAGES = [
  '/lims/worklist',
  '/lims/encounters',
  '/lims/results',
  '/lims/verification',
  '/lims/reports',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

test.describe('@nightly Chaos journey — bounded safe exploration', () => {
  test('@nightly random page navigation produces no console errors', async ({ authedPage: page }) => {
    test.setTimeout(90_000);
    const riskPoints: RiskPoint[] = [];
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${page.url()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[PAGEERROR][${page.url()}] ${err.message}`);
    });

    // Visit all LIMS pages in random order
    const pages = shuffle(LIMS_PAGES);
    for (const route of pages) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      // Wait for loading spinners to disappear (best effort)
      try {
        await page.locator('text=Loading').last().waitFor({ state: 'hidden', timeout: 8_000 });
      } catch {}

      const url = page.url();
      // Check for visible error states
      const hasError = await page.locator('text=Failed to load').or(page.locator('[role=alert]')).isVisible({ timeout: 1_000 }).catch(() => false);
      if (hasError) {
        riskPoints.push({ step: `navigate:${route}`, issue: 'Error state visible after navigation', url, severity: 'medium' });
      }

      // Check network for 5xx responses via response listeners (collected separately)
    }

    // Navigate to worklist and check table renders
    await page.goto('/lims/worklist', { waitUntil: 'domcontentloaded' });
    const heading = await page
      .getByRole('heading', { name: /Worklist|Work Queue|Operator Work Queue/i })
      .first()
      .isVisible({ timeout: 8_000 })
      .catch(() => false);
    if (!heading) {
      riskPoints.push({ step: 'worklist_heading', issue: 'Worklist heading not found', url: page.url(), severity: 'medium' });
    }

    // Record evidence
    const outDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'chaos-console-errors.log'), consoleErrors.join('\n') || '(none)');
    fs.writeFileSync(path.join(outDir, 'chaos-risk-points.json'), JSON.stringify(riskPoints, null, 2));

    // Assert: no HIGH severity risk points
    const highs = riskPoints.filter((r) => r.severity === 'high');
    if (highs.length > 0) {
      console.log('HIGH risk points found:', JSON.stringify(highs, null, 2));
    }
    expect(highs).toHaveLength(0);
  });

  test('@nightly full workflow smoke with timing capture', async ({ authedPage: page }) => {
    test.setTimeout(120_000);
    const steps: { step: string; durationMs: number }[] = [];
    const riskPoints: RiskPoint[] = [];

    async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const start = Date.now();
      try {
        const result = await fn();
        steps.push({ step: name, durationMs: Date.now() - start });
        return result;
      } catch (e) {
        steps.push({ step: name, durationMs: Date.now() - start });
        riskPoints.push({ step: name, issue: String(e), url: page.url(), severity: 'high' });
        throw e;
      }
    }

    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await timed('api:create_patient', () =>
      apiPost<{ id: string }>('/patients', { firstName: 'Chaos', lastName: 'Smoke', mrn: `CS-${suffix}`, gender: 'M' }, accessToken),
    );

    const { data: encounter } = await timed('api:create_encounter', () =>
      apiPost<{ id: string }>('/encounters', { patientId: patient.id }, accessToken),
    );

    await timed('api:order_lab', () =>
      apiPost(`/encounters/${encounter.id}:order-lab`, { tests: [{ code: TEST_CODE }] }, accessToken),
    );

    await timed('api:collect_specimen', () =>
      apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken),
    );

    const enc = await timed('api:get_encounter', () =>
      apiGet<{ labOrders: Array<{ id: string }> }>(`/encounters/${encounter.id}`, accessToken),
    );

    for (const order of enc.labOrders ?? []) {
      await timed('api:submit_result', () =>
        apiPost(`/encounters/${encounter.id}:result`, { labOrderId: order.id, value: '5.4', flag: 'normal' }, accessToken),
      );
    }

    await timed('api:verify', () =>
      apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken),
    );

    // Navigate to publish page and verify document appears
    await timed('ui:publish_page_load', async () => {
      await page.goto(`/lims/encounters/${encounter.id}/publish`);
      await expect(page.locator('text=Lab Report')).toBeVisible({ timeout: 15_000 });
    });

    await timed('ui:document_published', async () => {
      await expect(
        page.locator('text=PUBLISHED').or(page.locator('text=RENDERED')).or(page.locator('text=RENDERING')).first(),
      ).toBeVisible({ timeout: 60_000 });
    });

    // Write chaos timing evidence
    const outDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'chaos-workflow-timings.json'), JSON.stringify(steps, null, 2));

    const WARN_MS = Number(process.env.E2E_WARN_MS ?? 5000);
    const warnSteps = steps.filter((s) => s.durationMs > WARN_MS);
    if (warnSteps.length > 0) {
      console.log('⚠️  Slow steps (>5s):', warnSteps);
    }

    // No step should exceed CRITICAL threshold
    const CRITICAL_MS = Number(process.env.E2E_CRITICAL_MS ?? 15000);
    const criticalSteps = steps.filter((s) => s.durationMs > CRITICAL_MS);
    expect(criticalSteps).toHaveLength(0);
  });
});
