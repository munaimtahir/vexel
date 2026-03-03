import { test, expect } from '../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function setupSubmittedEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<{ id: string }>(
    '/patients',
    { firstName: 'Verify', lastName: 'Badge', mrn: `VB-${suffix}`, gender: 'M' },
    accessToken,
  );

  const { data: encounter } = await apiPost<{ id: string; encounterCode?: string }>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );

  const testCode = process.env.E2E_TEST_CODE || 't1';
  await apiPost(`/encounters/${encounter.id}:order-lab`, { tests: [{ code: testCode }] }, accessToken);
  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

  const detail = await apiGet<{ labOrders: Array<{ id: string }> }>(`/encounters/${encounter.id}`, accessToken);
  for (const order of detail.labOrders ?? []) {
    await apiPost(`/encounters/${encounter.id}:result`, { labOrderId: order.id, value: '5.4', flag: 'normal' }, accessToken);
    await apiPost(`/results/tests/${order.id}:submit`, {}, accessToken);
  }

  return { encounterId: encounter.id, encounterCode: encounter.encounterCode ?? '' };
}

test.describe('Verification badge refetch regression', () => {
  test('updates from pending verification to verified immediately after verify command', async ({ authedPage: page }) => {
    test.setTimeout(90_000);
    const { encounterId, encounterCode } = await setupSubmittedEncounter();

    await page.goto(`/lims/verification/encounters/${encounterId}`);
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15_000 });
    const verifyButton = page.getByRole('button', { name: /Verify patient/i });
    await expect(verifyButton).toBeVisible({ timeout: 10_000 });
    await expect(verifyButton).toBeEnabled({ timeout: 10_000 });
    await verifyButton.click();

    await expect(page.getByText('All tests verified. Report PDF rendering started.')).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForURL('**/lims/verification', { timeout: 20_000 });
    const search = page.getByPlaceholder(/Search by patient name or MRN/i);
    await expect(search).toBeVisible({ timeout: 10_000 });
    if (encounterCode) {
      await search.fill(encounterCode);
      await page.getByRole('button', { name: 'Search' }).click();
    }
    await expect(page.getByText('No patients pending verification')).toBeVisible({ timeout: 10_000 });
  });
});
