'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

interface ActiveStatus {
  active: true;
  session_id: string;
  mode: 'READ_ONLY';
  impersonated_user: { id: string; name: string; role: string | null };
}

interface InactiveStatus {
  active: false;
}

type Status = ActiveStatus | InactiveStatus;

export function ImpersonationBanner() {
  const [status, setStatus] = useState<Status>({ active: false });
  const [stopping, setStopping] = useState(false);

  const loadStatus = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setStatus({ active: false });
      return;
    }
    const api = getApiClient(token);
    const { data } = await api.GET('/admin/impersonation/status');
    setStatus((data as Status) ?? { active: false });
  }, []);

  useEffect(() => {
    loadStatus().catch(() => setStatus({ active: false }));
    const timer = window.setInterval(() => {
      loadStatus().catch(() => setStatus({ active: false }));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  async function stopImpersonation() {
    if (stopping) return;
    setStopping(true);
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/admin/impersonation/stop');
    window.location.reload();
  }

  if (!status.active) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-amber-950">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
        <p className="text-sm font-medium">
          Impersonating: {status.impersonated_user.name} ({status.impersonated_user.role ?? 'user'}) - Read-only mode
        </p>
        <button
          type="button"
          onClick={stopImpersonation}
          disabled={stopping}
          className="rounded-md border border-amber-700 bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {stopping ? 'Stopping...' : 'Stop impersonating'}
        </button>
      </div>
    </div>
  );
}
