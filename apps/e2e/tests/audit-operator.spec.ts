import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Operator UI Audit', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('requestfailed', request => console.log('REQUEST_FAILED:', request.url(), request.failure()?.errorText));

  const screenshotDir = path.join(__dirname, '../../../docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/screenshots/operator');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // The operator app is mapped to 9024
  console.log('Navigating to Operator Login...');
  await page.goto('http://localhost:9024/login');
  await page.screenshot({ path: path.join(screenshotDir, '01_login_page.png') });

  console.log('Logging in as Demo Operator...');
  await page.fill('#email', 'operator@demo.vexel.pk');
  await page.fill('#password', 'Operator@demo123!');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/.*\//, { timeout: 15000 });
  console.log('Dashboard loaded.');
  await page.screenshot({ path: path.join(screenshotDir, '02_dashboard.png'), fullPage: true });

  // Navigate to Sample Collection
  console.log('Navigating to Sample Collection...');
  await page.goto('http://localhost:9024/sample-collection');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '03_sample_collection.png'), fullPage: true });

  // Navigate to Results Entry
  console.log('Navigating to Results Entry...');
  await page.goto('http://localhost:9024/results');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '04_results_entry.png'), fullPage: true });
});
