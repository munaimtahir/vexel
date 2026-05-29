import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const screenshotDir = 'docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/screenshots/admin';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('Navigating to Admin Login...');
  // The admin app is mapped to 9023
  await page.goto('http://localhost:9023/login');
  await page.screenshot({ path: path.join(screenshotDir, '01_login_page.png') });

  console.log('Logging in as Super Admin...');
  await page.fill('input[name="email"]', 'admin@vexel.system');
  await page.fill('input[name="password"]', 'Admin@vexel123!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Dashboard loaded.');
  await page.screenshot({ path: path.join(screenshotDir, '02_dashboard.png'), fullPage: true });

  // Navigate to Tenants
  console.log('Navigating to Tenants...');
  await page.click('a[href="/tenants"]');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '03_tenants.png'), fullPage: true });

  // Navigate to system logs
  console.log('Navigating to System Logs...');
  await page.goto('http://localhost:9023/system/logs');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(screenshotDir, '04_system_logs.png'), fullPage: true });

  await browser.close();
  console.log('Audit complete.');
}

run().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
