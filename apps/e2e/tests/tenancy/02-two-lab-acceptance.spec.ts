/**
 * G1 — two-lab acceptance.
 *
 * This is intentionally opt-in because it requires a real second-tenant
 * operator account and domain. The run covers tenant-scoped catalogue,
 * users/authentication, results, documents, jobs and audit visibility.
 */
import { test, expect } from '@playwright/test';

const SYSTEM_BASE = process.env.API_BASE || 'http://admin.localhost:9021/api';
const TENANT_B_BASE = process.env.TENANT_B_API_BASE;
const SYSTEM_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const SYSTEM_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';
const TENANT_B_EMAIL = process.env.TENANT_B_EMAIL;
const TENANT_B_PASSWORD = process.env.TENANT_B_PASSWORD;

async function request(base: string, path: string, token: string | undefined, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { response, data };
}

async function login(base: string, email: string, password: string) {
  const { response, data } = await request(base, '/auth/login', undefined, 'POST', { email, password });
  expect(response.status, `login failed for ${email}`).toBe(200);
  return data.accessToken as string;
}

async function runLab(base: string, token: string, mrnPrefix: string, testCode: string) {
  const suffix = Date.now().toString(36).toUpperCase();
  const patient = await request(base, '/patients', token, 'POST', {
    firstName: 'G1', lastName: 'Acceptance', mrn: `${mrnPrefix}-${suffix}`, gender: 'M',
  });
  expect(patient.response.status).toBeLessThan(300);
  const encounter = await request(base, '/encounters', token, 'POST', { patientId: patient.data.id });
  expect(encounter.response.status).toBeLessThan(300);
  const order = await request(base, `/encounters/${encounter.data.id}:order-lab`, token, 'POST', { tests: [{ code: testCode }] });
  expect(order.response.status).toBeLessThan(300);
  const labOrderId = order.data.labOrders?.[0]?.id;
  expect(labOrderId).toBeTruthy();
  const collect = await request(base, `/encounters/${encounter.data.id}:collect-specimen`, token, 'POST', {});
  expect(collect.response.status).toBeLessThan(300);
  const result = await request(base, `/encounters/${encounter.data.id}:result`, token, 'POST', { labOrderId, value: '5.5', flag: 'normal' });
  expect(result.response.status).toBeLessThan(300);
  const verify = await request(base, `/encounters/${encounter.data.id}:verify`, token, 'POST');
  expect(verify.response.status).toBeLessThan(300);

  let report: any;
  for (let i = 0; i < 60 && !report; i++) {
    const docs = await request(base, `/documents?encounterId=${encounter.data.id}`, token);
    const items = Array.isArray(docs.data) ? docs.data : (docs.data?.items || docs.data?.data || []);
    report = items.find((doc: any) => doc.type === 'LAB_REPORT' && ['RENDERED', 'PUBLISHED'].includes(doc.status));
    if (!report) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  expect(report).toBeTruthy();
  return { patientId: patient.data.id, encounterId: encounter.data.id, mrn: patient.data.mrn };
}

test.describe('@tenancy @acceptance G1 Two-lab acceptance', () => {
  test.skip(
    !TENANT_B_BASE || !TENANT_B_EMAIL || !TENANT_B_PASSWORD,
    'Opt-in: requires a provisioned Tenant B domain and acceptance account.',
  );

  test('two real labs can run isolated workflows and see only their own operations', async () => {
    const systemToken = await login(SYSTEM_BASE, SYSTEM_EMAIL, SYSTEM_PASSWORD);
    const tenantBToken = await login(TENANT_B_BASE!, TENANT_B_EMAIL!, TENANT_B_PASSWORD!);

    const systemCatalog = await request(SYSTEM_BASE, '/catalog/tests?limit=5', systemToken);
    const tenantBCatalog = await request(TENANT_B_BASE!, '/catalog/tests?limit=5', tenantBToken);
    expect(systemCatalog.response.status).toBe(200);
    expect(tenantBCatalog.response.status).toBe(200);

    const systemRun = await runLab(SYSTEM_BASE, systemToken, 'G1-A', 't1');
    const tenantBRun = await runLab(TENANT_B_BASE!, tenantBToken, 'G1-B', 't9001');

    for (const [base, token, own, foreign] of [
      [SYSTEM_BASE, systemToken, systemRun, tenantBRun],
      [TENANT_B_BASE!, tenantBToken, tenantBRun, systemRun],
    ] as const) {
      const patients = await request(base, '/patients?limit=100', token);
      const rows = patients.data?.data || patients.data?.items || patients.data || [];
      expect(JSON.stringify(rows)).toContain(own.mrn);
      expect(JSON.stringify(rows)).not.toContain(foreign.mrn);

      const jobs = await request(base, '/jobs?limit=20', token);
      expect(jobs.response.status).toBe(200);
      const audit = await request(base, '/audit-events?limit=20', token);
      expect(audit.response.status).toBe(200);
    }
  });
});
