/**
 * tests/operator/01-navigation.spec.ts
 * @operator @smoke — Operator app navigation and shell.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

/** Inject tokens into localStorage to skip UI login. */
async function injectAuth(page: import('@playwright/test').Page, baseURL: string) {
  const { accessToken, refreshToken } = await apiLogin(EMAIL, PASSWORD);
  await page.goto('/');
  await page.evaluate(
    ({ at, rt }) => {
      localStorage.setItem('vexel_token', at);
      localStorage.setItem('vexel_refresh', rt);
    },
    { at: accessToken, rt: refreshToken },
  );
}

test.describe('@operator @smoke Operator — Navigation', () => {
  test('app boots and loads login page at /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows Worklist link after login', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    await expect(page.locator('nav, [role=navigation]').first()).toBeVisible({ timeout: 8_000 });
    await expect(
      page.locator('nav, [role=navigation]').getByText(/worklist/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('sidebar shows Registrations link after login', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    await expect(
      page.locator('nav, [role=navigation]').getByText(/registration/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('sidebar shows Sample Collection link after login', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    await expect(
      page.locator('nav, [role=navigation]').getByText(/sample|collection/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('sidebar shows Results link after login', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    await expect(
      page.locator('nav, [role=navigation]').getByText(/results/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('sidebar shows Verification link after login', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    await expect(
      page.locator('nav, [role=navigation]').getByText(/verif/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('sidebar shows Reports link after login', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    await expect(
      page.locator('nav, [role=navigation]').getByText(/reports?/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Worklist nav link loads worklist page', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    const worklist = page.locator('nav, [role=navigation]').getByText(/worklist/i).first();
    await expect(worklist).toBeVisible({ timeout: 8_000 });
    await worklist.click();
    await page.waitForURL('**/lims/worklist', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/lims\/worklist/);
  });

  test('clicking Sample Collection nav link loads sample collection page', async ({ page }) => {
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');
    const link = page.locator('nav, [role=navigation]').getByText(/sample|collection/i).first();
    await expect(link).toBeVisible({ timeout: 8_000 });
    await link.click();
    await page.waitForURL('**/lims/sample-collection', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/lims\/sample-collection/);
  });

  test('mobile viewport (375x667): hamburger or sidebar accessible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await injectAuth(page, page.url());
    await page.goto('/lims/worklist');

    // On mobile the sidebar may collapse — hamburger button or collapsed sidebar should be present
    const hamburger = page.locator(
      '[aria-label*="menu"], [data-testid*="hamburger"], button[aria-expanded]',
    );
    const sidebar = page.locator('nav, [role=navigation]').first();

    const hamburgerVisible = await hamburger.first().isVisible({ timeout: 3_000 }).catch(() => false);
    const sidebarVisible = await sidebar.isVisible({ timeout: 3_000 }).catch(() => false);

    // Either a hamburger menu or visible nav should be present
    expect(hamburgerVisible || sidebarVisible).toBe(true);
  });
});
