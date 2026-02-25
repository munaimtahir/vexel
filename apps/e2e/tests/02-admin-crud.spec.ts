/**
 * 02-admin-crud.spec.ts
 * Admin back-office: tenant list, user creation.
 * Runs against the admin project (baseURL = http://127.0.0.1:9025).
 */

import { test, expect } from '@playwright/test';
import { apiGet, apiLogin } from '../helpers/api-client';

const ADMIN_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const ADMIN_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  // Admin login button label is "Sign in" (lowercase 'i')
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
}

test.describe('Admin CRUD', () => {
  test('admin login and navigate to /admin/tenants', async ({ page }) => {
    await adminLogin(page);

    await page.goto('/admin/tenants');
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
    // At minimum the seeded system tenant must appear
    await expect(page.locator('div').filter({ hasText: /system|vexel/i }).first()).toBeVisible();
  });

  test('tenant list displays at least one tenant', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/tenants');

    // Wait for list to load (spinner disappears)
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // Assert against stable content/actions instead of presentation styles.
    await expect(page.getByText(/system|vexel/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();
  });

  test('create a new test user via UI and verify in list', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/users');

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // Open create form
    await page.getByRole('button', { name: '+ New User' }).click();

    // Fill create user form — fields are rendered by iterating ['email', 'firstName', 'lastName', 'password']
    // Labels are capitalized versions of field names
    const suffix = Date.now().toString(36);
    const testEmail = `e2e-${suffix}@test.vexel.internal`;

    const createForm = page.locator('form').filter({
      has: page.getByRole('button', { name: 'Create' }),
    }).first();
    await expect(createForm).toBeVisible({ timeout: 10_000 });

    await createForm.locator('input[type=\"email\"]').first().fill(testEmail);
    await createForm.locator('input[type=\"text\"]').nth(0).fill('E2E');
    await createForm.locator('input[type=\"text\"]').nth(1).fill('User');
    await createForm.locator('input[type=\"password\"]').first().fill('Test@12345!');

    await page.getByRole('button', { name: 'Create' }).click();

    // Form closes and user appears in the table
    await expect(page.locator('form')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('cell', { name: testEmail })).toBeVisible({ timeout: 10_000 });
  });

  test('feature flags page loads with toggles', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/feature-flags');

    await expect(page.getByRole('heading', { name: 'Feature Flags' })).toBeVisible();
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // Module toggles section exists
    await expect(page.getByRole('heading', { name: 'Module Toggles' })).toBeVisible();

    // Each toggle is a <button aria-label="Toggle <key>">
    const firstToggle = page.getByRole('button', { name: /Toggle module\./i }).first();
    await expect(firstToggle).toBeVisible({ timeout: 15_000 });
  });

  test('toggle a feature flag and verify state changes', async ({ page }) => {
    const { accessToken } = await apiLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
    const me = await apiGet<{ tenantId: string }>('/me', accessToken);
    const tenantId = (me as any).tenantId as string;

    const getTenantFlags = async () =>
      apiGet<Array<{ key: string; enabled: boolean }>>(`/tenants/${tenantId}/feature-flags`, accessToken);

    const targetFlagKey = 'module.rad';

    const readTargetFlag = async () => {
      const flags = await getTenantFlags();
      const row = (flags as any[]).find((f) => f.key === targetFlagKey);
      expect(row).toBeTruthy();
      return !!row.enabled;
    };

    const initialEnabled = await readTargetFlag();

    await adminLogin(page);
    await page.goto('/admin/feature-flags');

    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 10_000 });

    // Use a non-LIMS module flag to avoid interfering with operator LIMS E2E tests running in parallel.
    const toggle = page.getByRole('button', { name: `Toggle ${targetFlagKey}` });
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    await toggle.click();
    await expect.poll(async () => await readTargetFlag(), { timeout: 10_000 }).toBe(!initialEnabled);

    // Toggle back to restore original state
    await toggle.click();
    await expect.poll(async () => await readTargetFlag(), { timeout: 10_000 }).toBe(initialEnabled);
  });
});
