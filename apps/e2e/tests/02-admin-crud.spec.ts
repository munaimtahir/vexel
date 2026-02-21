/**
 * 02-admin-crud.spec.ts
 * Admin back-office: tenant list, user creation.
 * Runs against the admin project (baseURL = http://127.0.0.1:9025).
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const ADMIN_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  // Admin login button label is "Sign in" (lowercase 'i')
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

test.describe('Admin CRUD', () => {
  test('admin login and navigate to /admin/tenants', async ({ page }) => {
    await adminLogin(page);

    await page.goto('/tenants');
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
    // At minimum the seeded system tenant must appear
    await expect(page.locator('div').filter({ hasText: /system|vexel/i }).first()).toBeVisible();
  });

  test('tenant list displays at least one tenant', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/tenants');

    // Wait for list to load (spinner disappears)
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // The tenant cards are rendered as div elements with tenant names
    const tenantCards = page.locator('[style*="background: white"]').filter({ hasText: /.+/ });
    await expect(tenantCards.first()).toBeVisible();
  });

  test('create a new test user via UI and verify in list', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // Open create form
    await page.getByRole('button', { name: '+ New User' }).click();

    // Fill create user form — fields are rendered by iterating ['email', 'firstName', 'lastName', 'password']
    // Labels are capitalized versions of field names
    const suffix = Date.now().toString(36);
    const testEmail = `e2e-${suffix}@test.vexel.internal`;

    await page.getByLabel('email').fill(testEmail);
    await page.getByLabel('firstName').fill('E2E');
    await page.getByLabel('lastName').fill('User');
    await page.getByLabel('password').fill('Test@12345!');

    await page.getByRole('button', { name: 'Create' }).click();

    // Form closes and user appears in the table
    await expect(page.locator('form')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('cell', { name: testEmail })).toBeVisible({ timeout: 10_000 });
  });

  test('feature flags page loads with toggles', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/feature-flags');

    await expect(page.getByRole('heading', { name: 'Feature Flags' })).toBeVisible();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // Module toggles section exists
    await expect(page.getByRole('heading', { name: 'Module Toggles' })).toBeVisible();

    // Each toggle is a <button aria-label="Toggle <key>">
    const firstToggle = page.getByRole('button', { name: /Toggle module\./i }).first();
    await expect(firstToggle).toBeVisible();
  });

  test('toggle a feature flag and verify state changes', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/feature-flags');

    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // Pick the first module toggle
    const toggle = page.getByRole('button', { name: /Toggle module\./i }).first();
    const initialBg = await toggle.evaluate((el) => (el as HTMLButtonElement).style.background);

    await toggle.click();

    // Background should change (green ↔ grey)
    await page.waitForTimeout(1500); // allow save to complete
    const newBg = await toggle.evaluate((el) => (el as HTMLButtonElement).style.background);
    expect(newBg).not.toBe(initialBg);

    // Toggle back to restore original state
    await toggle.click();
    await page.waitForTimeout(1500);
  });
});
