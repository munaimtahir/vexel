'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 25;

  async function load(p = 1, q = '') {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const query: any = { page: p, limit: LIMIT };
    if (q) query.search = q;
    const res = await api.GET('/patients' as any, { params: { query } });
    setPatients((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handlePage(p: number) { setPage(p); load(p, search); }
  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); load(1, search); }

  const totalPages = Math.ceil(total / LIMIT);

  function genderBadge(gender: string) {
    if (!gender) return <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>;
    return <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: gender === 'M' ? 'hsl(var(--status-info-bg))' : 'hsl(var(--status-info-bg))', color: gender === 'M' ? 'hsl(var(--status-info-fg))' : 'hsl(var(--status-info-fg))' }}>{gender === 'M' ? 'Male' : 'Female'}</span>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Patients</h1>
        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Read-only — manage via Operator app</span>
      </div>

      <form onSubmit={handleSearch} style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, MR number…"
          style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', minWidth: '300px' }}
        />
        <button type="submit" style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Search</button>
        {search && <button type="button" onClick={() => { setSearch(''); load(1, ''); }} style={{ padding: '8px 12px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Clear</button>}
      </form>

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: 'hsl(var(--background))' }}>
            <tr>
              {['MR #', 'Name', 'Gender', 'DOB', 'Phone', 'CNIC', 'Tenant', 'Created'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading…</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>No patients found.</td></tr>
            ) : patients.map((p: any) => (
              <tr key={p.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--primary))', fontWeight: 600 }}>{p.mrNumber ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.firstName} {p.lastName}</td>
                <td style={{ padding: '10px 12px' }}>{genderBadge(p.gender)}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : '—'}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{p.phone ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px', fontFamily: 'monospace' }}>{p.cnic ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontFamily: 'monospace' }}>{p.tenantId?.slice(0, 8) ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
        <span>{total} total patients</span>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>← Prev</button>
            <span style={{ padding: '5px 10px' }}>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
