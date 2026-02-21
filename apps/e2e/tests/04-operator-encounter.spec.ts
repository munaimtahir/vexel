/**
 * 04-operator-encounter.spec.ts
 * Create an encounter via Operator UI and verify the detail page.
 */

import { test, expect } from '../fixtures/auth.fixture';
import { apiLogin, apiPost } from '../helpers/api-client';

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

test.describe('Operator — Encounter management', () => {
  test('create encounter and navigate to detail', async ({ authedPage: page }) => {
    // Pre-create a patient via API so we don't depend on test 03
    const { accessToken } = await apiLogin(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();
    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      {
        firstName: 'Enc',
        lastName: 'Patient',
        mrn: `ENC-${suffix}`,
        gender: 'M',
      },
      accessToken,
    );

    await page.goto('/encounters/new');
    await expect(page.getByRole('heading', { name: 'Register Encounter' })).toBeVisible();

    // Wait for patient dropdown to be populated
    await expect(page.locator('text=Loading patients...')).not.toBeVisible({ timeout: 10_000 });

    // Select the patient we just created by value (patient ID)
    await page.getByRole('combobox').selectOption({ value: patient.id });

    await page.getByRole('button', { name: 'Register Encounter' }).click();

    // Redirects to /encounters list after creation
    await page.waitForURL('**/encounters', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/encounters$/);

    // The encounter list shows the newly created encounter row
    await expect(page.getByRole('cell', { name: /enc patient/i })).toBeVisible({ timeout: 10_000 });
  });

  test('encounter detail page shows patient identity header', async ({ authedPage: page }) => {
    // Create patient + encounter via API
    const { accessToken } = await apiLogin(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();
    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'Detail', lastName: 'Patient', mrn: `DET-${suffix}`, gender: 'F' },
      accessToken,
    );
    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    await page.goto(`/encounters/${encounter.id}`);

    // IdentityHeader renders patient name prominently
    // TODO: add data-testid="identity-header" to IdentityHeader component
    await expect(page.locator('text=Detail Patient')).toBeVisible({ timeout: 10_000 });

    // Status badge should show "registered"
    await expect(page.locator('text=registered')).toBeVisible();

    // Action buttons present for registered status
    await expect(page.getByRole('link', { name: 'Enter Results' })).toBeVisible();
  });

  test('encounters list page loads with headers', async ({ authedPage: page }) => {
    await page.goto('/encounters');
    await expect(page.getByRole('heading', { name: 'Encounters' })).toBeVisible();
    await expect(page.locator('text=Loading encounters...')).not.toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('columnheader', { name: 'Patient' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });
});
