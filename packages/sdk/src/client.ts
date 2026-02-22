import createFetchClient from 'openapi-fetch';
import type { paths } from './generated/api';

export interface ApiClientOptions {
  baseUrl: string;
  token?: string;
  correlationId?: string;
  headers?: Record<string, string>;
}

export type ApiClient = ReturnType<typeof createFetchClient<paths>>;

/**
 * Creates a typed API client bound to the given base URL and bearer token.
 * This is the only sanctioned way for frontends to call the Vexel API.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, token, correlationId, headers: extraHeaders } = options;

  const client = createFetchClient<paths>({
    baseUrl,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
      ...(extraHeaders ?? {}),
    },
  });

  return client;
}
