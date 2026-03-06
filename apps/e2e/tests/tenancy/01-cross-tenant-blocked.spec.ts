/**
 * tests/tenancy/01-cross-tenant-blocked.spec.ts
 * @tenancy @smoke — Cross-tenant access must be rejected (403 or 404).
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost, API_BASE } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';
const SYSTEM_TENANT = process.env.SYSTEM_TENANT_ID || 'system';
const FAKE_TENANT = 'attacker-tenant-xyz';

async function fetchWithTenant(path: string, token: string, tenantId: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
  });
}

test.describe('@tenancy @smoke Tenant Isolation', () => {
  test('encounter created under system tenant is not accessible with spoofed tenant header', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'CrossTenant', lastName: 'Block', mrn: `CTB-${suffix}`, gender: 'M' },
      accessToken,
    );

    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    // Attempt to read with spoofed tenant
    const spoofedRes = await fetchWithTenant(`/encounters/${encounter.id}`, accessToken, FAKE_TENANT);
    expect([403, 404]).toContain(spoofedRes.status);
  });

  test('patient list with spoofed tenant does not leak system tenant records', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    // Create a distinctive patient under system tenant
    await apiPost<{ id: string }>(
      '/patients',
      {
        firstName: 'LeakTest',
        lastName: 'Patient',
        mrn: `LKT-${suffix}`,
        phone: '03001234567',
        gender: 'F',
      },
      accessToken,
    );

    // List patients with spoofed tenant
    const spoofedRes = await fetchWithTenant('/patients', accessToken, FAKE_TENANT);

    if (spoofedRes.status === 403 || spoofedRes.status === 404) {
      // Hard block — correct
      return;
    }

    if (spoofedRes.status === 200) {
      const body = await spoofedRes.json().catch(() => ({ data: [], items: [] }));
      const patients: any[] = Array.isArray(body) ? body : (body.data ?? body.items ?? []);

      // The distinctive MRN should NOT appear in the spoofed tenant's list
      const leaked = patients.some((p: any) => p.mrn === `LKT-${suffix}`);
      expect(leaked).toBe(false);
    }
  });

  test('encounter list with spoofed tenant header does not leak records', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    // Create a patient and encounter under system tenant
    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'EncLeak', lastName: 'Test', mrn: `ELK-${suffix}`, gender: 'M' },
      accessToken,
    );

    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    // List encounters with spoofed tenant
    const spoofedRes = await fetchWithTenant('/encounters', accessToken, FAKE_TENANT);

    if (spoofedRes.status === 403 || spoofedRes.status === 404) {
      return; // Hard block — correct
    }

    if (spoofedRes.status === 200) {
      const body = await spoofedRes.json().catch(() => ({ data: [], items: [] }));
      const encounters: any[] = Array.isArray(body) ? body : (body.data ?? body.items ?? []);

      // The system-tenant encounter should NOT appear
      const leaked = encounters.some((e: any) => e.id === encounter.id);
      expect(leaked).toBe(false);
    }
  });

  test('direct GET of specific encounter ID with spoofed tenant returns 403 or 404', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);
    const suffix = Date.now().toString(36).toUpperCase();

    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'DirectGet', lastName: 'Spoof', mrn: `DGS-${suffix}`, gender: 'M' },
      accessToken,
    );

    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    const spoofedRes = await fetchWithTenant(`/encounters/${encounter.id}`, accessToken, FAKE_TENANT);
    expect([403, 404]).toContain(spoofedRes.status);
  });
});
