/**
 * global-setup.ts
 * Boot check: waits for the API health endpoint before tests start.
 * Also checks operator and admin URLs are reachable.
 * Writes a preflight report to test-results/preflight.json.
 */
import { request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:9021';
const OPERATOR_BASE = process.env.OPERATOR_BASE || 'http://127.0.0.1:9024';
const ADMIN_BASE = process.env.ADMIN_BASE || 'http://127.0.0.1:9023';
const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkUrl(ctx: Awaited<ReturnType<typeof request.newContext>>, url: string): Promise<{ url: string; ok: boolean; status: number | null; error: string | null }> {
  try {
    const res = await ctx.get(url);
    return { url, ok: res.ok(), status: res.status(), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { url, ok: false, status: null, error: msg };
  }
}

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: API_BASE });

  // ── Wait for API health ──────────────────────────────────────────────────
  let apiOk = false;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await ctx.get('/api/health');
      if (res.ok()) {
        console.log('[global-setup] ✅ API health check passed.');
        apiOk = true;
        break;
      }
    } catch {
      // not ready yet
    }
    console.log(`[global-setup] Waiting for API... (${i}/${MAX_RETRIES})`);
    await sleep(RETRY_DELAY_MS);
  }

  if (!apiOk) {
    await ctx.dispose();
    throw new Error(`[global-setup] API did not become healthy after ${MAX_RETRIES} retries.`);
  }

  // ── Check operator + admin frontends ─────────────────────────────────────
  const operatorCheck = await checkUrl(ctx, OPERATOR_BASE);
  const adminCheck = await checkUrl(ctx, `${ADMIN_BASE}/admin`);

  if (operatorCheck.ok) {
    console.log(`[global-setup] ✅ Operator reachable at ${OPERATOR_BASE} (HTTP ${operatorCheck.status})`);
  } else {
    console.warn(`[global-setup] ⚠️  Operator not reachable at ${OPERATOR_BASE}: ${operatorCheck.error ?? operatorCheck.status}`);
  }

  if (adminCheck.ok) {
    console.log(`[global-setup] ✅ Admin reachable at ${ADMIN_BASE}/admin (HTTP ${adminCheck.status})`);
  } else {
    console.warn(`[global-setup] ⚠️  Admin not reachable at ${ADMIN_BASE}/admin: ${adminCheck.error ?? adminCheck.status}`);
  }

  // ── Write preflight report ────────────────────────────────────────────────
  const outDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const preflight = {
    timestamp: new Date().toISOString(),
    services: {
      api: { url: `${API_BASE}/api/health`, ok: apiOk },
      operator: { url: OPERATOR_BASE, ok: operatorCheck.ok, status: operatorCheck.status },
      admin: { url: `${ADMIN_BASE}/admin`, ok: adminCheck.ok, status: adminCheck.status },
    },
  };
  fs.writeFileSync(path.join(outDir, 'preflight.json'), JSON.stringify(preflight, null, 2));
  console.log('[global-setup] Preflight report written to test-results/preflight.json');

  await ctx.dispose();
}
