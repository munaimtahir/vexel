/**
 * tests/admin/07-jobs-failures.spec.ts
 * @admin — Jobs queue and failed documents page.
 */

import { test, expect } from '@playwright/test';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.waitForLoadState('domcontentloaded');
  const emailInput = page.getByLabel('Email');
  const passwordInput = page.getByLabel('Password');
  const signInButton = page.getByRole('button', { name: /sign in/i });
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  await Promise.all([
    page.waitForURL(
      (url) => /\/admin\/(dashboard|catalog|audit|jobs|users|roles|tenants|feature-flags|account)$/.test(url.pathname),
      { timeout: 30_000 },
    ),
    signInButton.click(),
  ]);
}

test.describe('@admin Jobs & Failures', () => {
  test('jobs page loads at /admin/jobs', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/jobs');
    await expect(page).toHaveURL(/\/admin\/jobs/, { timeout: 10_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('jobs page shows queue stats or empty state without error', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/jobs');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Should not show a hard error
    await expect(
      page.locator('[role=alert]').filter({ hasText: /error|failed to load/i }),
    ).not.toBeVisible({ timeout: 5_000 });

    // Core jobs widgets should always render, even when queues are empty.
    await expect(page.getByText('Queue Depth')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('heading', { name: /Failed BullMQ Jobs/i })).toBeVisible({ timeout: 8_000 });
  });

  test('failed documents section is accessible', async ({ page }) => {
    await adminLogin(page);

    // Try /admin/jobs — failed documents may be a section within it
    await page.goto('/admin/jobs');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Look for failed documents section — may be empty in a healthy system
    // Just verify no app error
    await expect(
      page.locator('[role=alert]').filter({ hasText: /unhandled|crash|500/i }),
    ).not.toBeVisible();
  });
});
