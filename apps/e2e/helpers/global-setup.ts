/**
 * global-setup.ts
 * Boot check: waits for the API health endpoint before tests start.
 */
import { request } from '@playwright/test';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:9021';
const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: API_BASE });

  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await ctx.get('/api/health');
      if (res.ok()) {
        console.log('[global-setup] API health check passed.');
        await ctx.dispose();
        return;
      }
    } catch {
      // not ready yet
    }
    console.log(`[global-setup] Waiting for API... (${i}/${MAX_RETRIES})`);
    await sleep(RETRY_DELAY_MS);
  }

  await ctx.dispose();
  throw new Error(`[global-setup] API did not become healthy after ${MAX_RETRIES} retries.`);
}
