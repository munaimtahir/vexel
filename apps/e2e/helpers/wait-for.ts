/**
 * wait-for.ts
 * Polling helpers for async status transitions.
 */

import { apiGet } from './api-client';

export async function waitForStatus(
  path: string,
  token: string,
  targetStatus: string,
  options: { maxPolls?: number; delayMs?: number; statusField?: string } = {},
): Promise<unknown> {
  const { maxPolls = 10, delayMs = 2000, statusField = 'status' } = options;

  for (let i = 0; i < maxPolls; i++) {
    const data = await apiGet<Record<string, unknown>>(path, token);
    if (data[statusField] === targetStatus) return data;
    await sleep(delayMs);
  }
  throw new Error(`Timeout: ${path} did not reach status "${targetStatus}" after ${maxPolls} polls`);
}

export async function waitForDocumentRendered(
  documentId: string,
  token: string,
  options: { maxPolls?: number; delayMs?: number } = {},
): Promise<unknown> {
  return waitForStatus(`/documents/${documentId}`, token, 'RENDERED', options);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
