import { useEffect, useState, useRef } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export function useDocumentPolling(encounterId: string | null, docType?: string, intervalMs = 3000) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocs = async () => {
    if (!encounterId) return;
    const api = getApiClient(getToken() ?? undefined);
    // @ts-ignore
    const res = await api.GET('/documents', { params: { query: { encounterId, ...(docType ? { docType } : {}) } } });
    if (res.data) setDocuments(Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? []);
  };

  const startPolling = (id: string) => {
    setPolling(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const res = await api.GET('/documents', { params: { query: { encounterId: id, ...(docType ? { docType } : {}) } } });
      if (res.data) {
        const docs = Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? [];
        setDocuments(docs);
        const allDone = docs.every((d: any) => d.status === 'PUBLISHED' || d.status === 'FAILED');
        if (allDone && docs.length > 0) {
          clearInterval(timerRef.current!);
          setPolling(false);
        }
      }
    }, intervalMs);
  };

  const stopPolling = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPolling(false);
  };

  useEffect(() => {
    fetchDocs();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  return { documents, polling, startPolling, stopPolling, refetch: fetchDocs };
}
