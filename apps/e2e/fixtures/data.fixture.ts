/**
 * data.fixture.ts
 * Test data factories: patient, encounter, lab order.
 * Uses the API directly so tests start from a known state.
 */

import { test as base } from '@playwright/test';
import { apiLogin, apiPost } from '../helpers/api-client';

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

export interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  [key: string]: unknown;
}

export interface EncounterData {
  id: string;
  status: string;
  patientId: string;
  [key: string]: unknown;
}

export interface DataFixtures {
  /** Creates and returns a fresh E2E test patient */
  e2ePatient: PatientData;
  /** Creates and returns a fresh encounter for the e2ePatient */
  e2eEncounter: EncounterData;
}

/** Unique suffix to avoid MRN collisions between parallel runs */
function uid() {
  return Date.now().toString(36).toUpperCase();
}

export const test = base.extend<DataFixtures>({
  e2ePatient: async ({}, use) => {
    const { accessToken } = await apiLogin(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    const mrn = `E2E-${uid()}`;
    const { data, status } = await apiPost<PatientData>(
      '/patients',
      {
        firstName: 'E2E Test',
        lastName: 'Patient',
        mrn,
        phone: '03001234567',
        gender: 'M',
      },
      accessToken,
    );
    if (status !== 201 && status !== 200) {
      throw new Error(`Failed to create e2ePatient: HTTP ${status}`);
    }
    await use(data);
  },

  e2eEncounter: async ({ e2ePatient }, use) => {
    const { accessToken } = await apiLogin(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    const { data, status } = await apiPost<EncounterData>(
      '/encounters',
      { patientId: e2ePatient.id },
      accessToken,
    );
    if (status !== 201 && status !== 200) {
      throw new Error(`Failed to create e2eEncounter: HTTP ${status}`);
    }
    await use(data);
  },
});

export { expect } from '@playwright/test';
