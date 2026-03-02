'use client';
import { useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import Link from 'next/link';
import { DataTable } from '@vexel/ui-system';

type DayPoint = { date: string; label: string; count: number };

type TenantSnapshot = {
  total: number;
  active: number;
  disabled: number;
  events24h: number;
  topActions: Array<{ action: string; count: number }>;
};

export default function DashboardPage() {
  const [health, setHealth] = useState<any>(null);
  const [failedCount, setFailedCount] = useState<number | null>(null);
  const [queueDepth, setQueueDepth] = useState<number | null>(null);
  const [failed24h, setFailed24h] = useState<number | null>(null);
  const [avgApiMs, setAvgApiMs] = useState<number | null>(null);
  const [publishTrend, setPublishTrend] = useState<DayPoint[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [tenantSnapshot, setTenantSnapshot] = useState<TenantSnapshot | null>(null);
  const [domainStats, setDomainStats] = useState<{ patients: number | null; encounters: number | null; documents: number | null }>({
    patients: null,
    encounters: null,
    documents: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const api = getApiClient(getToken() ?? undefined);
      const sampleRoutes: Array<{ path: string; params?: any }> = [
        { path: '/health' },
        { path: '/jobs/failed-count' },
        { path: '/audit-events', params: { query: { limit: 1, page: 1 } } },
      ];

      const sampleDurations = await Promise.all(
        sampleRoutes.map(async (route) => {
          const start = performance.now();
          await api.GET(route.path as any, route.params ? { params: route.params } : {});
          return performance.now() - start;
        }),
      );
      setAvgApiMs(Math.round(sampleDurations.reduce((sum, n) => sum + n, 0) / sampleDurations.length));

      const [
        healthRes,
        countRes,
        auditRes,
        pRes,
        eRes,
        dRes,
        waitingRes,
        activeRes,
        delayedRes,
        failedRes,
        publishAuditRes,
        tenantsRes,
      ] = await Promise.allSettled([
        api.GET('/health'),
        api.GET('/jobs/failed-count'),
        api.GET('/audit-events', { params: { query: { limit: 10, page: 1 } } }),
        api.GET('/patients' as any, { params: { query: { limit: 1, page: 1 } } }),
        api.GET('/encounters' as any, { params: { query: { limit: 1, page: 1 } } }),
        api.GET('/documents' as any, { params: { query: { limit: 1, page: 1 } } }),
        api.GET('/jobs' as any, { params: { query: { page: 1, limit: 1, status: 'waiting' } } }),
        api.GET('/jobs' as any, { params: { query: { page: 1, limit: 1, status: 'active' } } }),
        api.GET('/jobs' as any, { params: { query: { page: 1, limit: 1, status: 'delayed' } } }),
        api.GET('/jobs/failed' as any, { params: { query: { page: 1, limit: 200 } } }),
        api.GET('/audit-events' as any, { params: { query: { page: 1, limit: 200, action: 'document.publish' } } }),
        api.GET('/tenants' as any, {}),
      ]);

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      if (countRes.status === 'fulfilled') setFailedCount((countRes.value.data as any)?.count ?? 0);
      if (auditRes.status === 'fulfilled') setRecentAudit((auditRes.value.data as any)?.data ?? []);

      const waitingTotal = waitingRes.status === 'fulfilled' ? ((waitingRes.value.data as any)?.pagination?.total ?? 0) : 0;
      const activeTotal = activeRes.status === 'fulfilled' ? ((activeRes.value.data as any)?.pagination?.total ?? 0) : 0;
      const delayedTotal = delayedRes.status === 'fulfilled' ? ((delayedRes.value.data as any)?.pagination?.total ?? 0) : 0;
      setQueueDepth(waitingTotal + activeTotal + delayedTotal);

      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const failedRows = failedRes.status === 'fulfilled' ? ((failedRes.value.data as any)?.data ?? []) : [];
      setFailed24h(failedRows.filter((row: any) => new Date(row.createdAt).getTime() >= cutoff).length);

      const publishRows = publishAuditRes.status === 'fulfilled' ? ((publishAuditRes.value.data as any)?.data ?? []) : [];
      setPublishTrend(build7DayTrend(publishRows));

      const tenants = tenantsRes.status === 'fulfilled' ? ((tenantsRes.value.data as any)?.data ?? []) : [];
      const recentRows = auditRes.status === 'fulfilled' ? ((auditRes.value.data as any)?.data ?? []) : [];
      const events24h = recentRows.filter((row: any) => new Date(row.createdAt).getTime() >= cutoff);
      const actionCounts = new Map<string, number>();
      for (const row of events24h) {
        const key = row.action ?? 'unknown';
        actionCounts.set(key, (actionCounts.get(key) ?? 0) + 1);
      }
      setTenantSnapshot({
        total: tenants.length,
        active: tenants.filter((t: any) => String(t.status).toLowerCase() === 'active').length,
        disabled: tenants.filter((t: any) => String(t.status).toLowerCase() !== 'active').length,
        events24h: events24h.length,
        topActions: Array.from(actionCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([action, count]) => ({ action, count })),
      });

      setDomainStats({
        patients: pRes.status === 'fulfilled' ? ((pRes.value.data as any)?.total ?? null) : null,
        encounters: eRes.status === 'fulfilled' ? ((eRes.value.data as any)?.total ?? null) : null,
        documents: dRes.status === 'fulfilled' ? ((dRes.value.data as any)?.total ?? null) : null,
      });
      setLoading(false);
    }
    load();
  }, []);

  const maxTrend = useMemo(() => Math.max(...publishTrend.map((d) => d.count), 1), [publishTrend]);

  if (loading) return <p style={{ padding: '32px' }}>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: 'hsl(var(--foreground))' }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard title="API Status" value={health?.status ?? 'unknown'} ok={health?.status === 'ok'} href="/system/health" />
        <StatCard title="Avg API Response" value={avgApiMs != null ? `${avgApiMs} ms` : '—'} href="/system/health" />
        <StatCard title="Worker Queue Depth" value={queueDepth != null ? String(queueDepth) : '—'} href="/jobs" />
        <StatCard title="Failed Jobs" value={String(failedCount ?? '—')} ok={failedCount === 0} href="/jobs" />
        <StatCard title="Failed Jobs (24h)" value={failed24h != null ? String(failed24h) : '—'} ok={failed24h === 0} href="/jobs" />
        <StatCard title="Uptime" value={health?.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '—'} href="/system/health" />
        <StatCard title="Patients" value={domainStats.patients != null ? String(domainStats.patients) : '—'} href="/patients" />
        <StatCard title="Encounters" value={domainStats.encounters != null ? String(domainStats.encounters) : '—'} href="/encounters" />
        <StatCard title="Documents" value={domainStats.documents != null ? String(domainStats.documents) : '—'} href="/documents" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <section style={{ background: 'hsl(var(--card))', borderRadius: '8px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Publish Trend (7d)</h2>
          <p style={{ margin: '0 0 12px 0', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>
            Derived from `document.publish` audit events.
          </p>
          <div style={{ display: 'flex', alignItems: 'end', gap: '8px', minHeight: '120px' }}>
            {publishTrend.map((point) => (
              <div key={point.date} style={{ flex: 1, minWidth: 0 }}>
                <div
                  title={`${point.count} publish events`}
                  style={{
                    height: `${Math.max(10, Math.round((point.count / maxTrend) * 100))}px`,
                    background: 'hsl(var(--status-info-bg))',
                    border: '1px solid hsl(var(--status-info-border))',
                    borderRadius: '6px 6px 0 0',
                  }}
                />
                <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px', color: 'hsl(var(--muted-foreground))' }}>{point.label}</div>
                <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }}>{point.count}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: 'hsl(var(--card))', borderRadius: '8px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Tenant Activity Snapshot</h2>
          <p style={{ margin: '0 0 12px 0', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>
            Last 24h activity from tenant-scoped audit stream.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <MiniStat label="Tenants" value={tenantSnapshot?.total ?? '—'} />
            <MiniStat label="Active" value={tenantSnapshot?.active ?? '—'} />
            <MiniStat label="Disabled" value={tenantSnapshot?.disabled ?? '—'} />
            <MiniStat label="Events (24h)" value={tenantSnapshot?.events24h ?? '—'} />
          </div>
          <div>
            <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Top Actions</p>
            {tenantSnapshot?.topActions?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {tenantSnapshot.topActions.map((row) => (
                  <div key={row.action} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <code style={{ background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: '4px' }}>{row.action}</code>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>No recent actions.</p>
            )}
          </div>
        </section>
      </div>

      <section style={{ background: 'hsl(var(--card))', borderRadius: '8px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Recent Audit Events</h2>
          <Link href="/audit" style={{ color: 'hsl(var(--primary))', fontSize: '14px', textDecoration: 'none' }}>View all →</Link>
        </div>
        {recentAudit.length === 0 ? (
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px' }}>No audit events yet.</p>
        ) : (
          <DataTable
            data={recentAudit}
            keyExtractor={(event) => event.id}
            columns={[
              {
                key: 'action',
                header: 'Action',
                cell: (event) => (
                  <code style={{ background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: '4px' }}>
                    {event.action}
                  </code>
                ),
              },
              {
                key: 'entity',
                header: 'Entity',
                cell: (event) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {event.entityType ?? '—'} {event.entityId ? `#${event.entityId.slice(0, 8)}` : ''}
                  </span>
                ),
              },
              {
                key: 'actor',
                header: 'Actor',
                cell: (event) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {event.actorUserId ? event.actorUserId.slice(0, 8) : 'system'}
                  </span>
                ),
              },
              {
                key: 'time',
                header: 'Time',
                cell: (event) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}

function build7DayTrend(events: any[]): DayPoint[] {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, 0);
  }
  for (const e of events) {
    const key = String(e.createdAt ?? '').slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([date, count]) => ({
    date,
    count,
    label: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
  }));
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '8px 10px' }}>
      <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))', fontSize: '11px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '18px' }}>{value}</p>
    </div>
  );
}

function StatCard({ title, value, ok, href }: { title: string; value: string; ok?: boolean; href?: string }) {
  const content = (
    <div
      style={{
        background: 'hsl(var(--card))',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-sm)',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      <p style={{ fontSize: '28px', fontWeight: 700, color: ok === false ? 'hsl(var(--status-destructive-fg))' : ok === true ? 'hsl(var(--status-success-fg))' : 'hsl(var(--foreground))' }}>{value}</p>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}
