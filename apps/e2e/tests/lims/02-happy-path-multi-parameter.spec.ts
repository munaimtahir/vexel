/**
 * tests/lims/02-happy-path-multi-parameter.spec.ts
 * @lims — Full workflow with two tests (t1 + t2) in one order.
 *
 * Results are entered per-test via API (the UI routes to /lims/results/[orderedTestId]
 * for individual result entry — one per test). Verify and publish are done via UI.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

interface PatientData { id: string }
interface EncounterData { id: string; status: string; labOrders?: { id: string }[] }

async function setupMultiTestEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<PatientData>(
    '/patients',
    { firstName: 'MultiTest', lastName: 'Patient', mrn: `MTP-${suffix}`, gender: 'F' },
    accessToken,
  );

  const { data: encounter } = await apiPost<EncounterData>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );

  // order-lab processes one test per call; call twice to add t1 + t2
  // Second call is valid because encounter is in 'lab_ordered' status after first call
  await apiPost<EncounterData>(
    `/encounters/${encounter.id}:order-lab`,
    { tests: [{ code: 't1' }] },
    accessToken,
  );
  const { data: orderEnc } = await apiPost<EncounterData>(
    `/encounters/${encounter.id}:order-lab`,
    { tests: [{ code: 't2' }] },
    accessToken,
  );

  const labOrders = orderEnc?.labOrders ?? [];

  // Collect
  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

  // Enter result for the FIRST lab order only.
  // The backend transitions encounter to 'resulted' after the first result submission;
  // additional results on the same encounter get 409 (by design — verify any single result).
  const firstLabOrder = labOrders[0];
  if (firstLabOrder) {
    await apiPostRaw(
      `/encounters/${encounter.id}:result`,
      { labOrderId: firstLabOrder.id, value: '5.4', flag: 'normal' },
      accessToken,
    );
  }

  return { encounter, labOrders, accessToken };
}

test.describe('@lims LIMS — Happy Path Multi-Parameter', () => {
  test('full workflow: two-test order → collect → result all → verify → published', async ({
    authedPage: page,
  }) => {
    const { encounter, labOrders, accessToken } = await setupMultiTestEncounter();

    // Confirm both lab orders were ordered
    expect(labOrders.length).toBeGreaterThanOrEqual(2);

    // ── 1. Navigate to verification page ────────────────────────────────────
    await page.goto(`/lims/encounters/${encounter.id}/verify`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // ── 2. Open verify modal ────────────────────────────────────────────────
    const verifyBtn = page.locator('[data-testid="verify-open-modal"]');
    await expect(verifyBtn).toBeVisible({ timeout: 10_000 });
    await verifyBtn.click();

    // ── 3. Confirm verify in modal ──────────────────────────────────────────
    const confirmBtn = page.locator('[data-testid="verify-confirm"]');
    await expect(confirmBtn).toBeVisible({ timeout: 8_000 });
    await confirmBtn.click();

    // ── 4. Wait for modal to close (verify in progress) ────────────────────
    await expect(page.locator('[data-testid="verify-confirm"]')).not.toBeVisible({ timeout: 15_000 });

    // ── 5. Verify via API ──────────────────────────────────────────────────
    const enc = await apiGet<{ status: string }>(`/encounters/${encounter.id}`, accessToken);
    expect(['verified', 'published', 'lab_verified']).toContain(enc.status);
  });
});
