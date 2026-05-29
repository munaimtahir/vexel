'use client';

import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const CATEGORIES = [
  'auth',
  'tenancy',
  'workflow',
  'documents',
  'worker',
  'queue',
  'pdf',
  'catalog',
  'admin',
  'feature_flags',
  'health',
  'security',
  'system',
];

const LEVELS = ['info', 'warn', 'error'];

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLog, setDetailLog] = useState<any | null>(null);

  // Filters state
  const [category, setCategory] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const [correlationId, setCorrelationId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  async function loadLogs() {
    setLoading(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.GET('/system-logs' as any, {
        params: {
          query: {
            page: String(page),
            limit: String(limit),
            ...(category && { category }),
            ...(level && { level }),
            ...(correlationId && { correlationId }),
            ...(search && { search }),
          } as any,
        },
      });

      setLogs((data as any)?.data ?? []);
      setTotal((data as any)?.total ?? 0);
    } catch (err) {
      console.error('Failed to load system logs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [category, level, correlationId, search, page]);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>System Logs</h1>
          <p style={{ color: '#666', margin: '4px 0 0 0' }}>Category-wise operational logging viewer</p>
        </div>
        <button
          onClick={loadLogs}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4F46E5',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Refresh Logs
        </button>
      </div>

      {/* Filters Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          backgroundColor: '#fff',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Category
          </label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Level
          </label>
          <select
            value={level}
            onChange={(e) => { setLevel(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
          >
            <option value="">All Levels</option>
            {LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Correlation ID
          </label>
          <input
            type="text"
            placeholder="Search uuid..."
            value={correlationId}
            onChange={(e) => { setCorrelationId(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Search Message
          </label>
          <input
            type="text"
            placeholder="Contains text..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No matching logs found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Category</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Level</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Message</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Correlation ID</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const badgeColor =
                  log.level === 'error'
                    ? { bg: '#FEE2E2', text: '#991B1B' }
                    : log.level === 'warn'
                    ? { bg: '#FEF3C7', text: '#92400E' }
                    : { bg: '#E0E7FF', text: '#3730A3' };

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                      <span
                        style={{
                          backgroundColor: '#F3F4F6',
                          color: '#374151',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {log.category.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          backgroundColor: badgeColor.bg,
                          color: badgeColor.text,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#111827', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.message}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#4B5563' }}>
                      {log.correlationId ? (
                        <span
                          onClick={() => {
                            navigator.clipboard.writeText(log.correlationId);
                            alert('Copied Correlation ID!');
                          }}
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {log.correlationId.slice(0, 8)}...
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => setDetailLog(log)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#F3F4F6',
                          border: '1px solid #D1D5DB',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Bar */}
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>
            Showing <b>{logs.length}</b> of <b>{total}</b> logs
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#fff',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage(page + 1)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#fff',
                cursor: page * limit >= total ? 'not-allowed' : 'pointer',
                opacity: page * limit >= total ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {detailLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Log Details</h3>
              <button
                onClick={() => setDetailLog(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ fontWeight: 600, display: 'block', color: '#4B5563' }}>ID</span>
                <span style={{ fontFamily: 'monospace' }}>{detailLog.id}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, display: 'block', color: '#4B5563' }}>Timestamp</span>
                <span>{new Date(detailLog.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, display: 'block', color: '#4B5563' }}>Category / Level</span>
                <span style={{ textTransform: 'uppercase', marginRight: '8px' }}>{detailLog.category}</span>
                <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>({detailLog.level})</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, display: 'block', color: '#4B5563' }}>Message</span>
                <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                  {detailLog.message}
                </div>
              </div>
              {detailLog.correlationId && (
                <div>
                  <span style={{ fontWeight: 600, display: 'block', color: '#4B5563' }}>Correlation ID</span>
                  <span style={{ fontFamily: 'monospace' }}>{detailLog.correlationId}</span>
                </div>
              )}
              {detailLog.tenantId && (
                <div>
                  <span style={{ fontWeight: 600, display: 'block', color: '#4B5563' }}>Tenant ID</span>
                  <span style={{ fontFamily: 'monospace' }}>{detailLog.tenantId}</span>
                </div>
              )}
              {detailLog.metadata && (
                <div>
                  <span style={{ fontWeight: 600, display: 'block', color: '#4B5563' }}>Metadata</span>
                  <pre
                    style={{
                      padding: '8px',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '4px',
                      border: '1px solid #E5E7EB',
                      overflowX: 'auto',
                      fontSize: '11px',
                    }}
                  >
                    {JSON.stringify(detailLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <button
              onClick={() => setDetailLog(null)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#F3F4F6',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '20px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
