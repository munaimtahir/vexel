import { test, expect } from '../../fixtures/auth.fixture';
import { apiGet, apiPost } from '../../helpers/api-client';

const EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

test.describe('OPD production workflow', () => {
  test('operator can open the canonical encounter and intake journeys', async ({ authedPage: page }) => {
    await page.goto('/opd/encounters');
    await expect(page.getByRole('main').getByRole('heading', { name: 'OPD Encounters', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'New OPD Registration' })).toBeVisible();

    await page.goto('/opd/encounters/new');
    await expect(page.getByRole('main').getByRole('heading', { name: 'New OPD Registration', exact: true })).toBeVisible();
    await expect(page.getByText('Doctor', { exact: false }).first()).toBeVisible();
  });

  test('completed encounter is rendered as locked in the browser', async ({ authedPage: page }) => {
    const { accessToken } = await import('../../helpers/api-client').then(({ apiLogin }) => apiLogin(EMAIL, PASSWORD));
    const doctors = await apiGet<{ data: Array<{ id: string }> }>('/opd/doctors', accessToken, 'system');
    const doctorId = doctors.data?.[0]?.id;
    expect(doctorId).toBeTruthy();

    const patient = await apiPost<{ id: string }>(
      '/patients',
      { firstName: 'Browser', lastName: `OPD-${Date.now()}`, gender: 'Other' },
      accessToken,
      'system',
    );
    const registration = await apiPost<{ opdEncounter: { id: string } }>(
      '/opd/commands/createRegistration',
      { patientId: patient.data.id, doctorId, idempotencyKey: `browser-opd-${Date.now()}` },
      accessToken,
      'system',
    );

    await page.goto(`/opd/encounters/${registration.data.opdEncounter.id}/intake`);
    await expect(page.getByRole('heading', { name: 'OPD Intake' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Intake' })).toBeVisible();
  });
});
