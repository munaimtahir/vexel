'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function SystemHealthPage() {
  const [data, setData] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    const api = getApiClient(getToken() ?? undefined);
    const [api_, worker, pdf] = await Promise.allSettled([
      api.GET('/health'),
      api.GET('/health/worker'),
      api.GET('/health/pdf'),
    ]);
    setData({
      api: api_.status === 'fulfilled' ? api_.value.data : { status: 'error' },
      worker: worker.status === 'fulfilled' ? worker.value.data : { status: 'error' },
      pdf: pdf.status === 'fulfilled' ? pdf.value.data : { status: 'error' },
    });
    setLastRefresh(new Date());
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const serviceLabels: Record<string, { label: string; description: string }> = {
    api: { label: 'API (NestJS)', description: 'Main REST API server' },
    worker: { label: 'Worker (BullMQ)', description: 'Background job processor' },
    pdf: { label: 'PDF Service (.NET)', description: 'QuestPDF document renderer' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>System Health</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefresh && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Last checked: {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={load} disabled={refreshing} style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>
      {!data ? (
        <p style={{ color: '#94a3b8' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(data).map(([svc, info]: any) => {
            const meta = serviceLabels[svc] ?? { label: svc, description: '' };
            const ok = info?.status === 'ok';
            return (
              <div key={svc} style={{ background: 'white', padding: '20px 24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{meta.label}</span>
                    <span style={{ padding: '2px 10px', borderRadius: '12px', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                      {info?.status ?? 'unknown'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{meta.description}</p>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    {info?.version && <Detail label="Version" value={info.version} />}
                    {info?.uptime != null && <Detail label="Uptime" value={`${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m ${Math.floor(info.uptime % 60)}s`} />}
                    {info?.db && <Detail label="Database" value={info.db} ok={info.db === 'ok'} />}
                    {info?.redis && <Detail label="Redis" value={info.redis} ok={info.redis === 'ok'} />}
                    {info?.queue && <Detail label="Queue" value={info.queue} ok={info.queue === 'ok'} />}
                    {info?.minio && <Detail label="MinIO" value={info.minio} ok={info.minio === 'ok'} />}
                    {info?.memory && <Detail label="Memory RSS" value={`${Math.round(info.memory.rss / 1024 / 1024)} MB`} />}
                  </div>
                  {info?.error && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626', background: '#fee2e2', padding: '6px 10px', borderRadius: '4px' }}>
                      {info.error}
                    </div>
                  )}
                </div>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', flexShrink: 0, marginTop: '4px' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: ok === true ? '#166534' : ok === false ? '#991b1b' : '#374151' }}>{value}</div>
    </div>
  );
}
