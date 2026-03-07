/**
 * tests/lims/03-invalid-transition-blocked.spec.ts
 * @lims — Invalid workflow transitions must be rejected (409 Conflict).
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost, apiPostRaw, API_BASE } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

interface PatientData { id: string }
interface EncounterData { id: string }
interface LabOrderData { id: string; labOrders?: { id: string }[] }

async function setupCollectedEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<PatientData>(
    '/patients',
    { firstName: 'Transition', lastName: 'Guard', mrn: `TRG-${suffix}`, gender: 'M' },
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

test.describe('@lims Invalid Transition Blocked', () => {
  test('collect specimen twice returns 409', async () => {
    const { encounter, accessToken } = await setupCollectedEncounter();

    // First collect already done in setup — attempt a second collect
    const res = await apiPostRaw(
      `/encounters/${encounter.id}:collect-specimen`,
      {},
      accessToken,
    );
    expect(res.status).toBe(409);
  });

  test('verify before results are entered returns 409', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await apiPost<PatientData>(
      '/patients',
      { firstName: 'EarlyVerify', lastName: 'Test', mrn: `EV-${suffix}`, gender: 'F' },
      accessToken,
    );

    const { data: encounter } = await apiPost<EncounterData>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    await apiPost(`/encounters/${encounter.id}:order-lab`, { tests: [{ code: 't1' }] }, accessToken);
    await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

    // Attempt verify without entering results
    const verifyRes = await apiPostRaw(
      `/encounters/${encounter.id}:verify`,
      {},
      accessToken,
    );
    expect(verifyRes.status).toBe(409);
  });

  test('submit result after encounter is verified returns 409', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await apiPost<PatientData>(
      '/patients',
      { firstName: 'PostVerify', lastName: 'Result', mrn: `PVR-${suffix}`, gender: 'M' },
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

    // order-lab returns the encounter object with labOrders[]
    const orderedTestId = (order as LabOrderData)?.labOrders?.[0]?.id;

    // Enter result
    await apiPostRaw(
      `/encounters/${encounter.id}:result`,
      { labOrderId: orderedTestId, value: '5.4', flag: 'normal' },
      accessToken,
    );

    // Verify
    await apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken);

    // Now attempt to submit result again after verify
    const lateResultRes = await apiPostRaw(
      `/encounters/${encounter.id}:result`,
      { labOrderId: orderedTestId, value: '9.9', flag: 'normal' },
      accessToken,
    );
    expect(lateResultRes.status).toBe(409);
  });

  test('UI: verify button on encounter with no results shows error after confirm', async ({ page }) => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await apiPost<PatientData>(
      '/patients',
      { firstName: 'UIVerifyErr', lastName: 'Test', mrn: `UVE-${suffix}`, gender: 'M' },
      accessToken,
    );

    const { data: encounter } = await apiPost<EncounterData>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    await apiPost(`/encounters/${encounter.id}:order-lab`, { tests: [{ code: 't1' }] }, accessToken);
    await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

    // Inject auth tokens for UI — cookies for server-side middleware, localStorage for client reads
    const { accessToken: at, refreshToken: rt } = await apiLogin(EMAIL, PASSWORD);
    await page.context().addCookies([
      { name: 'vexel_token', value: at, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      { name: 'vexel_refresh', value: rt, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
    ]);

    // Navigate to verify page
    await page.goto(`/lims/encounters/${encounter.id}/verify`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Click verify button
    const verifyBtn = page.getByRole('button', { name: /verify|publish/i });
    const verifyVisible = await verifyBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (verifyVisible) {
      await verifyBtn.click();

      // Handle confirm modal if present
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|proceed/i });
      const confirmVisible = await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      if (confirmVisible) await confirmBtn.click();

      // Should show an error since no results were entered
      await expect(
        page
          .locator('[role=alert]')
          .filter({ hasText: /error|not.*result|result.*required|conflict/i })
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
