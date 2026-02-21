/**
 * @vexel/sdk — Generated API client
 *
 * IMPORTANT: This package is the ONLY way frontends should call the API.
 * No direct fetch/axios calls to backend endpoints are allowed.
 *
 * Usage:
 *   import { createApiClient } from '@vexel/sdk';
 *   const api = createApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL, token: '...' });
 *   const { data } = await api.GET('/health');
 */

export { createApiClient, type ApiClient } from './client';
export type { paths, components, operations } from './generated/api';
