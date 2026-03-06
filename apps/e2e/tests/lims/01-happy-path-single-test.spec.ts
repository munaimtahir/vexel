/**
 * tests/lims/01-happy-path-single-test.spec.ts
 * @lims @smoke — Full LIMS workflow: single test, end-to-end via UI.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

interface PatientData { id: string }
interface EncounterData { id: string; status: string }
interface LabOrderData { id: string; orderedTests?: { id: string }[] }

async function setupSingleTestEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<PatientData>(
    '/patients',
    { firstName: 'HappyPath', lastName: 'Single', mrn: `HPS-${suffix}`, gender: 'M' },
    accessToken,
  );

  const { data: encounter } = await apiPost<EncounterData>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );

  const { data: order } = await apiPost<LabOrderData>(
    `/encounters/${encounter.id}:order-lab`,
    { tests: [{ code: 't1' }] },
    accessToken,
  );

  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

  return { encounter, order, accessToken };
}

test.describe('@lims @smoke LIMS — Happy Path Single Test', () => {
  test('full workflow: order → collect → result → verify → published', async ({ authedPage: page }) => {
    const { encounter, accessToken } = await setupSingleTestEncounter();

    // ── 1. Navigate to results entry ────────────────────────────────────────
    await page.goto(`/lims/encounters/${encounter.id}/results`);
    await expect(
      page.getByRole('heading', { name: /result|lab order/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for loading spinner to disappear
    await expect(page.locator('text=Loading')).not.toBeVisible({ timeout: 10_000 });

    // ── 2. Fill result value ────────────────────────────────────────────────
    const valueInput = page.locator('input[placeholder*="result" i], input[placeholder*="value" i]').first();
    await expect(valueInput).toBeVisible({ timeout: 8_000 });
    await valueInput.fill('5.4');

    // ── 3. Save results ────────────────────────────────────────────────────
    await page.getByRole('button', { name: /save|submit/i }).click();

    await expect(
      page.locator('[role=alert], [class*="success"], [class*="toast"]').filter({ hasText: /saved|success/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // ── 4. Navigate to verify ───────────────────────────────────────────────
    await page.goto(`/lims/encounters/${encounter.id}/verify`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // ── 5. Open verify modal via data-testid ──────────────────────────────
    await page.locator('[data-testid="verify-open-modal"]').click();

    // ── 6. Confirm in modal ────────────────────────────────────────────────
    const confirmBtn = page.locator('[data-testid="verify-confirm"]');
    await expect(confirmBtn).toBeVisible({ timeout: 8_000 });
    await confirmBtn.click();

    // ── 7. Wait for modal to close ─────────────────────────────────────────
    await expect(page.locator('[data-testid="verify-confirm"]')).not.toBeVisible({ timeout: 15_000 });

    // ── 8. Verify via API that encounter is in verified/published state ──────
    const enc = await apiGet<{ status: string }>(`/encounters/${encounter.id}`, accessToken);
    expect(['verified', 'published', 'lab_verified']).toContain(enc.status);
  });
});
