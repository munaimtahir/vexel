'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export interface ResolvedFlags {
  'lims.verification.enabled'?: boolean;
  'lims.verification.mode'?: { mode: 'separate' | 'inline' | 'disabled' };
  'lims.operator.verificationPages.enabled'?: boolean;
  'lims.operator.sample.receiveSeparate.enabled'?: boolean;
  'lims.operator.barcode.enabled'?: boolean;
  [key: string]: unknown;
}

const DEFAULTS: ResolvedFlags = {
  'lims.verification.enabled': true,
  'lims.verification.mode': { mode: 'separate' },
  'lims.operator.verificationPages.enabled': true,
  'lims.operator.sample.receiveSeparate.enabled': false,
  'lims.operator.barcode.enabled': false,
};

let _cache: ResolvedFlags | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds — ensures admin flag changes are reflected quickly

async function fetchFlags(): Promise<ResolvedFlags> {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;
  try {
    const api = getApiClient(getToken() ?? undefined);
    // @ts-ignore — path exists after SDK regen
    const { data, error } = await api.GET('/feature-flags/resolved');
    if (!error && data) {
      _cache = { ...DEFAULTS, ...(data as ResolvedFlags) };
      _cacheTime = Date.now();
      return _cache;
    }
  } catch { /* network error — use defaults */ }
  return DEFAULTS;
}

/** Force-clear the flags cache on next fetch (call after updating flags in admin) */
export function invalidateFlagsCache() {
  _cache = null;
  _cacheTime = 0;
}

export function useFeatureFlags(): { flags: ResolvedFlags; loading: boolean } {
  const [flags, setFlags] = useState<ResolvedFlags>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlags().then((f) => {
      setFlags(f);
      setLoading(false);
    });
  }, []);

  return { flags, loading };
}

/** Synchronous read after first load — safe after useFeatureFlags() has been called */
export function getVerificationMode(flags: ResolvedFlags): 'separate' | 'inline' | 'disabled' {
  const enabled = flags['lims.verification.enabled'] ?? true;
  if (!enabled) return 'disabled';
  return (flags['lims.verification.mode'] as any)?.mode ?? 'separate';
}

export function isVerificationVisible(flags: ResolvedFlags): boolean {
  const mode = getVerificationMode(flags);
  return mode !== 'disabled' && (flags['lims.operator.verificationPages.enabled'] ?? true);
}

export function showSubmitAndVerify(flags: ResolvedFlags): boolean {
  const mode = getVerificationMode(flags);
  return mode === 'inline' || mode === 'disabled';
}

export function showSubmitOnly(flags: ResolvedFlags): boolean {
  const mode = getVerificationMode(flags);
  return mode === 'separate' || mode === 'inline';
}

export function isReceiveSeparate(flags: ResolvedFlags): boolean {
  return flags['lims.operator.sample.receiveSeparate.enabled'] ?? false;
}

export function isBarcodeEnabled(flags: ResolvedFlags): boolean {
  return flags['lims.operator.barcode.enabled'] ?? false;
}
