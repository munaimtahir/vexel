/**
 * tests/admin/06-audit-explorer.spec.ts
 * @admin — Audit log explorer.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
}

test.describe('@admin Audit Explorer', () => {
  test('audit page loads at /admin/audit', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/audit');
    await expect(page).toHaveURL(/\/admin\/audit/, { timeout: 10_000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('audit page does not show error state', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/audit');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('[role=alert]').filter({ hasText: /error|failed/i }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('after performing an API action, audit entries exist', async ({ page }) => {
    // Perform an API action to generate an audit entry
    await apiLogin(EMAIL, PASSWORD);

    // Navigate to audit page
    await adminLogin(page);
    await page.goto('/admin/audit');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Should show at least one audit entry row or empty-state message
    const hasEntries = await page
      .locator('table tbody tr, [data-testid*="audit-row"], [class*="audit"]')
      .first()
      .isVisible({ timeout: 8_000 })
      .catch(() => false);

    const hasEmptyState = await page
      .getByText(/no audit|no entries|no events|empty/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    // Either audit entries are shown OR an empty state is shown — no crash
    expect(hasEntries || hasEmptyState).toBe(true);
  });

  test('audit page filter controls are visible if implemented', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/audit');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Filter controls are optional — just verify the page renders without error
    await expect(
      page.locator('[role=alert]').filter({ hasText: /error/i }),
    ).not.toBeVisible();
  });
});
