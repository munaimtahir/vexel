/**
 * auth.fixture.ts
 * Login helper. Returns a Page pre-authenticated via localStorage token injection.
 * Uses Playwright storageState to persist auth between tests within a project.
 */

import { test as base, Page, BrowserContext } from '@playwright/test';
import { apiLogin } from '../helpers/api-client';

export interface AuthFixtures {
  /** Operator page pre-logged-in as admin@vexel.system */
  authedPage: Page;
  /** Admin page pre-logged-in as admin@vexel.system */
  authedAdminPage: Page;
  /** Raw access token for direct API calls */
  accessToken: string;
}

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'admin@vexel.system';
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD || 'Admin@vexel123!';

/**
 * Injects accessToken + refreshToken into localStorage so the Next.js app
 * considers the user logged in without going through the login UI.
 */
async function injectTokens(
  context: BrowserContext,
  baseURL: string,
  accessToken: string,
  refreshToken: string,
) {
  // Navigate to a blank page on the same origin to set localStorage
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ({ at, rt }) => {
      localStorage.setItem('accessToken', at);
      localStorage.setItem('refreshToken', rt);
    },
    { at: accessToken, rt: refreshToken },
  );
  await page.close();
}

export const test = base.extend<AuthFixtures>({
  accessToken: async ({ browserName }, use) => {
    const { accessToken } = await apiLogin(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await use(accessToken);
  },

  authedPage: async ({ page, context, baseURL }, use) => {
    const { accessToken, refreshToken } = await apiLogin(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await injectTokens(context, baseURL!, accessToken, refreshToken);
    await use(page);
  },

  authedAdminPage: async ({ page, context, baseURL }, use) => {
    const { accessToken, refreshToken } = await apiLogin(OPERATOR_EMAIL, OPERATOR_PASSWORD);
    await injectTokens(context, baseURL!, accessToken, refreshToken);
    await use(page);
  },
});

export { expect } from '@playwright/test';
