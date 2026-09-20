/**
 * @documents — PDF render failure and retry.
 *
 * Opt-in infrastructure test. Run the first test with
 * PDF_TEST_FAILURE_INJECTION=true, then recreate pdf/worker with the flag
 * false before the retry test. The live closure sprint also records a direct
 * API proof for this sequence in docs/audits/20260920_go_live_closure.
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost, apiPostRaw, apiGet } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';
let failedDocumentId: string;

async function createVerifiedEncounter() {
  const { accessToken } = await apiLogin(EMAIL, PASSWORD);
  const suffix = Date.now().toString(36).toUpperCase();
  const { data: patient } = await apiPost<any>('/patients', {
    firstName: 'Failure', lastName: 'Retry', mrn: `FAIL-${suffix}`, gender: 'M',
  }, accessToken);
  const { data: encounter } = await apiPost<any>('/encounters', { patientId: patient.id }, accessToken);
  const { data: order } = await apiPost<any>(
    `/encounters/${encounter.id}:order-lab`, { tests: [{ code: 't1' }] }, accessToken,
  );
  const orderedTestId = (order.labOrders || order.data?.labOrders || [])[0]?.id;
  await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);
  await apiPostRaw(`/encounters/${encounter.id}:result`, {
    labOrderId: orderedTestId, value: '5.4', flag: 'normal',
  }, accessToken);
  await apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken);

  for (let i = 0; i < 45; i++) {
    const result = await apiGet<any>(`/documents?encounterId=${encounter.id}`, accessToken);
    const docs = Array.isArray(result) ? result : (result.data || result.items || []);
    if (docs[0]) return { accessToken, document: docs[0] };
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('Document was not created');
}

test.describe('@documents Documents — Render Failure & Retry', () => {
  test.skip(
    process.env.RUN_PDF_FAILURE_E2E !== 'true',
    'Opt-in: requires controlled PDF failure injection and a service restart between the two tests.',
  );
  test.describe.configure({ mode: 'serial' });

  test('PDF render failure results in FAILED document status', async () => {
    const { accessToken, document } = await createVerifiedEncounter();
    failedDocumentId = document.id;
    let current = document;
    for (let i = 0; i < 45; i++) {
      current = await apiGet<any>(`/documents/${failedDocumentId}`, accessToken);
      if (current.status === 'FAILED') break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    expect(current.status).toBe('FAILED');
    expect(current.errorMessage).toMatch(/PDF service returned 503|TEST_INJECTED_PDF_FAILURE/);
  });

  test('Retry on FAILED document re-queues and eventually renders', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const retry = await apiPostRaw(`/documents/${failedDocumentId}:retry`, {}, accessToken);
    expect(retry.ok).toBeTruthy();
    let current: any;
    for (let i = 0; i < 60; i++) {
      current = await apiGet<any>(`/documents/${failedDocumentId}`, accessToken);
      if (current.status === 'RENDERED' || current.status === 'PUBLISHED') break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    expect(['RENDERED', 'PUBLISHED']).toContain(current.status);
    expect(current.storageKey).toBeTruthy();
    expect(current.pdfHash).toBeTruthy();
  });
});
