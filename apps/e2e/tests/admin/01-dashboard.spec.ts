/**
 * tests/admin/01-dashboard.spec.ts
 * @admin @smoke — Admin app dashboard.
 */

import { test, expect } from '@playwright/test';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

test.describe('@admin @smoke Admin — Dashboard', () => {
  test('admin login page loads', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: /admin|login/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('valid admin login redirects to /admin/dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('dashboard renders stat cards or summary content', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });

    // Page should have some visible content (cards, headings, stats)
    await expect(page.locator('main, [role=main]').first()).toBeVisible({ timeout: 10_000 });
    // At minimum a heading or some content is visible
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 8_000 });
  });

  test('admin sidebar navigation links are visible after login', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });

    // Sidebar should have links to key admin sections
    const nav = page.locator('nav, [role=navigation]').first();
    await expect(nav).toBeVisible({ timeout: 8_000 });

    // At least one navigation link should be present
    const navLinks = nav.getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});
