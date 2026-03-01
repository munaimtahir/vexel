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
 *
 * Content-Type handling is delegated entirely to openapi-fetch (v0.13.8+):
 * - FormData bodies: openapi-fetch detects FormData and omits Content-Type so
 *   the browser auto-sets `multipart/form-data; boundary=...`.
 * - JSON bodies: openapi-fetch sets Content-Type: application/json automatically.
 *
 * NOTE: A custom fetch wrapper must NOT be used here. openapi-fetch passes the
 * full Request object as the first arg to the underlying fetch(), so checking
 * `init?.body instanceof FormData` in a wrapper would always see `init` as
 * undefined and incorrectly force Content-Type: application/json on file uploads,
 * causing NestJS to reject multipart data with a JSON parse error.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, token, correlationId, headers: extraHeaders } = options;

  const defaultHeaders: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    ...(extraHeaders ?? {}),
  };

  return createFetchClient<paths>({
    baseUrl,
    headers: defaultHeaders,
  });
}
