/**
 * 01-auth.spec.ts
 * Auth flows: login page, credential validation, protected route redirect.
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const ADMIN_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

test.describe('Authentication', () => {
  test('operator /login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Vexel Operator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('login with valid credentials redirects to /encounters', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // After successful login the app redirects to /encounters
    await page.waitForURL('**/encounters', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/encounters/);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('BadPassword!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Error text shown inline — the login page renders it in a <p> tag
    await expect(page.locator('p').filter({ hasText: /invalid credentials|login failed/i })).toBeVisible();
  });

  test('accessing /encounters without auth redirects to /login', async ({ page }) => {
    // Fresh context — no tokens in localStorage
    await page.goto('/encounters');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('/encounters loads after successful login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL('**/encounters', { timeout: 15_000 });
    // The encounters list heading is visible
    await expect(page.getByRole('heading', { name: 'Encounters' })).toBeVisible();
  });
});
