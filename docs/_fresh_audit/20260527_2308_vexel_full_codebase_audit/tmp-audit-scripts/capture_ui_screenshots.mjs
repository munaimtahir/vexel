// Audit-only: capture key UI screenshots for Admin and Operator with real login.
// Writes PNGs into docs/_fresh_audit/.../screenshots/{admin,operator}/
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const AUDIT_DIR = 'docs/_fresh_audit/20260527_2308_vexel_full_codebase_audit';
const outAdmin = path.join(ROOT, AUDIT_DIR, 'screenshots', 'admin');
const outOperator = path.join(ROOT, AUDIT_DIR, 'screenshots', 'operator');
fs.mkdirSync(outAdmin, { recursive: true });
fs.mkdirSync(outOperator, { recursive: true });

const OPERATOR_BASE = process.env.OPERATOR_BASE || 'http://127.0.0.1:9024';
const ADMIN_BASE = process.env.ADMIN_BASE || 'http://127.0.0.1:9023';

const CREDS = {
  operator: { email: 'operator@demo.vexel.pk', password: 'Operator@demo123!' },
  admin: { email: 'admin@vexel.system', password: 'Admin@vexel123!' },
};

async function snap(page, filePath) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: filePath, fullPage: true });
}

async function operatorScreens(browser) {
  const page = await browser.newPage();
  await page.goto(`${OPERATOR_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await snap(page, path.join(outOperator, '01_login.png'));

  await page.getByLabel('Email').fill(CREDS.operator.email);
  await page.getByLabel('Password').fill(CREDS.operator.password);
  await Promise.all([
    page.waitForURL('**/lims/worklist', { timeout: 15000 }),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
  await snap(page, path.join(outOperator, '02_worklist.png'));

  const targets = [
    ['/lims/registrations/new', '03_registrations_new.png'],
    ['/lims/sample-collection', '04_sample_collection.png'],
    ['/lims/results', '05_results_worklist.png'],
    ['/lims/verification', '06_verification_worklist.png'],
    ['/lims/reports', '07_reports.png'],
  ];
  for (const [route, name] of targets) {
    await page.goto(`${OPERATOR_BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await snap(page, path.join(outOperator, name));
  }
  await page.close();
}

async function adminScreens(browser) {
  const page = await browser.newPage();
  await page.goto(`${ADMIN_BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await snap(page, path.join(outAdmin, '01_login.png'));

  await page.getByLabel('Email').fill(CREDS.admin.email);
  await page.getByLabel('Password').fill(CREDS.admin.password);
  await Promise.all([
    page.waitForURL('**/admin/dashboard', { timeout: 15000 }),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
  await snap(page, path.join(outAdmin, '02_dashboard.png'));

  const targets = [
    ['/admin/tenants', '03_tenants.png'],
    ['/admin/users', '04_users.png'],
    ['/admin/roles', '05_roles.png'],
    ['/admin/feature-flags', '06_feature_flags.png'],
    ['/admin/catalog/tests', '07_catalog_tests.png'],
    ['/admin/audit', '08_audit.png'],
    ['/admin/jobs', '09_jobs.png'],
  ];
  for (const [route, name] of targets) {
    await page.goto(`${ADMIN_BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await snap(page, path.join(outAdmin, name));
  }
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await operatorScreens(browser);
  await adminScreens(browser);
  console.log('ok');
} finally {
  await browser.close();
}
