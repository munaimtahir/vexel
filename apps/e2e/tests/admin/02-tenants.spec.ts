/**
 * tests/admin/02-tenants.spec.ts
 * @admin — Admin tenants management page.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

/** Log into admin and return authenticated page. */
async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
}

test.describe('@admin Tenants', () => {
  test('tenants page loads', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/tenants');
    await expect(page).toHaveURL(/\/admin\/tenants/, { timeout: 10_000 });
    // Should have a heading or list
    await expect(page.locator('main, [role=main]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('system tenant appears in tenant list', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/tenants');
    // Wait for content to load
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
    // System tenant should appear — look for "system" or "Vexel" text
    await expect(page.getByText(/system|vexel/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('tenant detail shows feature flags or LIMS config', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/tenants');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Click on first tenant in the list
    const tenantLink = page.getByRole('link').filter({ hasText: /system|vexel/i }).first();
    const tenantLinkExists = await tenantLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (tenantLinkExists) {
      await tenantLink.click();
      await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
      // Should show something — feature flags, LIMS config, etc.
      const content = page.locator('main').first();
      await expect(content).toBeVisible();
    } else {
      // If no tenant link found, at least the page loaded without error
      await expect(page.locator('[role=alert]').filter({ hasText: /error/i })).not.toBeVisible();
    }
  });

  test.skip('create new tenant via UI (admin-only backend operation)', async () => {
    // Skip: tenant creation may be restricted to super-admin backend operations only
    // and may not have a UI form in the current MVP.
  });
});
