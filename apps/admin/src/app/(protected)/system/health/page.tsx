'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function SystemHealthPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const api = getApiClient(getToken() ?? undefined);
      const [api_, worker, pdf] = await Promise.all([
        api.GET('/health'),
        api.GET('/health/worker'),
        api.GET('/health/pdf'),
      ]);
      setData({ api: api_.data, worker: worker.data, pdf: pdf.data });
    }
    load();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>System Health</h1>
      {!data ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {Object.entries(data).map(([svc, info]: any) => (
            <div key={svc} style={{
              background: 'white', padding: '20px', borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              <p style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: '8px' }}>{svc}</p>
              <span style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: '12px',
                background: info?.status === 'ok' ? '#dcfce7' : '#fee2e2',
                color: info?.status === 'ok' ? '#166534' : '#991b1b',
                fontSize: '13px',
              }}>
                {info?.status ?? 'unknown'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
