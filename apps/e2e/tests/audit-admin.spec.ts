import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Admin UI Audit', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('requestfailed', request => console.log('REQUEST_FAILED:', request.url(), request.failure()?.errorText));

  const screenshotDir = path.join(__dirname, '../../../docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/screenshots/admin');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // The admin app is mapped to 9023, with basePath /admin
  console.log('Navigating to Admin Login...');
  await page.goto('http://localhost:9023/admin/login');
  await page.screenshot({ path: path.join(screenshotDir, '01_login_page.png') });

  console.log('Logging in as Super Admin...');
  await page.fill('#email', 'admin@vexel.system');
  await page.fill('#password', 'Admin@vexel123!');
  await page.click('button[type="submit"]');

  // Check if still on login page after 5s
  await page.waitForTimeout(5000);
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    const error = await page.locator('p[style*="color: hsl(var(--status-destructive-fg))"]').textContent();
    console.error('Login failed! URL:', currentUrl, 'Error:', error);
    await page.screenshot({ path: path.join(screenshotDir, '01_login_failed.png') });
  }

  await expect(page).toHaveURL(/.*\/admin\/dashboard/, { timeout: 15000 });
  console.log('Dashboard loaded.');
  await page.screenshot({ path: path.join(screenshotDir, '02_dashboard.png'), fullPage: true });

  // Navigate to Tenants
  console.log('Navigating to Tenants...');
  await page.click('a[href="/admin/tenants"]');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '03_tenants.png'), fullPage: true });

  // Navigate to system logs
  console.log('Navigating to System Logs...');
  await page.goto('http://localhost:9023/admin/system/logs');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '04_system_logs.png'), fullPage: true });
});
