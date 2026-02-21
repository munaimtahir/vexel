'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entityType: '', actorUserId: '', page: 1 });

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
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: '#1e293b' }}>Audit Log</h1>

      <div style={{ background: 'white', padding: '16px 20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', minWidth: '180px' }}
          >
            <option value="">All actions</option>
            <optgroup label="Auth">
              <option value="auth.login">auth.login</option>
              <option value="auth.logout">auth.logout</option>
            </optgroup>
            <optgroup label="Documents">
              <option value="document.generate">document.generate</option>
              <option value="document.publish">document.publish</option>
              <option value="document.rendered">document.rendered</option>
              <option value="document.render_failed">document.render_failed</option>
            </optgroup>
            <optgroup label="Encounters">
              <option value="encounter.register">encounter.register</option>
              <option value="encounter.order-lab">encounter.order-lab</option>
              <option value="encounter.result">encounter.result</option>
              <option value="encounter.verify">encounter.verify</option>
            </optgroup>
            <optgroup label="Admin">
              <option value="user.create">user.create</option>
              <option value="role.assign">role.assign</option>
              <option value="feature_flag.set">feature_flag.set</option>
              <option value="branding.update">branding.update</option>
            </optgroup>
          </select>
        </div>
        {(['entityType', 'actorUserId'] as const).map((field) => (
          <div key={field}>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textTransform: 'capitalize' }}>{field}</label>
            <input
              value={filters[field]}
              onChange={(e) => setFilters({ ...filters, [field]: e.target.value, page: 1 })}
              placeholder={`Filter by ${field}`}
              style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
        ))}
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={() => setFilters({ action: '', entityType: '', actorUserId: '', page: 1 })}
            style={{ padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              {['Action', 'Entity', 'Actor', 'Correlation ID', 'Time'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No audit events found.</td></tr>
            ) : events.map((e: any) => (
              <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 16px' }}><code style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{e.action}</code></td>
                <td style={{ padding: '10px 16px', color: '#475569' }}>{e.entityType ?? '—'}{e.entityId ? ` (${e.entityId.slice(0, 8)}…)` : ''}</td>
                <td style={{ padding: '10px 16px', color: '#475569', fontFamily: 'monospace', fontSize: '11px' }}>{e.actorUserId ? e.actorUserId.slice(0, 12) : 'system'}</td>
                <td style={{ padding: '10px 16px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>{e.correlationId?.slice(0, 12) ?? '—'}</td>
                <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && pagination.totalPages > 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', fontSize: '13px', color: '#64748b' }}>
            <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', background: 'white' }}>← Prev</button>
              <button disabled={filters.page >= pagination.totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', background: 'white' }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
