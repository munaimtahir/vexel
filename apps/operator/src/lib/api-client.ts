/**
 * Vexel Operator — API Client
 * IMPORTANT: Uses @vexel/sdk only. No direct fetch/axios.
 */
import { createApiClient } from '@vexel/sdk';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEV_TENANT_ID = process.env.NEXT_PUBLIC_DEV_TENANT_ID;
const DEV_HEADER_ENABLED = process.env.NEXT_PUBLIC_TENANCY_DEV_HEADER_ENABLED === 'true';

export function getApiClient(token?: string, correlationId?: string) {
  const extraHeaders: Record<string, string> = {};
  if (DEV_HEADER_ENABLED && DEV_TENANT_ID) {
    extraHeaders['x-tenant-id'] = DEV_TENANT_ID;
  }
  return createApiClient({
    baseUrl: `${API_BASE}/api`,
    token,
    correlationId: correlationId ?? genId(),
    headers: extraHeaders,
  });
}
