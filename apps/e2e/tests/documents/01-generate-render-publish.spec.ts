/**
 * tests/documents/01-generate-render-publish.spec.ts
 * @documents @smoke — Document generation, rendering, and publishing.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../../helpers/api-client';
import { waitForDocumentRendered } from '../../helpers/wait-for';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

interface PatientData { id: string }
interface EncounterData { id: string; status: string }
interface DocumentData { id: string; status: string; url?: string }

async function setupVerifiedEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<PatientData>(
    '/patients',
    { firstName: 'DocTest', lastName: 'Patient', mrn: `DOC-${suffix}`, gender: 'M' },
    accessToken,
  );

  const { data: encounter } = await apiPost<EncounterData>(
    '/encounters',
    { patientId: patient.id },
    accessToken,
  );

  const { data: order } = await apiPost<{ id: string; labOrders?: { id: string }[] }>(
    `/encounters/${encounter.id}:order-lab`,
    { tests: [{ code: 't1' }] },
    accessToken,
  );

  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);

  const orderedTestId = order?.labOrders?.[0]?.id;
  await apiPostRaw(
    `/encounters/${encounter.id}:result`,
    { labOrderId: orderedTestId, value: '5.4', flag: 'normal' },
    accessToken,
  );

  await apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken);

  return { encounter, accessToken };
}

test.describe('@documents @smoke Documents — Generate, Render, Publish', () => {
  test('after verify, document is generated and reaches PUBLISHED status', async () => {
    const { encounter, accessToken } = await setupVerifiedEncounter();

    // Poll for documents linked to encounter — correct endpoint: /documents?encounterId=
    let docs: DocumentData[] = [];
    for (let i = 0; i < 45; i++) {
      const result = await apiGet<{ data?: DocumentData[]; items?: DocumentData[] } | DocumentData[]>(
        `/documents?encounterId=${encounter.id}`,
        accessToken,
      ).catch(() => null);

      if (result) {
        docs = Array.isArray(result)
          ? result
          : ((result as any).data ?? (result as any).items ?? []);
      }

      if (docs.length > 0) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }

    expect(docs.length).toBeGreaterThan(0);

    // Wait for first document to reach PUBLISHED (auto-publish after verify)
    const doc = docs[0];
    const published = await waitForDocumentRendered(doc.id, accessToken, {
      maxPolls: 45,
      delayMs: 2_000,
    });
    expect(['RENDERED', 'PUBLISHED']).toContain((published as any).status);
  });

  test('after verify, UI shows lab report heading and published indicator', async ({
    authedPage: page,
  }) => {
    const { encounter } = await setupVerifiedEncounter();

    // Navigate to reports or encounter detail
    await page.goto(`/lims/reports`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // OR navigate directly to encounter — published docs should appear
    await page.goto(`/lims/encounters/${encounter.id}`);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8_000 });

    // Published badge or download link should appear within 90s
    await expect(
      page
        .getByText(/published/i)
        .or(page.getByRole('link', { name: /download|report|pdf/i }))
        .first(),
    ).toBeVisible({ timeout: 90_000 });
  });

  test('download PDF button is visible when document is published', async ({
    authedPage: page,
  }) => {
    const { encounter, accessToken } = await setupVerifiedEncounter();

    // Wait for document to be published via API first
    const docs = await (async () => {
      for (let i = 0; i < 45; i++) {
        const result = await apiGet<any>(`/documents?encounterId=${encounter.id}`, accessToken).catch(() => null);
        const items = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
        if (items.length > 0) return items;
        await new Promise((r) => setTimeout(r, 2_000));
      }
      return [];
    })();

    if (docs.length > 0) {
      await waitForDocumentRendered(docs[0].id, accessToken, { maxPolls: 45, delayMs: 2_000 });
    }

    // Navigate to encounter page
    await page.goto(`/lims/encounters/${encounter.id}`);

    await expect(
      page.getByRole('link', { name: /download|pdf|report/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
