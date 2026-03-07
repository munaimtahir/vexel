/**
 * tests/auth/01-login.spec.ts
 * @auth @smoke — Login flows for Operator app.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../../helpers/api-client';

const ADMIN_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const ADMIN_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';
const OPERATOR_EMAIL = 'operator@demo.vexel.pk';
const OPERATOR_PASSWORD = 'Operator@demo123!';

test.describe('@auth @smoke Authentication — Login', () => {
  test('login page loads with heading and sign-in button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('valid credentials redirect to /lims/worklist', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/lims\/worklist/);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@nowhere.invalid');
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(
      page.locator('[role=alert]').filter({ hasText: /invalid|failed|incorrect|unauthorized/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('stale / cleared token on protected page redirects to /login', async ({ page, context }) => {
    // Inject valid tokens first (both cookies and localStorage for full auth)
    const { accessToken, refreshToken } = await apiLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
    await context.addCookies([
      { name: 'vexel_token', value: accessToken, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      { name: 'vexel_refresh', value: refreshToken, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
    ]);

    // Now clear all tokens to simulate stale / expired session
    await context.clearCookies();

    // Navigate to protected route — should redirect to /login
    await page.goto('/lims/worklist');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('super-admin login works', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/lims\/worklist/);
  });

  test('operator role login works', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(OPERATOR_EMAIL);
    await page.getByLabel('Password').fill(OPERATOR_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/lims\/worklist/);
  });
});
