import { useEffect, useState, useRef } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

// Terminal states — stop polling once all docs reach one of these
const TERMINAL_STATUSES = new Set(['RENDERED', 'PUBLISHED', 'FAILED']);

const BACKOFF_DELAYS = [500, 1000, 2000, 3000]; // ms; last value is the cap

export function useDocumentPolling(encounterId: string | null, docType?: string, intervalMs = 3000) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iterRef  = useRef(0);

  const fetchDocs = async () => {
    if (!encounterId) return;
    const api = getApiClient(getToken() ?? undefined);
    // @ts-ignore
    const res = await api.GET('/documents', { params: { query: { encounterId, ...(docType ? { docType } : {}) } } });
    if (res.data) setDocuments(Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? []);
  };

  const scheduleNext = (id: string) => {
    const delay = BACKOFF_DELAYS[Math.min(iterRef.current, BACKOFF_DELAYS.length - 1)];
    iterRef.current += 1;
    timerRef.current = setTimeout(async () => {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const res = await api.GET('/documents', { params: { query: { encounterId: id, ...(docType ? { docType } : {}) } } });
      if (res.data) {
        const docs = Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? [];
        setDocuments(docs);
        const allTerminal = docs.length > 0 && docs.every((d: any) => TERMINAL_STATUSES.has(d.status));
        if (allTerminal) {
          setPolling(false);
          return;
        }
      }
      scheduleNext(id);
    }, delay);
  };

  const startPolling = (id: string) => {
    iterRef.current = 0;
    setPolling(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleNext(id);
  };

  const stopPolling = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPolling(false);
  };

  useEffect(() => {
    fetchDocs();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  return { documents, polling, startPolling, stopPolling, refetch: fetchDocs };
}
