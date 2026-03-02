'use client';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { DataTable } from '@vexel/ui-system';

const emptyForm = () => ({
  name: '', externalId: '', userCode: '', loincCode: '',
  department: '', specimenType: '', method: '', price: '', isActive: true, printAlone: false,
});

export default function CatalogTestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [testParams, setTestParams] = useState<any[]>([]);
  const [allParams, setAllParams] = useState<any[]>([]);
  const [paramPickerOpen, setParamPickerOpen] = useState(false);
  const [paramLoading, setParamLoading] = useState(false);
  const [addingParam, setAddingParam] = useState(false);
  const [paramSearch, setParamSearch] = useState('');

  const [parameterUsage, setParameterUsage] = useState<Record<string, number>>({});
  const [usageLoaded, setUsageLoaded] = useState(false);
  const [topTests, setTopTests] = useState<any[]>([]);
  const [topTestsLoading, setTopTestsLoading] = useState(false);
  const [topTestsSaving, setTopTestsSaving] = useState(false);
  const [topTestsError, setTopTestsError] = useState<string | null>(null);
  const [topSearch, setTopSearch] = useState('');
  const [topSearchResults, setTopSearchResults] = useState<any[]>([]);
  const [topSearching, setTopSearching] = useState(false);
  const topSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topSearchReqSeqRef = useRef(0);

  const LIMIT = 20;

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/tests' as any, { params: { query: { search: s || undefined, page: p, limit: LIMIT } } });
    setTests((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    load();
  }, []);

  const loadTopTests = useCallback(async () => {
    setTopTestsLoading(true);
    setTopTestsError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.GET('/operator/catalog/tests/top' as any, {});
      setTopTests(Array.isArray(res.data) ? (res.data as any[]) : []);
    } catch (e: any) {
      setTopTestsError(e?.message ?? 'Failed to load top tests');
      setTopTests([]);
    } finally {
      setTopTestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopTests();
  }, [loadTopTests]);

  async function loadTestParams(testId: string) {
    setParamLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/tests/{testId}/parameters' as any, { params: { path: { testId } } });
    setTestParams((res.data as any)?.data ?? (Array.isArray(res.data) ? res.data : []));
    setParamLoading(false);
  }

  async function loadAllParams() {
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/parameters' as any, { params: { query: { limit: 500, page: 1 } } });
    setAllParams((res.data as any)?.data ?? []);
  }

  async function loadParameterUsage() {
    if (usageLoaded) return;
    const api = getApiClient(getToken() ?? undefined);
    const allTestsRes = await api.GET('/catalog/tests' as any, { params: { query: { page: 1, limit: 200 } } });
    const allRows = ((allTestsRes.data as any)?.data ?? []) as any[];
    const usage = new Map<string, number>();

    const mappings = await Promise.allSettled(
      allRows.map((row) => api.GET('/catalog/tests/{testId}/parameters' as any, { params: { path: { testId: row.id } } })),
    );
    for (const m of mappings) {
      if (m.status !== 'fulfilled') continue;
      const rows = ((m.value.data as any)?.data ?? (Array.isArray(m.value.data) ? m.value.data : [])) as any[];
      const unique = new Set(rows.map((r) => r.parameterId ?? r.id));
      for (const pid of unique) {
        if (!pid) continue;
        usage.set(pid, (usage.get(pid) ?? 0) + 1);
      }
    }
    setParameterUsage(Object.fromEntries(usage));
    setUsageLoaded(true);
  }

  async function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setDrawerOpen(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/tests/next-id' as any, {});
    const nextId = (res.data as any)?.nextId ?? '';
    setForm((f) => ({ ...f, externalId: nextId }));
  }

  function openEdit(t: any) {
    setEditingId(t.id);
    setForm({
      name: t.name ?? '',
      externalId: t.externalId ?? '',
      userCode: t.userCode ?? '',
      loincCode: t.loincCode ?? '',
      department: t.department ?? '',
      specimenType: t.specimenType ?? '',
      method: t.method ?? '',
      price: t.price != null ? String(t.price) : '',
      isActive: t.isActive !== false,
      printAlone: t.printAlone === true,
    });
    setError(null);
    setDrawerOpen(true);
  }

  async function selectTest(t: any) {
    setSelectedTest(t);
    await Promise.all([loadTestParams(t.id), loadAllParams(), loadParameterUsage()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { name: form.name, isActive: form.isActive, printAlone: form.printAlone };
    if (form.externalId) body.externalId = form.externalId;
    if (form.userCode) body.userCode = form.userCode;
    if (form.loincCode) body.loincCode = form.loincCode;
    if (form.department) body.department = form.department;
    if (form.specimenType) body.specimenType = form.specimenType;
    if (form.method) body.method = form.method;
    if (form.price !== '') body.price = Number(form.price);

    let res: any;
    if (editingId) {
      res = await api.PATCH('/catalog/tests/{id}' as any, { params: { path: { id: editingId } }, body });
    } else {
      res = await api.POST('/catalog/tests' as any, { body });
    }
    if (res.error) {
      setError(res.error?.message ?? 'Failed');
      setSaving(false);
      return;
    }
    setDrawerOpen(false);
    setSaving(false);
    await load(page, search);
    if (selectedTest && selectedTest.id === editingId && res.data) {
      setSelectedTest(res.data);
    }
  }

  async function addParam(parameterId: string) {
    if (!selectedTest) return;
    setAddingParam(true);
    const api = getApiClient(getToken() ?? undefined);
    const maxOrder = testParams.reduce((m: number, p: any) => Math.max(m, p.displayOrder ?? p.ordering ?? 0), 0);
    await api.POST('/catalog/tests/{testId}/parameters' as any, {
      params: { path: { testId: selectedTest.id } },
      body: { parameterId, ordering: maxOrder + 1 },
    });
    await loadTestParams(selectedTest.id);
    setParamPickerOpen(false);
    setAddingParam(false);
  }

  async function removeParam(parameterId: string) {
    if (!selectedTest) return;
    const api = getApiClient(getToken() ?? undefined);
    await api.DELETE('/catalog/tests/{testId}/parameters/{parameterId}' as any, {
      params: { path: { testId: selectedTest.id, parameterId } },
    });
    await loadTestParams(selectedTest.id);
  }

  async function reorderParam(parameterId: string, direction: 'up' | 'down') {
    if (!selectedTest) return;
    const sorted = [...testParams].sort((a: any, b: any) => (a.displayOrder ?? a.ordering ?? 0) - (b.displayOrder ?? b.ordering ?? 0));
    const idx = sorted.findIndex((p: any) => (p.parameterId ?? p.id) === parameterId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const curr = sorted[idx];
    const swap = sorted[swapIdx];
    const currOrder = curr.displayOrder ?? curr.ordering ?? idx + 1;
    const swapOrder = swap.displayOrder ?? swap.ordering ?? swapIdx + 1;
    const api = getApiClient(getToken() ?? undefined);
    await Promise.all([
      api.PATCH('/catalog/tests/{testId}/parameters/{parameterId}' as any, {
        params: { path: { testId: selectedTest.id, parameterId: curr.parameterId ?? curr.id } },
        body: { displayOrder: swapOrder },
      }),
      api.PATCH('/catalog/tests/{testId}/parameters/{parameterId}' as any, {
        params: { path: { testId: selectedTest.id, parameterId: swap.parameterId ?? swap.id } },
        body: { displayOrder: currOrder },
      }),
    ]);
    await loadTestParams(selectedTest.id);
  }

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    load(1, val);
  }

  function handlePage(p: number) {
    setPage(p);
    load(p, search);
  }

  const doTopSearch = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2) {
      topSearchReqSeqRef.current += 1;
      setTopSearchResults([]);
      setTopSearching(false);
      return;
    }
    const reqId = ++topSearchReqSeqRef.current;
    setTopSearching(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.GET('/operator/catalog/tests/search' as any, { params: { query: { q: query, limit: 20 } } });
      if (reqId !== topSearchReqSeqRef.current) return;
      const rows = Array.isArray(res.data) ? (res.data as any[]) : [];
      const selectedIds = new Set(topTests.map((t) => t.id));
      setTopSearchResults(rows.filter((r) => !selectedIds.has(r.id)));
    } catch {
      if (reqId !== topSearchReqSeqRef.current) return;
      setTopSearchResults([]);
    } finally {
      if (reqId === topSearchReqSeqRef.current) setTopSearching(false);
    }
  }, [topTests]);

  useEffect(() => {
    topSearchTimerRef.current = setTimeout(() => doTopSearch(topSearch), 250);
    return () => { if (topSearchTimerRef.current) clearTimeout(topSearchTimerRef.current); };
  }, [topSearch, doTopSearch]);

  function addTopTest(t: any) {
    if (topTests.some((x) => x.id === t.id)) return;
    if (topTests.length >= 10) return;
    setTopTests((prev) => [...prev, t]);
    setTopSearch('');
    setTopSearchResults((prev) => prev.filter((x) => x.id !== t.id));
  }

  function removeTopTest(id: string) {
    setTopTests((prev) => prev.filter((t) => t.id !== id));
  }

  function moveTopTest(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= topTests.length) return;
    const copy = [...topTests];
    const curr = copy[index];
    copy[index] = copy[target];
    copy[target] = curr;
    setTopTests(copy);
  }

  async function saveTopTests() {
    setTopTestsSaving(true);
    setTopTestsError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.PUT('/admin/catalog/tests/top' as any, {
        body: { testIds: topTests.map((t) => t.id) },
      });
      if (res.error) {
        setTopTestsError((res.error as any)?.message ?? 'Failed to save top tests');
      } else {
        setTopTests(Array.isArray(res.data) ? (res.data as any[]) : []);
      }
    } catch (e: any) {
      setTopTestsError(e?.message ?? 'Failed to save top tests');
    } finally {
      setTopTestsSaving(false);
    }
  }

  const duplicateHints = useMemo(() => {
    const rows = tests.filter((t) => t.id !== editingId);
    return {
      name: !!form.name.trim() && rows.some((t) => String(t.name || '').toLowerCase() === form.name.trim().toLowerCase()),
      userCode: !!form.userCode.trim() && rows.some((t) => String(t.userCode || '').toLowerCase() === form.userCode.trim().toLowerCase()),
      externalId: !!form.externalId.trim() && rows.some((t) => String(t.externalId || '').toLowerCase() === form.externalId.trim().toLowerCase()),
    };
  }, [tests, editingId, form.name, form.userCode, form.externalId]);

  const hasDuplicate = duplicateHints.name || duplicateHints.userCode || duplicateHints.externalId;

  const totalPages = Math.ceil(total / LIMIT);
  const columns = [
    {
      key: 'userCode',
      header: 'User Code',
      cell: (t: any) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.userCode ?? '—'}</span>,
    },
    {
      key: 'externalId',
      header: 'Ext ID',
      cell: (t: any) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{t.externalId ?? '—'}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      cell: (t: any) => <span style={{ fontWeight: 500 }}>{t.name}</span>,
    },
    {
      key: 'mappings',
      header: 'Mappings',
      cell: (t: any) => (
        <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>
          {(t.parameterCount ?? t.parametersCount ?? 0) || '—'} params
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price (PKR)',
      cell: (t: any) => <span style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>{t.price != null ? t.price.toLocaleString() : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (t: any) => (
        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: t.isActive ? 'hsl(var(--status-success-bg))' : 'hsl(var(--status-destructive-bg))', color: t.isActive ? 'hsl(var(--status-success-fg))' : 'hsl(var(--status-destructive-fg))' }}>
          {t.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (t: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEdit(t);
          }}
          style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}
        >
          Edit
        </button>
      ),
    },
  ];

  const assignedParamIds = new Set(testParams.map((p: any) => p.parameterId ?? p.id));
  const availableParams = allParams.filter((p: any) => !assignedParamIds.has(p.id));
  const filteredAvailable = availableParams.filter((p: any) => {
    if (!paramSearch.trim()) return true;
    const q = paramSearch.trim().toLowerCase();
    return [p.name, p.userCode, p.externalId].some((v) => String(v ?? '').toLowerCase().includes(q));
  });

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' };

  return (
    <div>
      {drawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{editingId ? 'Edit Test' : 'New Test'}</h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>×</button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
            {error && <div style={{ background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}
            {hasDuplicate && <div style={{ background: 'hsl(var(--status-warning-bg))', color: 'hsl(var(--status-warning-fg))', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>Duplicate indicators detected in current list. Resolve before saving.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, borderColor: duplicateHints.name ? 'hsl(var(--status-warning-fg))' : 'hsl(var(--border))' }} />
                {duplicateHints.name ? <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'hsl(var(--status-warning-fg))' }}>Name already exists in this page set.</p> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Test ID <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>· Auto-generated</span></label>
                  <input value={form.externalId} readOnly style={{ ...inputStyle, background: 'hsl(var(--background))', color: 'hsl(var(--muted-foreground))', cursor: 'default', borderColor: duplicateHints.externalId ? 'hsl(var(--status-warning-fg))' : 'hsl(var(--border))' }} />
                  {duplicateHints.externalId ? <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'hsl(var(--status-warning-fg))' }}>External ID duplicate found.</p> : null}
                </div>
                <div>
                  <label style={labelStyle}>User Code</label>
                  <input value={form.userCode} onChange={(e) => setForm({ ...form, userCode: e.target.value })} style={{ ...inputStyle, borderColor: duplicateHints.userCode ? 'hsl(var(--status-warning-fg))' : 'hsl(var(--border))' }} />
                  {duplicateHints.userCode ? <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'hsl(var(--status-warning-fg))' }}>User code duplicate found.</p> : null}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Specimen Type</label>
                  <input value={form.specimenType} onChange={(e) => setForm({ ...form, specimenType: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Method</label>
                  <input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>LOINC Code</label>
                  <input value={form.loincCode} onChange={(e) => setForm({ ...form, loincCode: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Price (PKR)</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="test-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                <label htmlFor="test-active" style={{ fontSize: '14px', color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Active</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="test-print-alone" checked={form.printAlone} onChange={(e) => setForm({ ...form, printAlone: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                <label htmlFor="test-print-alone" style={{ fontSize: '14px', color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Print on separate page in lab report</label>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving || hasDuplicate} style={{ flex: 1, padding: '10px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, opacity: hasDuplicate ? 0.6 : 1 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Test'}
              </button>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ padding: '10px 16px', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Catalog Tests</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>+ New Test</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by name, code, user code, LOINC…" style={{ width: '320px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px' }} />
      </div>

      <div style={{ marginBottom: '18px', border: '1px solid hsl(var(--border))', borderRadius: '8px', background: 'hsl(var(--card))', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Pinned Top Tests (max 10)</div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>{topTests.length}/10 selected</div>
          </div>
          <button
            onClick={saveTopTests}
            disabled={topTestsSaving || topTestsLoading}
            style={{ padding: '7px 12px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: topTestsSaving ? 0.7 : 1 }}
          >
            {topTestsSaving ? 'Saving...' : 'Save Top Tests'}
          </button>
        </div>

        <div style={{ marginBottom: '10px', position: 'relative' }}>
          <input
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            placeholder="Search tests to pin (min 2 chars)"
            style={{ width: '100%', maxWidth: '460px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px' }}
          />
          {topSearching && <span style={{ position: 'absolute', right: '8px', top: '8px', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>Searching…</span>}
        </div>
        {topSearch.trim().length >= 2 && topSearchResults.length > 0 && (
          <div style={{ marginBottom: '10px', maxHeight: '180px', overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}>
            {topSearchResults.map((t) => (
              <button
                key={t.id}
                onClick={() => addTopTest(t)}
                disabled={topTests.length >= 10}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid hsl(var(--muted))', background: 'transparent', padding: '8px 10px', cursor: topTests.length >= 10 ? 'default' : 'pointer', opacity: topTests.length >= 10 ? 0.6 : 1 }}
              >
                <div style={{ fontSize: '13px', color: 'hsl(var(--foreground))', fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{[t.userCode, t.testCode].filter(Boolean).join(' • ') || '—'}</div>
              </button>
            ))}
          </div>
        )}

        {topTestsError && <div style={{ marginBottom: '8px', fontSize: '12px', color: 'hsl(var(--status-destructive-fg))' }}>{topTestsError}</div>}
        {topTestsLoading ? (
          <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Loading top tests…</div>
        ) : topTests.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>No pinned tests configured for this tenant.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topTests.map((t, idx) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid hsl(var(--border))', borderRadius: '6px', padding: '7px 8px' }}>
                <div style={{ width: '24px', textAlign: 'center', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{idx + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'hsl(var(--foreground))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{[t.userCode, t.testCode].filter(Boolean).join(' • ') || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => moveTopTest(idx, 'up')} disabled={idx === 0} style={{ padding: '2px 6px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', borderRadius: '4px', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '11px' }}>↑</button>
                  <button onClick={() => moveTopTest(idx, 'down')} disabled={idx === topTests.length - 1} style={{ padding: '2px 6px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', borderRadius: '4px', cursor: idx === topTests.length - 1 ? 'default' : 'pointer', fontSize: '11px' }}>↓</button>
                  <button onClick={() => removeTopTest(t.id)} style={{ padding: '2px 7px', border: 'none', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DataTable
            columns={columns}
            data={tests}
            keyExtractor={(t: any) => `${t.id}`}
            onRowClick={(t: any) => selectTest(t)}
            loading={loading}
            emptyMessage="No tests found."
            className="shadow-sm"
            rowClassName={(t: any) => (selectedTest?.id === t.id ? 'bg-[hsl(var(--status-info-bg))]' : undefined)}
          />
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '16px', alignItems: 'center', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
              <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'hsl(var(--card))', color: page > 1 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>← Prev</button>
              <span style={{ padding: '0 8px' }}>Page {page} of {totalPages} ({total} total)</span>
              <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'hsl(var(--card))', color: page < totalPages ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>Next →</button>
            </div>
          )}
        </div>

        {selectedTest && (
          <div style={{ width: '380px', flexShrink: 0, background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Test-to-Parameter Mapping</div>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>{selectedTest.name}</div>
              </div>
              <button onClick={() => setSelectedTest(null)} style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', padding: '2px 8px', borderRadius: '10px' }}>{testParams.length} assigned</span>
              <span style={{ fontSize: '11px', background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--status-info-fg))', padding: '2px 8px', borderRadius: '10px' }}>{availableParams.length} available</span>
            </div>

            {paramLoading ? (
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
            ) : testParams.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '12px' }}>No parameters assigned.</p>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                {[...testParams]
                  .sort((a: any, b: any) => (a.displayOrder ?? a.ordering ?? 0) - (b.displayOrder ?? b.ordering ?? 0))
                  .map((tp: any, idx: number, arr: any[]) => {
                    const pid = tp.parameterId ?? tp.id;
                    const usage = parameterUsage[pid] ?? 0;
                    return (
                      <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 0', borderBottom: '1px solid hsl(var(--muted))' }}>
                        <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', width: '18px', flexShrink: 0, textAlign: 'right' }}>{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: 'hsl(var(--foreground))', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tp.parameter?.name ?? tp.name ?? pid}</div>
                          <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {tp.parameter?.resultType ? <span>{tp.parameter.resultType}</span> : null}
                            {tp.parameter?.defaultUnit ? <span>{tp.parameter.defaultUnit}</span> : null}
                            <span style={{ background: 'hsl(var(--muted))', padding: '1px 6px', borderRadius: '8px' }}>used in {usage} test{usage === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                        {tp.isRequired && <span style={{ fontSize: '10px', background: 'hsl(var(--status-warning-bg))', color: 'hsl(var(--status-warning-fg))', padding: '1px 5px', borderRadius: '8px', flexShrink: 0 }}>req</span>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <button onClick={() => reorderParam(pid, 'up')} disabled={idx === 0} style={{ padding: '1px 4px', fontSize: '10px', background: idx === 0 ? 'hsl(var(--muted))' : 'hsl(var(--status-info-bg))', color: idx === 0 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))', border: 'none', borderRadius: '3px', cursor: idx === 0 ? 'default' : 'pointer', lineHeight: 1 }}>↑</button>
                          <button onClick={() => reorderParam(pid, 'down')} disabled={idx === arr.length - 1} style={{ padding: '1px 4px', fontSize: '10px', background: idx === arr.length - 1 ? 'hsl(var(--muted))' : 'hsl(var(--status-info-bg))', color: idx === arr.length - 1 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))', border: 'none', borderRadius: '3px', cursor: idx === arr.length - 1 ? 'default' : 'pointer', lineHeight: 1 }}>↓</button>
                        </div>
                        <button onClick={() => removeParam(pid)} style={{ padding: '2px 7px', fontSize: '11px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', border: 'none', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>×</button>
                      </div>
                    );
                  })}
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <button onClick={() => { setParamPickerOpen(!paramPickerOpen); if (!paramPickerOpen) loadAllParams(); }} style={{ width: '100%', padding: '7px', background: 'hsl(var(--status-info-bg))', border: '1px dashed hsl(var(--status-info-border))', borderRadius: '6px', color: 'hsl(var(--primary))', fontSize: '13px', cursor: 'pointer' }}>+ Add Parameter</button>
              {paramPickerOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', boxShadow: '0 4px 12px hsl(var(--foreground) / 0.1)', maxHeight: '240px', overflowY: 'auto', zIndex: 10 }}>
                  <div style={{ padding: '8px', borderBottom: '1px solid hsl(var(--muted))' }}>
                    <input value={paramSearch} onChange={(e) => setParamSearch(e.target.value)} placeholder="Search parameter..." style={{ width: '100%', padding: '6px 8px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }} />
                  </div>
                  {filteredAvailable.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>No more parameters available.</div>
                  ) : filteredAvailable.map((p: any) => {
                    const usage = parameterUsage[p.id] ?? 0;
                    return (
                      <button key={p.id} onClick={() => addParam(p.id)} disabled={addingParam} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid hsl(var(--muted))' }}>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        <div style={{ marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {p.userCode && <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{p.userCode}</span>}
                          <span style={{ fontSize: '11px', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', padding: '1px 6px', borderRadius: '8px' }}>used in {usage} tests</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
