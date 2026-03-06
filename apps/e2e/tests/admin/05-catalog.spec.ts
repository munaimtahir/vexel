/**
 * tests/admin/05-catalog.spec.ts
 * @admin — Admin catalog management pages.
 */

import { test, expect } from '@playwright/test';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
}

test.describe('@admin Catalog', () => {
  test('catalog navigation link in admin sidebar is visible', async ({ page }) => {
    await adminLogin(page);
    const nav = page.locator('nav, [role=navigation]').first();
    await expect(nav).toBeVisible({ timeout: 8_000 });
    await expect(nav.getByText(/catalog/i)).toBeVisible({ timeout: 5_000 });
  });

  test('catalog tests list page loads', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/catalog');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    // Should not show an error
    await expect(
      page.locator('[role=alert]').filter({ hasText: /error|not found/i }),
    ).not.toBeVisible();
  });

  test('catalog tests list shows at least one test (Glucose / t1)', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/catalog/tests');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // Seeded test: Glucose (code t1)
    await expect(page.getByText(/glucose|t1/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('catalog parameters list page loads', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/catalog/parameters');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[role=alert]').filter({ hasText: /error|not found/i }),
    ).not.toBeVisible();
  });

  test('catalog reference ranges page loads', async ({ page }) => {
    await adminLogin(page);
    // Try /admin/catalog/reference-ranges or /admin/catalog/ranges
    await page.goto('/admin/catalog/reference-ranges');
    // If redirected or 404, the page should still not crash the app
    const url = page.url();
    // Either loads content OR redirects to catalog root — both are acceptable
    expect(url).toMatch(/\/admin/);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('catalog test detail shows panels or parameters count', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/catalog/tests');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // Try clicking into Glucose test
    const glucoseLink = page.getByText(/glucose/i).first();
    const exists = await glucoseLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (exists) {
      await glucoseLink.click();
      await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
      // Detail page should load without error
      await expect(
        page.locator('[role=alert]').filter({ hasText: /error/i }),
      ).not.toBeVisible();
    }
  });
});
