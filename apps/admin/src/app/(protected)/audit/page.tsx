'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { DataTable } from '@vexel/ui-system';

type DiffRow = { key: string; before: string; after: string; kind: 'changed' | 'added' | 'removed' };

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entityType: '', actorUserId: '', correlationId: '', page: 1 });
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [groupByCorrelation, setGroupByCorrelation] = useState(false);

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
          ...(filters.correlationId && { correlationId: filters.correlationId }),
        } as any,
      },
    });
    setEvents((data as any)?.data ?? []);
    setPagination((data as any)?.pagination ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filters]);

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const event of events) {
      const key = event.correlationId || 'uncorrelated';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return Array.from(map.entries())
      .map(([correlationId, rows]) => ({
        correlationId,
        count: rows.length,
        latestAt: rows.reduce((max, row) => (row.createdAt > max ? row.createdAt : max), rows[0]?.createdAt ?? ''),
        actions: Array.from(new Set(rows.map((r) => r.action))).slice(0, 3),
        events: rows,
      }))
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  }, [events]);

  const diffRows = useMemo<DiffRow[]>(() => {
    if (!detailEvent) return [];
    return buildDiffRows(detailEvent.before, detailEvent.after);
  }, [detailEvent]);

  return (
    <div>
      {detailEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'hsl(var(--card))', borderRadius: '10px', maxWidth: '760px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
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
              {entityHref(detailEvent) ? (
                <div style={{ marginTop: '2px' }}>
                  <span style={{ marginRight: '8px', fontSize: '11px', color: 'hsl(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase' }}>Entity</span>
                  <Link href={entityHref(detailEvent)!} style={{ color: 'hsl(var(--primary))', fontSize: '13px', textDecoration: 'none' }}>Open in Admin →</Link>
                </div>
              ) : null}

              <div style={{ marginTop: '6px' }}>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Before/After Diff
                </div>
                {diffRows.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', margin: 0 }}>No before/after delta captured for this event.</p>
                ) : (
                  <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px', overflow: 'hidden' }}>
                    {diffRows.map((row) => (
                      <div
                        key={row.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(160px, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                          gap: '8px',
                          padding: '8px 10px',
                          borderBottom: '1px solid hsl(var(--muted))',
                          background:
                            row.kind === 'changed'
                              ? 'hsl(var(--status-warning-bg))'
                              : row.kind === 'added'
                                ? 'hsl(var(--status-success-bg))'
                                : 'hsl(var(--status-destructive-bg))',
                        }}
                      >
                        <code style={{ fontSize: '11px', alignSelf: 'center' }}>{row.key}</code>
                        <code style={{ fontSize: '11px', whiteSpace: 'pre-wrap', color: 'hsl(var(--muted-foreground))' }}>{row.before}</code>
                        <code style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>{row.after}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Correlation ID</label>
          <input
            value={filters.correlationId}
            onChange={(e) => setFilters({ ...filters, correlationId: e.target.value, page: 1 })}
            placeholder="correlation ID…"
            style={{ padding: '6px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', width: '200px' }}
          />
        </div>
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setGroupByCorrelation((v) => !v)}
            style={{ padding: '6px 12px', background: groupByCorrelation ? 'hsl(var(--status-info-bg))' : 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            {groupByCorrelation ? 'Grouped by Correlation' : 'Flat Events'}
          </button>
          <button
            onClick={() => setFilters({ action: '', entityType: '', actorUserId: '', correlationId: '', page: 1 })}
            style={{ padding: '6px 12px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {groupByCorrelation ? (
          <DataTable
            data={groups}
            loading={loading}
            emptyMessage="No correlation groups found."
            keyExtractor={(g) => g.correlationId}
            columns={[
              {
                key: 'correlation',
                header: 'Correlation ID',
                cell: (group) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '11px' }}>
                    {group.correlationId === 'uncorrelated' ? 'uncorrelated' : group.correlationId}
                  </span>
                ),
              },
              {
                key: 'count',
                header: 'Events',
                cell: (group) => <strong>{group.count}</strong>,
              },
              {
                key: 'actions',
                header: 'Actions',
                cell: (group) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{group.actions.join(', ')}</span>
                ),
              },
              {
                key: 'latest',
                header: 'Latest',
                cell: (group) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>{new Date(group.latestAt).toLocaleString()}</span>
                ),
              },
              {
                key: 'actionsBtn',
                header: '',
                cell: (group) => (
                  <button
                    onClick={() => setDetailEvent(group.events[0])}
                    style={{ padding: '3px 8px', fontSize: '11px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Open Latest
                  </button>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            data={events}
            loading={loading}
            emptyMessage="No audit events found."
            keyExtractor={(event) => event.id}
            columns={[
              {
                key: 'action',
                header: 'Action',
                cell: (event) => (
                  <code style={{ background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--primary))', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                    {event.action}
                  </code>
                ),
              },
              {
                key: 'entity',
                header: 'Entity',
                cell: (event) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {event.entityType ?? '—'}
                    {event.entityId ? ` (${event.entityId.slice(0, 8)}…)` : ''}
                  </span>
                ),
              },
              {
                key: 'actor',
                header: 'Actor',
                cell: (event) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '11px' }}>
                    {event.actorUserId ? event.actorUserId.slice(0, 12) : 'system'}
                  </span>
                ),
              },
              {
                key: 'correlation',
                header: 'Correlation ID',
                cell: (event) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '11px' }}>
                    {event.correlationId?.slice(0, 12) ?? '—'}
                  </span>
                ),
              },
              {
                key: 'time',
                header: 'Time',
                cell: (event) => (
                  <span style={{ color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'entityNav',
                header: 'Entity',
                cell: (event) => {
                  const href = entityHref(event);
                  return href ? (
                    <Link href={href} style={{ color: 'hsl(var(--primary))', textDecoration: 'none', fontSize: '12px' }}>Go</Link>
                  ) : (
                    <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>—</span>
                  );
                },
              },
              {
                key: 'details',
                header: '',
                cell: (event) => (
                  <button onClick={() => setDetailEvent(event)} style={{ padding: '3px 8px', fontSize: '11px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>
                    Detail
                  </button>
                ),
              },
            ]}
          />
        )}

        {pagination && pagination.totalPages > 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--muted))', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
            <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                style={{ padding: '4px 12px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer', background: 'hsl(var(--card))' }}
              >
                ← Prev
              </button>
              <button
                disabled={filters.page >= pagination.totalPages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                style={{ padding: '4px 12px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer', background: 'hsl(var(--card))' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function entityHref(event: any): string | null {
  const id = event?.entityId;
  if (!id) return null;
  switch (event.entityType) {
    case 'User':
      return '/users';
    case 'Role':
      return '/roles';
    case 'Tenant':
      return '/tenants';
    case 'Patient':
      return '/patients';
    case 'Encounter':
      return '/encounters';
    case 'Document':
      return '/documents';
    case 'CatalogTest':
      return '/catalog/tests';
    case 'CatalogParameter':
      return '/catalog/parameters';
    case 'CatalogPanel':
      return '/catalog/panels';
    default:
      return null;
  }
}

function flattenObject(value: any, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (value === null || value === undefined) return out;

  if (typeof value !== 'object') {
    out[prefix || '(root)'] = String(value);
    return out;
  }

  if (Array.isArray(value)) {
    out[prefix || '(root)'] = JSON.stringify(value);
    return out;
  }

  for (const [k, v] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const nested = flattenObject(v, key);
      for (const [nk, nv] of Object.entries(nested)) out[nk] = nv;
    } else {
      out[key] = v === undefined ? 'undefined' : JSON.stringify(v);
    }
  }

  return out;
}

function buildDiffRows(before: any, after: any): DiffRow[] {
  const b = flattenObject(before);
  const a = flattenObject(after);
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const rows: DiffRow[] = [];

  for (const key of keys) {
    const left = b[key];
    const right = a[key];
    if (left === right) continue;
    if (left === undefined) {
      rows.push({ key, before: '∅', after: right, kind: 'added' });
      continue;
    }
    if (right === undefined) {
      rows.push({ key, before: left, after: '∅', kind: 'removed' });
      continue;
    }
    rows.push({ key, before: left, after: right, kind: 'changed' });
  }

  return rows.sort((x, y) => x.key.localeCompare(y.key));
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
