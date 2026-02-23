/**
 * 06-document-pipeline.spec.ts
 * Document generation, polling, publish, download, and idempotency.
 *
 * Precondition: encounter in "verified" status (set up via API).
 */

import { test, expect } from '../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../helpers/api-client';
import { waitForDocumentRendered } from '../helpers/wait-for';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

async function setupVerifiedEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<{ id: string }>(
    '/patients',
    { firstName: 'Doc', lastName: 'Patient', mrn: `DOC-${suffix}`, gender: 'F' },
    accessToken,
  );
  const { data: encounter } = await apiPost<{ id: string; labOrders: Array<{ id: string }> }>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );

  const testCode = process.env.E2E_TEST_CODE || 'GLU';
  await apiPost(`/encounters/${encounter.id}:order-lab`, { tests: [{ code: testCode }] }, accessToken);
  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

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

  return { encounter, accessToken };
}

test.describe('Document pipeline', () => {
  test('report auto-generated on verify and downloadable from publish page', async ({ authedPage: page }) => {
    test.setTimeout(90_000); // auto-generation can take up to 60s
    const { encounter } = await setupVerifiedEncounter();

    await page.goto(`/encounters/${encounter.id}/publish`);
    await expect(page.locator('text=Loading encounter...')).not.toBeVisible({ timeout: 10_000 });

    // The publish page shows "Lab Report" heading and auto-polls
    await expect(page.locator('text=Lab Report')).toBeVisible({ timeout: 5_000 });

    // Report is auto-generated when encounter is verified — poll until PUBLISHED
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible({ timeout: 60_000 });

    // Download PDF button should be visible once published
    const downloadBtn = page.getByRole('button', { name: /Download PDF/i });
    await expect(downloadBtn).toBeVisible();
    await downloadBtn.click();
    // Download is triggered via blob URL — no popup expected
  });

  test('generate report twice returns same document ID (idempotency)', async ({ authedPage: page }) => {
    const { encounter, accessToken } = await setupVerifiedEncounter();

    // Generate via API directly (faster than UI for idempotency test)
    const enc = await apiGet<{ patient: { firstName: string; lastName: string; mrn: string; dateOfBirth?: string; gender?: string }; labOrders: Array<{ id: string; test?: { code: string; name: string }; result?: { value: string; unit?: string; referenceRange?: string; flag?: string } }> }>(
      `/encounters/${encounter.id}`,
      accessToken,
    );

    const reportBody = {
      reportNumber: `RPT-${encounter.id.slice(0, 8).toUpperCase()}`,
      issuedAt: new Date().toISOString(),
      patientName: `${enc.patient.firstName} ${enc.patient.lastName}`,
      patientMrn: enc.patient.mrn,
      patientDob: enc.patient.dateOfBirth
        ? new Date(enc.patient.dateOfBirth).toISOString().split('T')[0]
        : undefined,
      patientGender: enc.patient.gender,
      encounterId: encounter.id,
      tests: (enc.labOrders ?? []).map((o) => ({
        testCode: o.test?.code ?? o.id,
        testName: o.test?.name ?? 'Unknown',
        parameters: o.result
          ? [{ parameterCode: 'result', parameterName: 'Result', value: o.result.value, unit: o.result.unit, referenceRange: o.result.referenceRange, flag: o.result.flag }]
          : [],
      })),
    };

    const { data: doc1 } = await apiPost<{ id: string }>('/documents/report:generate', reportBody, accessToken);
    const { data: doc2 } = await apiPost<{ id: string }>('/documents/report:generate', reportBody, accessToken);

    // Idempotency: same payload → same document ID
    expect(doc1.id).toBe(doc2.id);
  });

  test('document status transitions: QUEUED/RENDERING → RENDERED', async ({}) => {
    test.setTimeout(60_000); // rendering can take up to 30s
    const { encounter, accessToken } = await setupVerifiedEncounter();

    const enc = await apiGet<{ patient: { firstName: string; lastName: string; mrn: string }; labOrders: Array<{ id: string; test?: { code: string; name: string }; result?: { value: string } }> }>(
      `/encounters/${encounter.id}`,
      accessToken,
    );

    const { data: doc } = await apiPost<{ id: string; status: string }>(
      '/documents/report:generate',
      {
        reportNumber: `RPT-${encounter.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        patientName: `${enc.patient.firstName} ${enc.patient.lastName}`,
        patientMrn: enc.patient.mrn,
        encounterId: encounter.id,
        tests: [],
      },
      accessToken,
    );

    expect(['QUEUED', 'RENDERING', 'RENDERED', 'PUBLISHED']).toContain(doc.status);

    if (doc.status !== 'RENDERED' && doc.status !== 'PUBLISHED') {
      const rendered = await waitForDocumentRendered(doc.id, accessToken, {
        maxPolls: 20,
        delayMs: 2000,
      });
      expect(['RENDERED', 'PUBLISHED']).toContain((rendered as any).status);
    }
  });
});
