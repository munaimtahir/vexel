import { test, expect } from '@playwright/test';

const EMAIL = process.env.ACCOUNT_TEST_EMAIL || 'operator@demo.vexel.pk';
const PASSWORD = process.env.ACCOUNT_TEST_PASSWORD || 'Operator@demo123!';

test.describe('Operator Account Settings', () => {
  test('authenticated user sees Account in sidebar and can update display name', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });

    await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();
    await page.getByRole('link', { name: 'Account' }).click();
    await page.waitForURL('**/account', { timeout: 10_000 });

    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    const displayName = page.getByLabel('Display name');
    const current = (await displayName.inputValue()).trim();
    const next = current.endsWith('QA') ? current.replace(/\s*QA$/, '') : `${current} QA`;
    await displayName.fill(next);
    await page.getByRole('button', { name: 'Save Display Name' }).click();
    await expect(page.getByText('Display name updated')).toBeVisible({ timeout: 10_000 });
  });

  test('open admin panel action is visible for authenticated user', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });

    await page.getByRole('link', { name: 'Account' }).click();
    await page.waitForURL('**/account', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Open Admin Panel' })).toBeVisible();
  });
});
