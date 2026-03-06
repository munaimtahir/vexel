/**
 * tests/admin/03-users-roles.spec.ts
 * @admin — Admin users and roles pages.
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
}

test.describe('@admin Users & Roles', () => {
  test('users page loads', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 10_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('seeded users appear in users list', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/users');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // At least the admin user should appear
    await expect(
      page.getByText(/admin@vexel\.system|admin@vexel\.pk|operator@demo/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('user created via API appears in admin users list', async ({ page }) => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);

    const suffix = Date.now().toString(36).toUpperCase();
    const newEmail = `e2e-user-${suffix}@test.vexel.pk`;

    // Create user via API
    const { status } = await apiPost(
      '/users',
      {
        email: newEmail,
        password: 'TestUser@123!',
        firstName: 'E2E',
        lastName: `User${suffix}`,
      },
      accessToken,
    );
    expect([200, 201]).toContain(status);

    // Navigate to admin users page
    await adminLogin(page);
    await page.goto('/admin/users');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Newly created user should appear — may need search/pagination
    await expect(page.getByText(newEmail)).toBeVisible({ timeout: 10_000 });
  });

  test('roles page loads with seeded roles', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/roles');
    await expect(page).toHaveURL(/\/admin\/roles/, { timeout: 10_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Should show at least one role (operator, verifier, super-admin)
    await expect(
      page.getByText(/operator|verifier|super.admin|admin/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
