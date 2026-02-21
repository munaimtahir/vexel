/**
 * api-client.ts
 * Direct fetch calls for test setup/teardown.
 * Allowed in test helpers (not in app code — see guardrails).
 */

export const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:9021') + '/api';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export async function apiLogin(
  email: string,
  password: string,
  tenantId?: string,
): Promise<LoginResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['x-tenant-id'] = tenantId;

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function apiGet<T = unknown>(
  path: string,
  token: string,
  tenantId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (tenantId) headers['x-tenant-id'] = tenantId;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`GET ${path} failed: ${res.status} ${text}`), { status: res.status });
  }
  return res.json();
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  token: string,
  tenantId?: string,
): Promise<{ data: T; status: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (tenantId) headers['x-tenant-id'] = tenantId;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { data: data as T, status: res.status };
}

export async function apiPostRaw(
  path: string,
  body: unknown,
  token: string,
  tenantId?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (tenantId) headers['x-tenant-id'] = tenantId;

  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
