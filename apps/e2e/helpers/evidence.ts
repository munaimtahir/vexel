/**
 * evidence.ts
 * Captures test failure evidence: URL, title, visible alerts, last network failure.
 * Writes timestamped JSON to test-results/evidence/ directory.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';

export interface EvidenceReport {
  testTitle: string;
  timestamp: string;
  url: string;
  pageTitle: string;
  visibleAlerts: string[];
  visibleErrors: string[];
  lastNetworkFailure: string | null;
  consoleErrors: string[];
}

/**
 * Capture evidence on test failure.
 * Call inside test.afterEach or on assertion failure.
 */
export async function captureEvidence(page: Page, testTitle: string): Promise<EvidenceReport> {
  const outDir = path.join(__dirname, '..', 'test-results', 'evidence');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const url = page.url();
  const pageTitle = await page.title().catch(() => '');

  // Grab visible alert/error text from the DOM
  const visibleAlerts = await page
    .locator('[role=alert]')
    .allTextContents()
    .catch(() => []);

  const visibleErrors = await page
    .locator('[data-testid*="error"], .error-message, [class*="error"]')
    .allTextContents()
    .catch(() => []);

  // Collect console errors from the page (must have been set up via page.on('console') beforehand)
  const consoleErrors: string[] = [];

  // Attempt to read last network failure via navigation timing
  let lastNetworkFailure: string | null = null;
  try {
    const failed = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const failedEntry = entries.reverse().find((e) => e.responseStatus >= 400);
      return failedEntry ? `${failedEntry.name} → HTTP ${failedEntry.responseStatus}` : null;
    });
    lastNetworkFailure = failed;
  } catch {
    // page may be closed or navigation context unavailable
  }

  const report: EvidenceReport = {
    testTitle,
    timestamp: new Date().toISOString(),
    url,
    pageTitle,
    visibleAlerts: visibleAlerts.filter(Boolean),
    visibleErrors: visibleErrors.filter(Boolean),
    lastNetworkFailure,
    consoleErrors,
  };

  const safeName = testTitle
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .slice(0, 80);
  const filename = `${Date.now()}-${safeName}.json`;
  fs.writeFileSync(path.join(outDir, filename), JSON.stringify(report, null, 2));

  return report;
}

/**
 * Returns a simple step logger.
 * Usage: const step = logStep('my-test'); step('navigate to login'); ...
 */
export function logStep(context: string) {
  return (name: string) => {
    console.log(`[${new Date().toISOString()}] [${context}] STEP: ${name}`);
  };
}
