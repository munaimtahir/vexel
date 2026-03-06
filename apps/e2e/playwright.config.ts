import { defineConfig, devices } from '@playwright/test';

const OPERATOR_BASE = process.env.OPERATOR_BASE || 'http://127.0.0.1:9024';
const ADMIN_BASE = process.env.ADMIN_BASE || 'http://127.0.0.1:9023';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      // Operator project: all specs EXCEPT admin/** subdirectory and legacy flat admin files
      name: 'operator',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: OPERATOR_BASE,
      },
      testIgnore: [
        '**/tests/admin/**',
        '**/02-admin-crud.spec.ts',
        '**/13-admin-account-landing.spec.ts',
      ],
    },
    {
      // Admin project: admin/** subdirectory + legacy flat admin test files
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: ADMIN_BASE,
      },
      testMatch: [
        '**/tests/admin/**/*.spec.ts',
        '**/02-admin-crud.spec.ts',
        '**/13-admin-account-landing.spec.ts',
      ],
    },
  ],

  globalSetup: './helpers/global-setup.ts',
});
