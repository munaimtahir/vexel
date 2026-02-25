'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entityType: '', actorUserId: '', page: 1 });
  const [detailEvent, setDetailEvent] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/audit-events', {
      params: {
        query: {
          page: filters.page,
          limit: 20,
          ...(filters.action && { action: filters.action }),
          ...(filters.entityType && { entityType: filters.entityType }),
          ...(filters.actorUserId && { actorUserId: filters.actorUserId }),
        } as any,
      },
    });
    setEvents(data?.data ?? []);
    setPagination(data?.pagination ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filters]);

  return (
    <div>
      {/* Detail Modal */}
      {detailEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'hsl(var(--card))', borderRadius: '10px', maxWidth: '640px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Audit Event Detail</h2>
              <button onClick={() => setDetailEvent(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>×</button>
            </div>
            <div style={{ padding: '16px 20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Row label="ID" value={detailEvent.id} mono />
              <Row label="Action" value={detailEvent.action} mono badge="hsl(var(--status-info-bg))" badgeText="hsl(var(--primary))" />
              <Row label="Entity Type" value={detailEvent.entityType ?? '—'} />
              <Row label="Entity ID" value={detailEvent.entityId ?? '—'} mono />
              <Row label="Actor User ID" value={detailEvent.actorUserId ?? 'system'} mono />
              <Row label="Tenant ID" value={detailEvent.tenantId ?? '—'} mono />
              <Row label="Correlation ID" value={detailEvent.correlationId ?? '—'} mono />
              <Row label="Time" value={new Date(detailEvent.createdAt).toLocaleString()} />
              {detailEvent.before != null && (
                <div>
                  <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Before</div>
                  <pre style={{ fontSize: '11px', background: 'hsl(var(--status-warning-bg))', padding: '10px', borderRadius: '6px', overflow: 'auto', maxHeight: '200px', margin: 0, color: 'hsl(var(--status-warning-fg))' }}>
                    {JSON.stringify(detailEvent.before, null, 2)}
                  </pre>
                </div>
              )}
              {detailEvent.after != null && (
                <div>
                  <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>After</div>
                  <pre style={{ fontSize: '11px', background: 'hsl(var(--status-success-bg))', padding: '10px', borderRadius: '6px', overflow: 'auto', maxHeight: '200px', margin: 0, color: 'hsl(var(--status-success-fg))' }}>
                    {JSON.stringify(detailEvent.after, null, 2)}
                  </pre>
                </div>
              )}
              {detailEvent.metadata != null && (
                <div>
                  <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Metadata</div>
                  <pre style={{ fontSize: '11px', background: 'hsl(var(--muted))', padding: '10px', borderRadius: '6px', overflow: 'auto', maxHeight: '200px', margin: 0 }}>
                    {JSON.stringify(detailEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: 'hsl(var(--foreground))' }}>Audit Log</h1>

      <div style={{ background: 'hsl(var(--card))', padding: '16px 20px', borderRadius: '8px', marginBottom: '16px', boxShadow: 'var(--shadow-sm)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            style={{ padding: '6px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', minWidth: '200px' }}
          >
            <option value="">All actions</option>
            <optgroup label="Auth">
              <option value="auth.login">auth.login</option>
              <option value="auth.logout">auth.logout</option>
              <option value="auth.token_refresh">auth.token_refresh</option>
            </optgroup>
            <optgroup label="Users & Roles">
              <option value="user.create">user.create</option>
              <option value="user.update">user.update</option>
              <option value="user.enable">user.enable</option>
              <option value="user.disable">user.disable</option>
              <option value="role.assign">role.assign</option>
              <option value="role.create">role.create</option>
              <option value="role.update">role.update</option>
              <option value="role.delete">role.delete</option>
            </optgroup>
            <optgroup label="Tenants & Config">
              <option value="tenant.create">tenant.create</option>
              <option value="tenant.update">tenant.update</option>
              <option value="tenant.enable">tenant.enable</option>
              <option value="tenant.disable">tenant.disable</option>
              <option value="feature_flag.set">feature_flag.set</option>
              <option value="branding.update">branding.update</option>
            </optgroup>
            <optgroup label="Encounters">
              <option value="encounter.register">encounter.register</option>
              <option value="encounter.order-lab">encounter.order-lab</option>
              <option value="encounter.sample-collect">encounter.sample-collect</option>
              <option value="encounter.result">encounter.result</option>
              <option value="encounter.lab-verify">encounter.lab-verify</option>
              <option value="encounter.cancel">encounter.cancel</option>
            </optgroup>
            <optgroup label="Documents">
              <option value="document.generate">document.generate</option>
              <option value="document.publish">document.publish</option>
              <option value="document.rendered">document.rendered</option>
              <option value="document.render_failed">document.render_failed</option>
            </optgroup>
            <optgroup label="Catalog">
              <option value="catalog.import">catalog.import</option>
              <option value="catalog.export">catalog.export</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Entity Type</label>
          <select
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })}
            style={{ padding: '6px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', minWidth: '160px' }}
          >
            <option value="">All types</option>
            <option value="User">User</option>
            <option value="Role">Role</option>
            <option value="Tenant">Tenant</option>
            <option value="Patient">Patient</option>
            <option value="Encounter">Encounter</option>
            <option value="Document">Document</option>
            <option value="CatalogTest">CatalogTest</option>
            <option value="CatalogParameter">CatalogParameter</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Actor User ID</label>
          <input
            value={filters.actorUserId}
            onChange={(e) => setFilters({ ...filters, actorUserId: e.target.value, page: 1 })}
            placeholder="UUID prefix…"
            style={{ padding: '6px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', width: '160px' }}
          />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={() => setFilters({ action: '', entityType: '', actorUserId: '', page: 1 })}
            style={{ padding: '6px 12px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: 'hsl(var(--background))' }}>
            <tr>
              {['Action', 'Entity', 'Actor', 'Correlation ID', 'Time', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading...</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>No audit events found.</td></tr>
            ) : events.map((e: any) => (
              <tr key={e.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
                <td style={{ padding: '10px 16px' }}><code style={{ background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--primary))', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{e.action}</code></td>
                <td style={{ padding: '10px 16px', color: 'hsl(var(--muted-foreground))' }}>{e.entityType ?? '—'}{e.entityId ? ` (${e.entityId.slice(0, 8)}…)` : ''}</td>
                <td style={{ padding: '10px 16px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '11px' }}>{e.actorUserId ? e.actorUserId.slice(0, 12) : 'system'}</td>
                <td style={{ padding: '10px 16px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '11px' }}>{e.correlationId?.slice(0, 12) ?? '—'}</td>
                <td style={{ padding: '10px 16px', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString()}</td>
                <td style={{ padding: '10px 16px' }}>
                  <button onClick={() => setDetailEvent(e)} style={{ padding: '3px 8px', fontSize: '11px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>Detail</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && pagination.totalPages > 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--muted))', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
            <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                style={{ padding: '4px 12px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer', background: 'hsl(var(--card))' }}>← Prev</button>
              <button disabled={filters.page >= pagination.totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                style={{ padding: '4px 12px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer', background: 'hsl(var(--card))' }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, badge, badgeText }: { label: string; value: string; mono?: boolean; badge?: string; badgeText?: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ width: '120px', flexShrink: 0, color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', paddingTop: '2px' }}>{label}</span>
      {badge ? (
        <code style={{ background: badge, color: badgeText, padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{value}</code>
      ) : (
        <span style={{ fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? '12px' : '13px' }}>{value}</span>
      )}
    </div>
  );
}
