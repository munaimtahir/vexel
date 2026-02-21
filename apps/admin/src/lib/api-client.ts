/**
 * Vexel Admin — API Client
 *
 * IMPORTANT: This is the ONLY place in the admin app where the API is called.
 * Uses @vexel/sdk only. No direct fetch/axios to backend endpoints.
 */
import { createApiClient } from '@vexel/sdk';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export function getApiClient(token?: string) {
  return createApiClient({
    baseUrl: `${API_BASE}/api`,
    token,
  });
}

// Server-side client (uses token from cookie/session)
export function getServerApiClient(token?: string) {
  return getApiClient(token);
}
