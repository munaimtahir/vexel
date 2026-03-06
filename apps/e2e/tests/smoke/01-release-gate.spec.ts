/**
 * tests/smoke/01-release-gate.spec.ts
 * @smoke — Release gate: fast, deterministic, covers all major areas.
 * Target total runtime: < 60s. API-heavy setup, minimal UI assertions.
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost, apiPostRaw, apiGet, API_BASE } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';
const FAKE_TENANT = 'attacker-tenant-smoke-xyz';

test.describe('@smoke Release Gate', () => {
  test('app boots: operator /login loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible({ timeout: 10_000 });
  });

  test('login: valid credentials redirect to /lims/worklist', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/lims/worklist', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/lims\/worklist/);
  });

  test('protected route: unauthenticated /lims/worklist redirects to /login', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/lims/worklist');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test('one LIMS mini-flow: create patient+encounter, order, collect, result, verify', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    // Patient
    const { data: patient, status: s1 } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'Smoke', lastName: 'Gate', mrn: `SMK-${suffix}`, gender: 'M' },
      accessToken,
    );
    expect([200, 201]).toContain(s1);

    // Encounter
    const { data: encounter, status: s2 } = await apiPost<{ id: string; status: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );
    expect([200, 201]).toContain(s2);

    // Order lab — returns encounter object with labOrders[]
    const { data: orderEnc, status: s3 } = await apiPost<{ id: string; labOrders?: { id: string }[] }>(
      `/encounters/${encounter.id}:order-lab`,
      { tests: [{ code: 't1' }] },
      accessToken,
    );
    expect([200, 201]).toContain(s3);

    // Collect specimen
    const collectRes = await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);
    expect([200, 201]).toContain(collectRes.status);

    // Enter result — labOrderId is the first labOrder's id
    const orderedTestId = orderEnc?.labOrders?.[0]?.id;
    const resultRes = await apiPostRaw(
      `/encounters/${encounter.id}:result`,
      { labOrderId: orderedTestId, value: '5.4', flag: 'normal' },
      accessToken,
    );
    expect([200, 201]).toContain(resultRes.status);

    // Verify
    const verifyRes = await apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken);
    expect([200, 201]).toContain(verifyRes.status);

    // Confirm status via GET
    const enc = await apiGet<{ status: string }>(`/encounters/${encounter.id}`, accessToken);
    expect(['verified', 'published', 'lab_verified']).toContain(enc.status);
  });

  test('document: after verify, encounter has at least one document', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    // Full setup
    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'SmokeDoc', lastName: 'Test', mrn: `SDS-${suffix}`, gender: 'F' },
      accessToken,
    );
    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );
    const { data: orderEnc2 } = await apiPost<{ id: string; labOrders?: { id: string }[] }>(
      `/encounters/${encounter.id}:order-lab`,
      { tests: [{ code: 't1' }] },
      accessToken,
    );
    await apiPostRaw(`/encounters/${encounter.id}:collect-specimen`, {}, accessToken);
    const orderedTestId2 = orderEnc2?.labOrders?.[0]?.id;
    await apiPostRaw(
      `/encounters/${encounter.id}:result`,
      { labOrderId: orderedTestId2, value: '5.4', flag: 'normal' },
      accessToken,
    );
    await apiPostRaw(`/encounters/${encounter.id}:verify`, {}, accessToken);

    // Poll for documents (up to 30s) — use /documents?encounterId= (correct endpoint)
    let docs: any[] = [];
    for (let i = 0; i < 15; i++) {
      const result = await apiGet<any>(`/documents?encounterId=${encounter.id}`, accessToken).catch(() => null);
      if (result) {
        docs = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
      }
      if (docs.length > 0) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }

    expect(docs.length).toBeGreaterThan(0);
  });

  test('tenancy: cross-tenant access blocked (403 or 404)', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'SmokeTenant', lastName: 'Block', mrn: `STB-${suffix}`, gender: 'M' },
      accessToken,
    );
    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    const spoofedRes = await fetch(`${API_BASE}/encounters/${encounter.id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': FAKE_TENANT,
      },
    });
    expect([403, 404]).toContain(spoofedRes.status);
  });

  test('API health endpoint returns ok', async () => {
    const res = await fetch(`${API_BASE}/health`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
