/**
 * Vexel Operator — API Client
 * IMPORTANT: Uses @vexel/sdk only. No direct fetch/axios.
 */
import { createApiClient } from '@vexel/sdk';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export function getApiClient(token?: string) {
  return createApiClient({
    baseUrl: `${API_BASE}/api`,
    token,
  });
}
