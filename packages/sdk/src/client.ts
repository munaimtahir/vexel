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
 * Content-Type handling:
 * - FormData bodies: Content-Type is intentionally omitted so the browser
 *   auto-sets `multipart/form-data; boundary=...`. Forcing application/json
 *   would cause NestJS's JSON body-parser to receive multipart bytes → parse error.
 * - All other bodies: Content-Type: application/json is set explicitly.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, token, correlationId, headers: extraHeaders } = options;

  const defaultHeaders: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    ...(extraHeaders ?? {}),
  };

  const client = createFetchClient<paths>({
    baseUrl,
    headers: defaultHeaders,
    // Custom fetch wrapper: set Content-Type: application/json for non-FormData
    // requests only. For FormData, let the browser set the multipart boundary.
    fetch: (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const isFormData = init?.body instanceof FormData;
      if (!isFormData) {
        const headers = new Headers(init?.headers);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        return fetch(url, { ...init, headers });
      }
      // FormData: remove any Content-Type so browser sets multipart+boundary
      const headers = new Headers(init?.headers);
      headers.delete('Content-Type');
      return fetch(url, { ...init, headers });
    },
  });

  return client;
}
