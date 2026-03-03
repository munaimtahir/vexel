/**
 * timings.ts
 * Step-level latency tracker for performance evidence.
 * Usage: const t = createTimings(); t.mark('patient_create'); ... t.mark('encounter_create'); ... writeTimings(t);
 */
import * as fs from 'fs';
import * as path from 'path';

export interface TimingEntry {
  step: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  warn: boolean;  // > WARN_THRESHOLD_MS
  critical: boolean; // > CRITICAL_THRESHOLD_MS
}

const WARN_THRESHOLD_MS = Number(process.env.E2E_WARN_MS ?? 5000);
const CRITICAL_THRESHOLD_MS = Number(process.env.E2E_CRITICAL_MS ?? 15000);

export function createTimings() {
  const entries: TimingEntry[] = [];
  let lastStart = Date.now();
  let lastStep = '__init__';

  function mark(step: string) {
    const now = Date.now();
    if (lastStep !== '__init__') {
      const durationMs = now - lastStart;
      entries.push({
        step: lastStep,
        startMs: lastStart,
        endMs: now,
        durationMs,
        warn: durationMs > WARN_THRESHOLD_MS,
        critical: durationMs > CRITICAL_THRESHOLD_MS,
      });
    }
    lastStep = step;
    lastStart = now;
  }

  function finish() {
    const now = Date.now();
    if (lastStep !== '__init__') {
      const durationMs = now - lastStart;
      entries.push({
        step: lastStep,
        startMs: lastStart,
        endMs: now,
        durationMs,
        warn: durationMs > WARN_THRESHOLD_MS,
        critical: durationMs > CRITICAL_THRESHOLD_MS,
      });
    }
    return entries;
  }

  function getEntries() { return [...entries]; }

  return { mark, finish, getEntries };
}

export type Timings = ReturnType<typeof createTimings>;

/** Append timing entries to test-results/timings-raw.json (accumulated across test runs). */
export function flushTimings(testTitle: string, entries: TimingEntry[]) {
  const outDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'timings-raw.json');
  let existing: { testTitle: string; entries: TimingEntry[] }[] = [];
  try { existing = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  existing.push({ testTitle, entries });
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
}
