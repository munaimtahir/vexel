/**
 * 05-operator-workflow.spec.ts
 * Full LIMS workflow: encounter → results → verify → publish.
 *
 * Preconditions (set up via API):
 *   1. Patient exists
 *   2. Encounter exists with at least one lab order (status = lab_ordered or specimen_collected)
 *
 * The test walks through:
 *   Enter Results → Submit → Verify (modal confirm) → Publish page visible
 */

import { test, expect } from '../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

/** Create patient + encounter + lab order, then collect specimen via API commands */
async function setupWorkflowEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);

  const suffix = Date.now().toString(36).toUpperCase();

  // Patient
  const { data: patient } = await apiPost<{ id: string }>(
    '/patients',
    { firstName: 'Workflow', lastName: 'Patient', mrn: `WF-${suffix}`, gender: 'M' },
    accessToken,
  );

  // Encounter
  const { data: encounter } = await apiPost<{ id: string; status: string }>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );

  // Place a lab order (command endpoint)
  // The order body may need a testId — use a known catalog test code or placeholder
  const testCode = process.env.E2E_TEST_CODE || 't1'; // Glucose (externalId t1), expected in seed data
  await apiPost(
    `/encounters/${encounter.id}:order-lab`,
    { tests: [{ code: testCode }] },
    accessToken,
  );

  // Collect specimen (command)
  await apiPostRaw(
    `/encounters/${encounter.id}:collect-specimen`,
    {},
    accessToken,
  );

  return { encounter, accessToken };
}

test.describe('Operator — Full LIMS workflow', () => {
  test('enter results and submit, status updates to resulted', async ({ authedPage: page }) => {
    const { encounter } = await setupWorkflowEncounter();

    await page.goto(`/encounters/${encounter.id}/results`);
    await expect(page.getByRole('heading', { name: /Lab Order Results/i })).toBeVisible({ timeout: 10_000 });

    // Wait for form to load (spinner gone)
    await expect(page.locator('text=Loading encounter...')).not.toBeVisible({ timeout: 10_000 });

    // The results form renders one row per lab order.
    // Fill the first "Value *" input
    const valueInput = page.locator('input[placeholder="Enter result value"]').first();
    await expect(valueInput).toBeVisible({ timeout: 8_000 });
    await valueInput.fill('5.4');

    // Flag select defaults to "normal" — leave as-is

    await page.getByRole('button', { name: 'Save All Results' }).click();

    // After saving, the page shows a success banner with a Proceed to Verify link
    await expect(page.locator('text=Results saved')).toBeVisible({ timeout: 10_000 });

    // "Proceed to Verify" link is now present
    await expect(page.getByRole('link', { name: /Proceed to Verify/i })).toBeVisible();
  });

  test('verify results via modal confirm, transitions to verified', async ({ authedPage: page }) => {
    const { encounter } = await setupWorkflowEncounter();

    // Advance encounter to resulted status via API first
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    // Get orders from encounter
    const enc = await apiGet<{ labOrders: Array<{ id: string }> }>(
      `/encounters/${encounter.id}`,
      accessToken,
    );
    // Submit result for each order
    for (const order of enc.labOrders ?? []) {
      await apiPost(
        `/encounters/${encounter.id}:result`,
        { labOrderId: order.id, value: '5.4', flag: 'normal' },
        accessToken,
      );
    }

    await page.goto(`/encounters/${encounter.id}/verify`);
    await expect(page.locator('text=Loading encounter...')).not.toBeVisible({ timeout: 10_000 });

    // The verify page shows a "Verify & Publish" button to open confirmation modal
    const openModalBtn = page.getByRole('button', { name: 'Verify & Publish' });
    await expect(openModalBtn).toBeVisible({ timeout: 8_000 });
    await openModalBtn.click();

    // Confirmation modal appears
    const modal = page.locator('div').filter({ hasText: /Verify all results for/i }).last();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Click the modal's "Confirm Verify" button
    const verifyBtn = page.getByRole('button', { name: 'Confirm Verify' });
    await verifyBtn.click();

    // After verify, the page shows "Report Published" or a Download link
    await expect(page.locator('text=PUBLISHED').or(page.getByRole('link', { name: /Download/i })).first()).toBeVisible({ timeout: 30_000 });
  });

  test('publish page is accessible after verified status', async ({ authedPage: page }) => {
    const { encounter, accessToken } = await setupWorkflowEncounter();

    // Advance to verified via API
    const enc = await apiGet<{ labOrders: Array<{ id: string }> }>(
      `/encounters/${encounter.id}`,
      accessToken,
    );
    for (const order of enc.labOrders ?? []) {
      await apiPost(
        `/encounters/${encounter.id}:result`,
        { labOrderId: order.id, value: '5.4', flag: 'normal' },
        accessToken,
      );
    }
    await apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken);

    await page.goto(`/encounters/${encounter.id}/publish`);
    await expect(page.locator('text=Loading encounter...')).not.toBeVisible({ timeout: 10_000 });

    // Publish page heading (auto-generated report status page)
    await expect(page.locator('text=Lab Report')).toBeVisible();

    // Report is auto-generated on verify — either waiting or already published
    const statusOrWaiting = page.locator('text=Waiting for report').or(page.locator('text=RENDERED')).or(page.locator('text=PUBLISHED')).or(page.locator('text=RENDERING'));
    await expect(statusOrWaiting.first()).toBeVisible({ timeout: 10_000 });

    // Encounter status badge on identity header shows "Verified"
    await expect(page.getByText('Verified', { exact: true }).first()).toBeVisible();
  });
});
