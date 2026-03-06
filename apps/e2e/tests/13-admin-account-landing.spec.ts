import { test, expect } from '@playwright/test';

const LIMITED_EMAIL = process.env.ACCOUNT_TEST_EMAIL || 'operator@demo.vexel.pk';
const LIMITED_PASSWORD = process.env.ACCOUNT_TEST_PASSWORD || 'Operator@demo123!';
const ADMIN_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const ADMIN_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

test.describe('Admin Landing and Navigation', () => {
  test('limited user lands on /admin/account and sees no admin-only sections', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(LIMITED_EMAIL);
    await page.getByLabel('Password').fill(LIMITED_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/admin/account', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users & Roles' })).toHaveCount(0);
  });

  test('admin user sees dashboard section links in sidebar', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Catalog' })).toBeVisible();
  });
});
