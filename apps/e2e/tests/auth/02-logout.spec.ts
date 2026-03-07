/**
 * tests/auth/02-logout.spec.ts
 * @auth — Logout flows and token lifecycle.
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost, apiGet, API_BASE } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

test.describe('@auth Logout', () => {
  test('login then logout button click redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });

    // Find and click logout — may be in user menu or sidebar
    const logoutBtn = page
      .getByRole('button', { name: /logout|sign out/i })
      .or(page.getByText(/logout|sign out/i).first());

    // Some UIs have logout behind a dropdown — try to open account menu first
    const accountMenu = page.locator('[data-testid="account-menu"], [aria-label*="account"], [aria-label*="user"]').first();
    if (await accountMenu.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await accountMenu.click();
    }

    await expect(logoutBtn).toBeVisible({ timeout: 8_000 });
    await logoutBtn.click();

    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('after logout /lims/worklist requires re-login', async ({ page }) => {
    // Login via UI
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });

    // Clear tokens to simulate logout — must clear both cookies and localStorage
    // since middleware reads cookies
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.removeItem('vexel_token');
      localStorage.removeItem('vexel_refresh');
    });

    // Attempt to navigate to protected page
    await page.goto('/lims/worklist');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('API: POST /api/auth/logout returns 204 with valid token', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);

    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    expect(res.status).toBe(204);
  });

  test('API: after logout, refreshToken is revoked (refresh endpoint rejects it)', async () => {
    const { accessToken, refreshToken } = await apiLogin(EMAIL, PASSWORD);

    // Logout
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    // Attempt to use refresh token
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    // Should be 401 (revoked) — JWT is stateless so access token may still work
    // but refresh must be revoked server-side
    expect(refreshRes.status).toBeGreaterThanOrEqual(400);
  });
});
