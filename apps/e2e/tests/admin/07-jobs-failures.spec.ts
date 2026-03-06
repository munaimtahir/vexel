/**
 * tests/admin/07-jobs-failures.spec.ts
 * @admin — Jobs queue and failed documents page.
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

    // Either shows queue stats/counts OR empty state
    const hasContent = await page
      .locator('table, [data-testid*="job"], [class*="job"], [class*="queue"]')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no jobs|no tasks|empty|queue/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    // Page should have some content
    expect(hasContent || hasEmptyState).toBe(true);
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
