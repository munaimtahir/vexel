import { defineConfig, devices } from '@playwright/test';

const OPERATOR_BASE = process.env.OPERATOR_BASE || 'http://127.0.0.1:9024';
const ADMIN_BASE = process.env.ADMIN_BASE || 'http://127.0.0.1:9023';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'operator',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: OPERATOR_BASE,
      },
      testMatch: [
        '**/01-auth.spec.ts',
        '**/03-operator-patient.spec.ts',
        '**/04-operator-encounter.spec.ts',
        '**/05-operator-workflow.spec.ts',
        '**/06-document-pipeline.spec.ts',
        '**/07-tenant-isolation.spec.ts',
      ],
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: ADMIN_BASE,
      },
      testMatch: ['**/02-admin-crud.spec.ts'],
    },
  ],

  globalSetup: './helpers/global-setup.ts',
});
