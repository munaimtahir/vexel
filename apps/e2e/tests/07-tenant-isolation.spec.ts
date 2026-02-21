/**
 * 07-tenant-isolation.spec.ts
 * Cross-tenant access must return 403 or 404.
 * Enforces the strict tenant isolation guardrail (see TENANCY.md).
 */

import { test, expect } from '@playwright/test';
import { apiLogin, apiPost, apiPostRaw, API_BASE } from '../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

/**
 * Direct fetch that allows inspecting status without throwing,
 * with an explicit x-tenant-id override.
 */
async function getWithTenant(path: string, token: string, tenantId: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
  });
}

test.describe('Tenant isolation', () => {
  test('encounter created under system tenant is not accessible with a different tenant header', async () => {
    // Login and create a resource under the system tenant
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);

    const suffix = Date.now().toString(36).toUpperCase();
    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'Isolation', lastName: 'Patient', mrn: `ISO-${suffix}`, gender: 'M' },
      accessToken,
    );

    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    // Attempt to read the same encounter ID with a fictitious tenant header
    const spoofedRes = await getWithTenant(
      `/encounters/${encounter.id}`,
      accessToken,
      'tenant-that-does-not-exist',
    );

    // Must be 403 Forbidden or 404 Not Found — never 200
    expect([403, 404]).toContain(spoofedRes.status);
  });

  test('patient created under system tenant is not accessible with a spoofed tenant header', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);

    const suffix = Date.now().toString(36).toUpperCase();
    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'Iso2', lastName: 'Patient', mrn: `ISO2-${suffix}`, gender: 'F' },
      accessToken,
    );

    const spoofedRes = await getWithTenant(
      `/patients/${patient.id}`,
      accessToken,
      'attacker-tenant-xyz',
    );

    expect([403, 404]).toContain(spoofedRes.status);
  });

  test('cross-tenant list endpoint does not leak records', async () => {
    const { accessToken } = await apiLogin(EMAIL, PASSWORD);

    // Create an encounter under system tenant
    const suffix = Date.now().toString(36).toUpperCase();
    const { data: patient } = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'Leak', lastName: 'Test', mrn: `LK-${suffix}`, gender: 'M' },
      accessToken,
    );
    const { data: encounter } = await apiPost<{ id: string }>(
      '/encounters',
      { patientId: patient.id },
      accessToken,
    );

    // Request encounter list with a different tenant header
    const spoofedListRes = await getWithTenant('/encounters', accessToken, 'other-tenant-abc');

    // Either 403/404 OR the list must not contain our encounter ID
    if (spoofedListRes.ok) {
      const body = await spoofedListRes.json().catch(() => ({ data: [] }));
      const ids = (body.data ?? []).map((e: { id: string }) => e.id);
      expect(ids).not.toContain(encounter.id);
    } else {
      expect([403, 404]).toContain(spoofedListRes.status);
    }
  });
});
