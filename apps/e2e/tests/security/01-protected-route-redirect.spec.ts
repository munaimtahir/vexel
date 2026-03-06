/**
 * tests/security/01-protected-route-redirect.spec.ts
 * @security @smoke — Unauthenticated access to protected routes redirects to login.
 */

import { test, expect, Browser, chromium } from '@playwright/test';

test.describe('@security @smoke Protected Route Redirect', () => {
  test('unauthenticated: /lims/worklist redirects to /login', async ({ browser }) => {
    // Fresh context — no stored auth
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/lims/worklist');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  test('unauthenticated: /lims/results redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/lims/results');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  test('unauthenticated: /lims/verification redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/lims/verification');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  test('unauthenticated: /lims/sample-collection redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/lims/sample-collection');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  test('unauthenticated: /lims/reports redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/lims/reports');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  test('no tokens in localStorage: direct navigation to protected page redirects to login', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Explicitly clear any storage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/lims/worklist');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });
});
