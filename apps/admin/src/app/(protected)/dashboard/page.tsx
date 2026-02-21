'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function DashboardPage() {
  const [health, setHealth] = useState<any>(null);
  const [failedCount, setFailedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const api = getApiClient(getToken() ?? undefined);
      const [healthRes, countRes] = await Promise.all([
        api.GET('/health'),
        api.GET('/jobs/failed-count'),
      ]);
      setHealth(healthRes.data);
      setFailedCount(countRes.data?.count ?? null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard title="API Status" value={health?.status ?? '—'} />
        <StatCard title="Failed Jobs" value={failedCount?.toString() ?? '—'} />
        <StatCard title="Uptime" value={health?.uptime ? `${Math.floor(health.uptime)}s` : '—'} />
      </div>
      <section>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Recent Audit Events</h2>
        <p style={{ color: '#64748b' }}>No recent events.</p>
      </section>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={{
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '8px' }}>{title}</p>
      <p style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>{value}</p>
    </div>
  );
}
