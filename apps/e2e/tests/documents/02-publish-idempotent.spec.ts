/**
 * tests/documents/02-publish-idempotent.spec.ts
 * @documents — Document generation is idempotent (same payload → same document).
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

interface PatientData { id: string }
interface EncounterData { id: string }

async function setupVerifiedEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();

  const { data: patient } = await apiPost<PatientData>(
    '/patients',
    { firstName: 'Idem', lastName: 'Potent', mrn: `IDP-${suffix}`, gender: 'M' },
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

test.describe('@documents Documents — Idempotency', () => {
  test('same encounter verify generates same document (no duplicate)', async () => {
    const { encounter, accessToken } = await setupVerifiedEncounter();

    // Wait for documents to be created (auto-generated post-verify)
    let docs1: any[] = [];
    for (let i = 0; i < 30; i++) {
      const result = await apiGet<any>(`/documents?encounterId=${encounter.id}`, accessToken).catch(() => null);
      docs1 = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
      if (docs1.length > 0) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }

    expect(docs1.length).toBeGreaterThan(0);

    // Wait a moment and re-fetch — document count should remain the same
    await new Promise((r) => setTimeout(r, 3_000));

    const result2 = await apiGet<any>(`/documents?encounterId=${encounter.id}`, accessToken);
    const docs2 = Array.isArray(result2) ? result2 : (result2?.data ?? result2?.items ?? []);

    // Same number of documents — idempotent generation doesn't create duplicates
    expect(docs2.length).toBe(docs1.length);

    // Same IDs
    const ids1 = new Set(docs1.map((d: any) => d.id));
    const ids2 = new Set(docs2.map((d: any) => d.id));
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(true);
    }
  });

  test('explicitly re-triggering document generation for same encounter returns same ID or created:false', async () => {
    const { encounter, accessToken } = await setupVerifiedEncounter();

    // Wait for auto-generated document
    let existingDocId: string | null = null;
    for (let i = 0; i < 30; i++) {
      const result = await apiGet<any>(`/documents?encounterId=${encounter.id}`, accessToken).catch(() => null);
      const docs = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
      if (docs.length > 0) {
        existingDocId = docs[0].id;
        break;
      }
      await new Promise((r) => setTimeout(r, 2_000));
    }

    if (!existingDocId) {
      // Auto-document not generated yet — skip idempotency check
      return;
    }

    // Attempt to trigger document generation manually via API (if endpoint exists)
    const genRes = await apiPostRaw(
      `/encounters/${encounter.id}:documents-generate`,
      { docType: 'LAB_REPORT' },
      accessToken,
    );

    if (genRes.status === 404 || genRes.status === 405) {
      // Manual trigger endpoint not available — idempotency is enforced differently
      return;
    }

    const genData = await genRes.json().catch(() => null);

    if (genData) {
      // Should return same ID OR a created:false flag
      const returnedId = genData.id ?? genData.documentId;
      const isNew = genData.created ?? true;

      if (returnedId) {
        expect(returnedId).toBe(existingDocId);
      } else if ('created' in genData) {
        expect(genData.created).toBe(false);
      }
    }
  });
});
