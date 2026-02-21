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
  test('generate report, poll until RENDERED, publish and download', async ({ authedPage: page }) => {
    const { encounter } = await setupVerifiedEncounter();

    await page.goto(`/encounters/${encounter.id}/publish`);
    await expect(page.locator('text=Loading encounter...')).not.toBeVisible({ timeout: 10_000 });

    // Step 1: Generate
    const generateBtn = page.getByRole('button', { name: /Generate Lab Report/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Step 2: Poll — the UI polls every 3s internally.
    // We wait for the RENDERED status badge to appear.
    await expect(page.locator('text=RENDERED')).toBeVisible({ timeout: 60_000 });

    // Step 3: Publish Document
    const publishBtn = page.getByRole('button', { name: /Publish Document/i });
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // Status should transition to PUBLISHED
    await expect(page.locator('text=PUBLISHED')).toBeVisible({ timeout: 15_000 });

    // Step 4: Download PDF — opens in new tab; we intercept the click and check URL
    const downloadBtn = page.getByRole('button', { name: /Download PDF/i });
    await expect(downloadBtn).toBeVisible();

    // Intercept new page / popup for download
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 10_000 }).catch(() => null),
      downloadBtn.click(),
    ]);

    // If a popup was opened, it should be a PDF URL or a signed URL pointing to PDF storage
    if (popup) {
      const url = popup.url();
      expect(url).toBeTruthy();
      await popup.close();
    }
    // TODO: If using direct download (not popup), assert download content-type = application/pdf
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

    expect(['QUEUED', 'RENDERING', 'RENDERED']).toContain(doc.status);

    if (doc.status !== 'RENDERED') {
      const rendered = await waitForDocumentRendered(doc.id, accessToken, {
        maxPolls: 15,
        delayMs: 2000,
      });
      expect((rendered as any).status).toBe('RENDERED');
    }
  });
});
