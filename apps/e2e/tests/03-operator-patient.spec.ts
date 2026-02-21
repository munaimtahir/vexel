/**
 * 03-operator-patient.spec.ts
 * Create a patient via the Operator UI and verify it appears in the list.
 */

import { test, expect } from '../fixtures/auth.fixture';

test.describe('Operator — Patient management', () => {
  test('create patient via UI and see in list', async ({ authedPage: page }) => {
    await page.goto('/patients/new');

    await expect(page.getByRole('heading', { name: 'New Patient' })).toBeVisible();

    const suffix = Date.now().toString(36).toUpperCase();
    const mrn = `E2E-${suffix}`;

    // Form uses <label> text + <input name="..."> pairs
    await page.getByLabel('First Name *').fill('E2E Test');
    await page.getByLabel('Last Name *').fill('Patient');
    await page.getByLabel('MRN *').fill(mrn);

    // Gender select — value "M" = Male
    await page.getByLabel('Gender').selectOption('M');

    // Phone field
    await page.getByLabel('Phone').fill('03001234567');

    await page.getByRole('button', { name: 'Create Patient' }).click();

    // After creation the page redirects to /patients list
    await page.waitForURL('**/patients', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/patients$/);

    // The new patient should appear in the table
    await expect(page.getByRole('cell', { name: mrn })).toBeVisible({ timeout: 10_000 });
  });

  test('patients list page loads with table headers', async ({ authedPage: page }) => {
    await page.goto('/patients');

    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await expect(page.locator('text=Loading patients...')).not.toBeVisible({ timeout: 10_000 });

    // Table headers defined in the page
    await expect(page.getByRole('columnheader', { name: 'MRN' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
  });

  test('duplicate MRN shows 409 error', async ({ authedPage: page }) => {
    // First create a patient
    const suffix = Date.now().toString(36).toUpperCase();
    const mrn = `DUP-${suffix}`;

    await page.goto('/patients/new');
    await page.getByLabel('First Name *').fill('Dup');
    await page.getByLabel('Last Name *').fill('Patient');
    await page.getByLabel('MRN *').fill(mrn);
    await page.getByRole('button', { name: 'Create Patient' }).click();
    await page.waitForURL('**/patients', { timeout: 15_000 });

    // Attempt to create the same MRN again
    await page.goto('/patients/new');
    await page.getByLabel('First Name *').fill('Dup');
    await page.getByLabel('Last Name *').fill('Patient');
    await page.getByLabel('MRN *').fill(mrn);
    await page.getByRole('button', { name: 'Create Patient' }).click();

    // The form renders an error message for 409
    await expect(
      page.locator('p').filter({ hasText: /MRN already exists|already exists/i }),
    ).toBeVisible({ timeout: 8_000 });
  });
});
