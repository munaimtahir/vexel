/**
 * 09-happy-path-multi-parameter.spec.ts
 * Happy path: order TWO tests (Glucose + CBC) in a single encounter,
 * enter results for all lab orders, verify, confirm document published.
 *
 * This exercises the multi-test/multi-parameter result entry workflow.
 */

import { test, expect } from '../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../helpers/api-client';
import { createTimings, flushTimings } from '../helpers/timings';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

// Two tests ordered together: Glucose (t1) + CBC (t2)
const TEST_CODE_1 = process.env.E2E_TEST_CODE || 't1';
const TEST_CODE_2 = process.env.E2E_TEST_CODE_2 || 't2';

async function setupMultiTestEncounter() {
  const timings = createTimings();
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  timings.mark('patient_create');

  const suffix = Date.now().toString(36).toUpperCase();
  const { data: patient } = await apiPost<{ id: string }>(
    '/patients',
    { firstName: 'Multi', lastName: 'Param', mrn: `MP-${suffix}`, gender: 'M' },
    accessToken,
  );
  timings.mark('encounter_create');

  const { data: encounter } = await apiPost<{ id: string }>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );
  timings.mark('order_tests');

  // Order both tests in one command
  await apiPost(
    `/encounters/${encounter.id}:order-lab`,
    { tests: [{ code: TEST_CODE_1 }, { code: TEST_CODE_2 }] },
    accessToken,
  );
  timings.mark('collect_specimen');

  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);
  timings.mark('setup_done');

  const entries = timings.finish();
  flushTimings('setup:multi-test-encounter', entries);

  return { encounter, accessToken, timings: entries };
}

test.describe('Happy path — multi-parameter workflow', () => {
  test('order two tests, enter all results, submit all', async ({ authedPage: page }) => {
    const { encounter, accessToken } = await setupMultiTestEncounter();

    // Check actual order count via API (API may group multiple tests into 1 order)
    const enc = await apiGet<{ labOrders: Array<{ id: string }> }>(
      `/encounters/${encounter.id}`,
      accessToken,
    );
    const expectedOrderCount = enc.labOrders?.length ?? 1;

    await page.goto(`/lims/encounters/${encounter.id}/results`);
    await expect(page.locator('text=Loading encounter...')).not.toBeVisible({ timeout: 15_000 });

    const t = createTimings();
    t.mark('results_page_load');

    // There should be at least 1 result input row per lab order
    const valueInputs = page.locator('input[placeholder="Enter result value"]');
    await expect(valueInputs.first()).toBeVisible({ timeout: 10_000 });
    const count = await valueInputs.count();
    // Verify the UI matches what the API says (at least 1, may group differently)
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBe(expectedOrderCount);
    t.mark('results_page_loaded');

    // Fill all result inputs
    for (let i = 0; i < count; i++) {
      await valueInputs.nth(i).fill('5.5');
    }
    t.mark('results_filled');

    await page.getByRole('button', { name: 'Save All Results' }).click();
    await expect(page.locator('text=Results saved')).toBeVisible({ timeout: 15_000 });
    t.mark('results_saved');

    flushTimings('multi-param:enter-results', t.finish());
    await expect(page.getByRole('link', { name: /Proceed to Verify/i })).toBeVisible();
  });

  test('multi-test: verify and document published', async ({ authedPage: page }) => {
    test.setTimeout(120_000);
    const { encounter, accessToken } = await setupMultiTestEncounter();

    // Advance to resulted via API
    const enc = await apiGet<{ labOrders: Array<{ id: string }> }>(
      `/encounters/${encounter.id}`,
      accessToken,
    );

    const t = createTimings();
    t.mark('result_save');
    for (const order of enc.labOrders ?? []) {
      await apiPost(
        `/encounters/${encounter.id}:result`,
        { labOrderId: order.id, value: '5.5', flag: 'normal' },
        accessToken,
      );
    }
    t.mark('verify');

    await page.goto(`/lims/encounters/${encounter.id}/verify`);
    await expect(page.locator('text=Loading encounter...')).not.toBeVisible({ timeout: 15_000 });

    const openModalBtn = page.getByRole('button', { name: 'Verify & Publish' });
    await expect(openModalBtn).toBeVisible({ timeout: 10_000 });
    await openModalBtn.click();

    const verifyBtn = page.getByRole('button', { name: 'Confirm Verify' });
    await expect(verifyBtn).toBeVisible({ timeout: 5_000 });
    await verifyBtn.click();
    t.mark('publish');

    // Document auto-generated on verify — wait for PUBLISHED badge
    await expect(
      page.locator('text=PUBLISHED').or(page.getByRole('link', { name: /Download/i })).first(),
    ).toBeVisible({ timeout: 60_000 });
    t.mark('done');

    flushTimings('multi-param:verify-publish', t.finish());
  });

  test('multi-test: idempotent publish — two generate calls return same document ID', async ({}) => {
    const { encounter, accessToken } = await setupMultiTestEncounter();

    const enc = await apiGet<{
      patient: { firstName: string; lastName: string; mrn: string };
      labOrders: Array<{ id: string; test?: { code: string; name: string }; result?: { value: string } }>;
    }>(`/encounters/${encounter.id}`, accessToken);

    // Result all orders
    for (const order of enc.labOrders ?? []) {
      await apiPost(
        `/encounters/${encounter.id}:result`,
        { labOrderId: order.id, value: '5.5', flag: 'normal' },
        accessToken,
      );
    }
    await apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken);

    const payload = {
      reportNumber: `RPT-${encounter.id.slice(0, 8).toUpperCase()}`,
      issuedAt: new Date().toISOString(),
      patientName: `${enc.patient.firstName} ${enc.patient.lastName}`,
      patientMrn: enc.patient.mrn,
      encounterId: encounter.id,
      tests: (enc.labOrders ?? []).map((o) => ({
        testCode: o.test?.code ?? o.id,
        testName: o.test?.name ?? 'Unknown',
        parameters: o.result
          ? [{ parameterCode: 'result', parameterName: 'Result', value: o.result.value }]
          : [],
      })),
    };

    const { data: doc1 } = await apiPost<{ id: string }>('/documents/report:generate', payload, accessToken);
    const { data: doc2 } = await apiPost<{ id: string }>('/documents/report:generate', payload, accessToken);

    expect(doc1.id).toBe(doc2.id);
  });
});
