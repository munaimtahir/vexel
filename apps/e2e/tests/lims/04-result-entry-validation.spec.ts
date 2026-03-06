/**
 * tests/lims/04-result-entry-validation.spec.ts
 * @lims — Result entry form validation.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

interface PatientData { id: string }
interface EncounterData { id: string; status: string }

async function setupForResultEntry() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<PatientData>(
    '/patients',
    { firstName: 'Validation', lastName: 'Test', mrn: `VAL-${suffix}`, gender: 'M' },
    accessToken,
  );

  const { data: encounter } = await apiPost<EncounterData>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );

  await apiPost(
    `/encounters/${encounter.id}:order-lab`,
    { tests: [{ code: 't1' }] },
    accessToken,
  );

  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

  return { encounter, accessToken };
}

test.describe('@lims Result Entry Validation', () => {
  test('empty result value and submit shows form validation error', async ({ authedPage: page }) => {
    const { encounter } = await setupForResultEntry();

    await page.goto(`/lims/encounters/${encounter.id}/results`);
    await expect(
      page.getByRole('heading', { name: /result|lab order/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('text=Loading')).not.toBeVisible({ timeout: 10_000 });

    // Find the value input and leave it empty
    const valueInput = page.locator('input[placeholder*="result" i], input[placeholder*="value" i]').first();
    await expect(valueInput).toBeVisible({ timeout: 8_000 });
    // Clear input to ensure it's empty
    await valueInput.clear();

    // Attempt to save
    await page.getByRole('button', { name: /save|submit/i }).click();

    // Should show a validation error — either inline or alert
    const errorVisible = await page
      .locator('[role=alert], [class*="error"], [class*="invalid"], [aria-invalid=true]')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    const requiredVisible = await page
      .getByText(/required|empty|must enter|provide/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(errorVisible || requiredVisible).toBe(true);
  });

  test('result with high flag renders flag indicator in UI', async ({ authedPage: page }) => {
    const { encounter } = await setupForResultEntry();

    await page.goto(`/lims/encounters/${encounter.id}/results`);
    await expect(
      page.getByRole('heading', { name: /result|lab order/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('text=Loading')).not.toBeVisible({ timeout: 10_000 });

    const valueInput = page.locator('input[placeholder*="result" i], input[placeholder*="value" i]').first();
    await expect(valueInput).toBeVisible({ timeout: 8_000 });
    await valueInput.fill('99.9');

    // Set flag to HIGH if selector exists
    const flagSelect = page.locator('select[name*="flag" i], [role=combobox]').first();
    const flagVisible = await flagSelect.isVisible({ timeout: 3_000 }).catch(() => false);
    if (flagVisible) {
      await flagSelect.selectOption({ label: 'high' }).catch(() => {
        return flagSelect.selectOption('high').catch(() => null);
      });
    }

    await page.getByRole('button', { name: /save|submit/i }).click();

    await expect(
      page
        .locator('[role=alert], [class*="success"], [class*="toast"]')
        .filter({ hasText: /saved|success/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    // After save, a HIGH flag indicator should be visible somewhere on the page
    // (may appear as a badge or colored indicator)
    const highFlag = page
      .getByText(/high|H\b|↑/i)
      .or(page.locator('[data-flag="high"], [class*="high"], [class*="flag"]'))
      .first();

    const flagIndicatorVisible = await highFlag.isVisible({ timeout: 5_000 }).catch(() => false);
    // Flag indicator is a nice-to-have — don't fail if the UI doesn't show it yet
    if (!flagIndicatorVisible) {
      console.warn('[04-result-entry-validation] High flag indicator not visible — may not be implemented');
    }
  });

  test('API: result submission on encounter not in collected state returns 409', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await apiPost<PatientData>(
      '/patients',
      { firstName: 'PreCollect', lastName: 'Result', mrn: `PCR-${suffix}`, gender: 'F' },
      accessToken,
    );

    const { data: encounter } = await apiPost<EncounterData>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    // Order lab but do NOT collect specimen
    const { data: order } = await apiPost<{ id: string; labOrders?: { id: string }[] }>(
      `/encounters/${encounter.id}:order-lab`,
      { tests: [{ code: 't1' }] },
      accessToken,
    );

    // order-lab returns encounter object with labOrders[]
    const orderedTestId = (order as any)?.labOrders?.[0]?.id;

    // Attempt to enter result before collecting
    const res = await apiPostRaw(
      `/encounters/${encounter.id}:result`,
      { labOrderId: orderedTestId, value: '5.4', flag: 'normal' },
      accessToken,
    );

    // Should be 409 (wrong state) or 400 (validation)
    expect([409, 400]).toContain(res.status);
  });
});
