/**
 * tenant.fixture.ts
 * Tenant context helpers for multi-tenant test scenarios.
 * In dev, tenant is resolved via x-tenant-id header (see TENANCY.md).
 */

import { test as base } from '@playwright/test';

export interface TenantFixtures {
  /** The system/default tenant ID resolved at test startup */
  systemTenantId: string;
}

export const SYSTEM_TENANT_SLUG = process.env.SYSTEM_TENANT_ID || 'system';

export const test = base.extend<TenantFixtures>({
  systemTenantId: async ({}, use) => {
    // In dev mode the API accepts x-tenant-id header to identify tenant.
    // For UI tests the operator app is pre-configured to send this header.
    // For direct API calls use SYSTEM_TENANT_SLUG as the header value.
    await use(SYSTEM_TENANT_SLUG);
  },
});

export { expect } from '@playwright/test';
