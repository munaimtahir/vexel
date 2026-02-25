'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import Link from 'next/link';

export default function DashboardPage() {
  const [health, setHealth] = useState<any>(null);
  const [failedCount, setFailedCount] = useState<number | null>(null);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [domainStats, setDomainStats] = useState<{ patients: number | null; encounters: number | null; documents: number | null }>({ patients: null, encounters: null, documents: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const api = getApiClient(getToken() ?? undefined);
      const [healthRes, countRes, auditRes, pRes, eRes, dRes] = await Promise.allSettled([
        api.GET('/health'),
        api.GET('/jobs/failed-count'),
        api.GET('/audit-events', { params: { query: { limit: 10, page: 1 } } }),
        api.GET('/patients' as any, { params: { query: { limit: 1, page: 1 } } }),
        api.GET('/encounters' as any, { params: { query: { limit: 1, page: 1 } } }),
        api.GET('/documents' as any, { params: { query: { limit: 1, page: 1 } } }),
      ]);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      if (countRes.status === 'fulfilled') setFailedCount(countRes.value.data?.count ?? 0);
      if (auditRes.status === 'fulfilled') setRecentAudit(auditRes.value.data?.data ?? []);
      setDomainStats({
        patients: pRes.status === 'fulfilled' ? ((pRes.value.data as any)?.total ?? null) : null,
        encounters: eRes.status === 'fulfilled' ? ((eRes.value.data as any)?.total ?? null) : null,
        documents: dRes.status === 'fulfilled' ? ((dRes.value.data as any)?.total ?? null) : null,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p style={{ padding: '32px' }}>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: 'hsl(var(--foreground))' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard title="API Status" value={health?.status ?? 'unknown'} ok={health?.status === 'ok'} href="/system/health" />
        <StatCard title="Failed Jobs" value={String(failedCount ?? '—')} ok={failedCount === 0} href="/jobs" />
        <StatCard title="Uptime" value={health?.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '—'} href="/system/health" />
        <StatCard title="Patients" value={domainStats.patients != null ? String(domainStats.patients) : '—'} href="/patients" />
        <StatCard title="Encounters" value={domainStats.encounters != null ? String(domainStats.encounters) : '—'} href="/encounters" />
        <StatCard title="Documents" value={domainStats.documents != null ? String(domainStats.documents) : '—'} href="/documents" />
      </div>
      <section style={{ background: 'hsl(var(--card))', borderRadius: '8px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Recent Audit Events</h2>
          <Link href="/audit" style={{ color: 'hsl(var(--primary))', fontSize: '14px', textDecoration: 'none' }}>View all →</Link>
        </div>
        {recentAudit.length === 0 ? (
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px' }}>No audit events yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: 'hsl(var(--muted-foreground))' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'hsl(var(--muted-foreground))' }}>Entity</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'hsl(var(--muted-foreground))' }}>Actor</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'hsl(var(--muted-foreground))' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: '1px solid hsl(var(--muted))' }}>
                  <td style={{ padding: '8px' }}><code style={{ background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: '4px' }}>{e.action}</code></td>
                  <td style={{ padding: '8px', color: 'hsl(var(--muted-foreground))' }}>{e.entityType ?? '—'} {e.entityId ? `#${e.entityId.slice(0, 8)}` : ''}</td>
                  <td style={{ padding: '8px', color: 'hsl(var(--muted-foreground))' }}>{e.actorUserId ? e.actorUserId.slice(0, 8) : 'system'}</td>
                  <td style={{ padding: '8px', color: 'hsl(var(--muted-foreground))' }}>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ title, value, ok, href }: { title: string; value: string; ok?: boolean; href?: string }) {
  const content = (
    <div style={{
      background: 'hsl(var(--card))', padding: '20px', borderRadius: '8px',
      boxShadow: 'var(--shadow-sm)', cursor: href ? 'pointer' : 'default',
    }}>
      <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      <p style={{ fontSize: '28px', fontWeight: 700, color: ok === false ? 'hsl(var(--status-destructive-fg))' : ok === true ? 'hsl(var(--status-success-fg))' : 'hsl(var(--foreground))' }}>{value}</p>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}
