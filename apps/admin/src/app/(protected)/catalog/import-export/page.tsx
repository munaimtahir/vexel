'use client';
import { useRef, useState, useEffect } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

// Client-side XLSX parsing
async function parseXlsxToPayload(file: File): Promise<{ tests?: any[]; parameters?: any[]; panels?: any[]; mappings?: any[] }> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  function sheetToRows(sheetName: string): any[] {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  const payload: any = {};

  // Try multi-sheet workbook
  const testRows = sheetToRows('Tests');
  const paramRows = sheetToRows('Parameters');
  const panelRows = sheetToRows('Panels');
  const mappingRows = sheetToRows('TestParameters');
  const panelTestRows = sheetToRows('PanelTests');

  if (testRows.length > 0) payload.tests = testRows.map((r: any) => ({ code: String(r.code ?? r.Code ?? ''), name: String(r.name ?? r.Name ?? ''), description: r.description ?? r.Description ?? undefined, sampleType: r.sampleType ?? r.specimen_type ?? undefined })).filter((t: any) => t.code && t.name);
  if (paramRows.length > 0) payload.parameters = paramRows.map((r: any) => ({ code: String(r.code ?? r.Code ?? ''), name: String(r.name ?? r.Name ?? ''), unit: r.unit ?? r.defaultUnit ?? undefined, dataType: r.dataType ?? r.resultType ?? undefined })).filter((p: any) => p.code && p.name);
  if (panelRows.length > 0) payload.panels = panelRows.map((r: any) => ({ code: String(r.code ?? r.Code ?? ''), name: String(r.name ?? r.Name ?? '') })).filter((p: any) => p.code && p.name);
  if (mappingRows.length > 0) payload.mappings = mappingRows.map((r: any) => ({ testCode: String(r.testCode ?? r.test_code ?? ''), parameterCode: String(r.parameterCode ?? r.parameter_code ?? ''), ordering: Number(r.ordering ?? r.order ?? 0) })).filter((m: any) => m.testCode && m.parameterCode);
  if (panelTestRows.length > 0) payload.panelMappings = panelTestRows.map((r: any) => ({ panelCode: String(r.panelCode ?? r.panel_code ?? ''), testCode: String(r.testCode ?? r.test_code ?? '') })).filter((m: any) => m.panelCode && m.testCode);

  // Fallback: single-sheet CSV (first sheet)
  if (Object.keys(payload).length === 0 && wb.SheetNames.length > 0) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (rows.length > 0) {
      const firstRow = rows[0] as any;
      // Detect type by columns
      if ('testCode' in firstRow || 'test_code' in firstRow) {
        payload.mappings = (rows as any[]).map((r) => ({ testCode: String(r.testCode ?? r.test_code ?? ''), parameterCode: String(r.parameterCode ?? r.parameter_code ?? ''), ordering: Number(r.ordering ?? 0) })).filter((m) => m.testCode && m.parameterCode);
      } else if ('code' in firstRow || 'Code' in firstRow) {
        const hasUnit = 'unit' in firstRow || 'defaultUnit' in firstRow || 'dataType' in firstRow || 'resultType' in firstRow;
        if (hasUnit) {
          payload.parameters = (rows as any[]).map((r) => ({ code: String(r.code ?? r.Code ?? ''), name: String(r.name ?? r.Name ?? ''), unit: r.unit ?? r.defaultUnit, dataType: r.dataType ?? r.resultType })).filter((p) => p.code && p.name);
        } else {
          payload.tests = (rows as any[]).map((r) => ({ code: String(r.code ?? r.Code ?? ''), name: String(r.name ?? r.Name ?? ''), description: r.description, sampleType: r.sampleType ?? r.specimen_type })).filter((t) => t.code && t.name);
        }
      }
    }
  }

  return payload;
}

async function parseCsvToPayload(file: File): Promise<any> {
  const text = await file.text();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(text, { type: 'string' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }) as any[];
  if (!rows.length) return {};
  const firstRow = rows[0];
  if ('testCode' in firstRow || 'test_code' in firstRow) {
    return { mappings: rows.map((r) => ({ testCode: String(r.testCode ?? r.test_code ?? ''), parameterCode: String(r.parameterCode ?? r.parameter_code ?? ''), ordering: Number(r.ordering ?? 0) })) };
  }
  if ('dataType' in firstRow || 'resultType' in firstRow || 'unit' in firstRow || 'defaultUnit' in firstRow) {
    return { parameters: rows.map((r) => ({ code: String(r.code ?? ''), name: String(r.name ?? ''), unit: r.unit ?? r.defaultUnit, dataType: r.dataType ?? r.resultType })) };
  }
  if ('panelCode' in firstRow || 'panel_code' in firstRow) {
    return { panelMappings: rows.map((r) => ({ panelCode: String(r.panelCode ?? r.panel_code ?? ''), testCode: String(r.testCode ?? r.test_code ?? '') })) };
  }
  return { tests: rows.map((r) => ({ code: String(r.code ?? ''), name: String(r.name ?? ''), description: r.description, sampleType: r.sampleType ?? r.specimen_type })) };
}

const TEMPLATES = [
  { label: 'Full Workbook Template (XLSX)', path: 'workbook.xlsx' },
  { label: 'Parameters CSV', path: 'parameters.csv' },
  { label: 'Tests CSV', path: 'tests.csv' },
  { label: 'Test-Parameters CSV', path: 'test-parameters.csv' },
  { label: 'Panels CSV', path: 'panels.csv' },
  { label: 'Panel-Tests CSV', path: 'panel-tests.csv' },
];

export default function ImportExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedPayload, setParsedPayload] = useState<any | null>(null);
  const [parseSummary, setParseSummary] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importJob, setImportJob] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [jobErrors, setJobErrors] = useState<any | null>(null);

  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportJob, setExportJob] = useState<any | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Poll import job status
  useEffect(() => {
    if (!importJobId || !importing) return;
    const interval = setInterval(async () => {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.GET('/catalog/import-jobs/{id}' as any, { params: { path: { id: importJobId } } });
      const job = res.data as any;
      setImportJob(job);
      if (job?.status === 'completed' || job?.status === 'failed') {
        setImporting(false);
        clearInterval(interval);
        if (job?.status === 'failed') {
          // Fetch detailed errors
          const errRes = await api.GET('/catalog/import-jobs/{id}/errors' as any, { params: { path: { id: importJobId } } });
          setJobErrors(errRes.data);
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [importJobId, importing]);

  // Poll export job status
  useEffect(() => {
    if (!exportJobId || !exporting) return;
    const interval = setInterval(async () => {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.GET('/catalog/export-jobs/{id}' as any, { params: { path: { id: exportJobId } } });
      const job = res.data as any;
      setExportJob(job);
      if (job?.status === 'completed' || job?.status === 'failed') {
        setExporting(false);
        clearInterval(interval);
        if (job?.status === 'completed') {
          triggerExportDownload(job);
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [exportJobId, exporting]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setParsedPayload(null);
    setParseSummary('');
    setParseError(null);
    if (!f) return;
    setParsing(true);
    try {
      let payload: any;
      if (f.name.endsWith('.csv')) {
        payload = await parseCsvToPayload(f);
      } else {
        payload = await parseXlsxToPayload(f);
      }
      const counts = [
        payload.tests?.length ? `${payload.tests.length} tests` : '',
        payload.parameters?.length ? `${payload.parameters.length} parameters` : '',
        payload.panels?.length ? `${payload.panels.length} panels` : '',
        payload.mappings?.length ? `${payload.mappings.length} test-param mappings` : '',
        payload.panelMappings?.length ? `${payload.panelMappings.length} panel-test mappings` : '',
      ].filter(Boolean);
      if (counts.length === 0) throw new Error('No parseable data found. Check that columns match the template headers.');
      setParsedPayload(payload);
      setParseSummary(counts.join(', '));
    } catch (err: any) {
      setParseError(err.message ?? 'Parse failed');
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsedPayload) return;
    setImporting(true); setImportError(null); setImportJob(null); setJobErrors(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.POST('/catalog/import-jobs' as any, { body: parsedPayload });
      const job = res.data as any;
      if ((res as any).error) throw new Error((res as any).error?.message ?? 'Import failed');
      setImportJobId(job.id);
      setImportJob(job);
    } catch (err: any) {
      setImportError(err.message ?? 'Import failed');
      setImporting(false);
    }
  }

  async function handleRetryImport() {
    if (!importJobId) return;
    setImporting(true); setImportError(null); setJobErrors(null);
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/catalog/import-jobs/{id}:retry' as any, { params: { path: { id: importJobId } } });
  }

  async function handleExport() {
    setExporting(true); setExportError(null); setExportJob(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.POST('/catalog/export-jobs' as any, {});
      const job = res.data as any;
      if ((res as any).error) throw new Error((res as any).error?.message ?? 'Export failed');
      setExportJobId(job.id);
      setExportJob(job);
    } catch (err: any) {
      setExportError(err.message ?? 'Export failed');
      setExporting(false);
    }
  }

  function triggerExportDownload(job: any) {
    const data = job.resultSummary?.data ?? job.resultSummary;
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate(templatePath: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    window.open(`${apiBase}/api/catalog/templates/${templatePath}`, '_blank');
  }

  const sectionStyle: React.CSSProperties = { background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const btnStyle = (color: string, disabled?: boolean): React.CSSProperties => ({ padding: '9px 20px', background: disabled ? '#e2e8f0' : color, color: disabled ? '#94a3b8' : 'white', border: 'none', borderRadius: '6px', cursor: disabled ? 'default' : 'pointer', fontSize: '14px', fontWeight: 600 });

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>Import / Export</h1>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>Upload XLSX or CSV files to bulk-import catalog data, or export the full catalog as JSON.</p>

      {/* Import section */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>📥 Import Catalog</h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>File (.xlsx or .csv)</label>
          <input ref={fileRef} type="file" accept=".xlsx,.csv"
            onChange={handleFileChange}
            style={{ display: 'block', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }} />
        </div>

        {parsing && <p style={{ fontSize: '13px', color: '#64748b' }}>Parsing file...</p>}
        {parseError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{parseError}</div>}

        {parsedPayload && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
            ✓ Parsed: <strong>{parseSummary}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleImport} disabled={importing || !parsedPayload} style={btnStyle('#2563eb', importing || !parsedPayload)}>
            {importing ? '⏳ Importing…' : '▶ Upload & Import'}
          </button>
          {importJob?.status === 'failed' && (
            <button onClick={handleRetryImport} disabled={importing} style={btnStyle('#f59e0b', importing)}>↺ Retry</button>
          )}
        </div>

        {importError && (
          <div style={{ marginTop: '16px', background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '6px', fontSize: '13px' }}>{importError}</div>
        )}

        {importJob && (
          <div style={{ marginTop: '16px', background: importJob.status === 'failed' ? '#fff7ed' : '#f0fdf4', border: `1px solid ${importJob.status === 'failed' ? '#fed7aa' : '#bbf7d0'}`, borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: importJob.status === 'completed' ? '#166534' : importJob.status === 'failed' ? '#c2410c' : '#374151' }}>
                {importJob.status === 'completed' ? '✓ Import complete' : importJob.status === 'failed' ? '✗ Import failed' : '⏳ ' + importJob.status}
              </span>
              <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#64748b' }}>{importJob.id?.slice(0, 12)}</code>
            </div>
            {importJob.resultSummary && (
              <div style={{ display: 'flex', gap: '20px', fontSize: '13px', flexWrap: 'wrap' }}>
                {[['Created', importJob.resultSummary.created ?? 0, '#166534'], ['Updated', importJob.resultSummary.updated ?? 0, '#1d4ed8'], ['Skipped', importJob.resultSummary.skipped ?? 0, '#6b7280'], ['Total', importJob.resultSummary.total ?? 0, '#374151']].map(([label, val, color]) => (
                  <div key={label as string}><span style={{ color: '#64748b' }}>{label}: </span><span style={{ fontWeight: 700, color: color as string }}>{val as number}</span></div>
                ))}
              </div>
            )}
            {importJob.errorSummary && <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{importJob.errorSummary}</p>}
          </div>
        )}

        {jobErrors && (
          <div style={{ marginTop: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#991b1b', marginBottom: '8px' }}>Error Details</div>
            <pre style={{ fontSize: '11px', color: '#7f1d1d', overflow: 'auto', maxHeight: '160px', margin: 0 }}>{JSON.stringify(jobErrors, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* Export section */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>📤 Export Catalog</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Export all active catalog data as JSON. The export runs as a background job.</p>
        <button onClick={handleExport} disabled={exporting} style={btnStyle('#7c3aed', exporting)}>
          {exporting ? '⏳ Preparing…' : '⬇ Export All as JSON'}
        </button>
        {exportError && <div style={{ marginTop: '12px', background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: '6px', fontSize: '13px' }}>{exportError}</div>}
        {exportJob && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', color: '#374151' }}>
            Job <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{exportJob.id?.slice(0, 12)}</code>:
            <strong style={{ marginLeft: '6px', color: exportJob.status === 'completed' ? '#166534' : exportJob.status === 'failed' ? '#dc2626' : '#1d4ed8' }}>{exportJob.status}</strong>
            {exportJob.resultSummary?.total != null && <span style={{ marginLeft: '8px', color: '#64748b' }}>({exportJob.resultSummary.total} items)</span>}
            {exportJob.status === 'completed' && (
              <button onClick={() => triggerExportDownload(exportJob)} style={{ marginLeft: '12px', padding: '3px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>⬇ Download</button>
            )}
          </div>
        )}
      </section>

      {/* Template downloads */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>📋 Download Templates</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Download templates to prepare your import files. Upload the filled template above.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {TEMPLATES.map((t) => (
            <button key={t.path} onClick={() => downloadTemplate(t.path)}
              style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{t.path.endsWith('.xlsx') ? '📊' : '📄'}</span>
              {t.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const IMPORT_MODES = ['UPSERT_PATCH', 'CREATE_ONLY'];

const TEMPLATES = [
  { label: 'Full Workbook Template (XLSX)', path: 'workbook.xlsx' },
  { label: 'Parameters CSV', path: 'parameters.csv' },
  { label: 'Tests CSV', path: 'tests.csv' },
  { label: 'Test-Parameters CSV', path: 'test-parameters.csv' },
  { label: 'Panels CSV', path: 'panels.csv' },
  { label: 'Panel-Tests CSV', path: 'panel-tests.csv' },
];

export default function ImportExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState('UPSERT_PATCH');
  const [dryRun, setDryRun] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true); setImportError(null); setImportResult(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('validate', String(dryRun));
      const res = await api.POST('/catalog/import' as any, { body: formData as any });
      if ((res as any).error) throw new Error((res as any).error?.message ?? 'Import failed');
      setImportResult(res.data);
    } catch (err: any) {
      setImportError(err.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true); setExportError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.GET('/catalog/export' as any, {});
      if ((res as any).error) throw new Error((res as any).error?.message ?? 'Export failed');
      // Try to trigger download from blob response
      const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catalog-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open direct download link
      const token = getToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      window.open(`${apiBase}/api/catalog/export${token ? `?token=${token}` : ''}`, '_blank');
    } finally {
      setExporting(false);
    }
  }

  function downloadTemplate(templatePath: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    window.open(`${apiBase}/api/catalog/templates/${templatePath}`, '_blank');
  }

  const sectionStyle: React.CSSProperties = { background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const btnPrimary = (color: string): React.CSSProperties => ({ padding: '9px 20px', background: color, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 });
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>Import / Export</h1>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>Upload XLSX or CSV files to bulk-import catalog data, or export the full catalog.</p>

      {/* Import section */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#1e293b' }}>📥 Import Catalog</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'end', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>File (.xlsx or .csv)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: 'block', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', width: '100%', cursor: 'pointer' }} />
          </div>
          <div>
            <label style={labelStyle}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
              {IMPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '2px' }}>
            <input type="checkbox" id="dry-run" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} style={{ width: '15px', height: '15px' }} />
            <label htmlFor="dry-run" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>Dry run (validate only)</label>
          </div>
        </div>

        <button onClick={handleImport} disabled={importing || !file} style={{ ...btnPrimary('#2563eb'), opacity: !file ? 0.5 : 1 }}>
          {importing ? 'Uploading…' : '▶ Upload & Import'}
        </button>

        {importError && (
          <div style={{ marginTop: '16px', background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '6px', fontSize: '13px' }}>{importError}</div>
        )}

        {importResult && (
          <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, color: '#166534', fontSize: '14px', marginBottom: '10px' }}>
              {dryRun ? '✓ Dry-run complete (no changes applied)' : '✓ Import complete'}
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
              {[['Inserted', importResult.inserted ?? 0, '#166534'], ['Updated', importResult.updated ?? 0, '#1d4ed8'], ['Skipped', importResult.skipped ?? 0, '#6b7280'], ['Errors', importResult.errors ?? importResult.errorCount ?? 0, '#dc2626']].map(([label, val, color]) => (
                <div key={label as string}>
                  <span style={{ color: '#64748b' }}>{label}: </span>
                  <span style={{ fontWeight: 700, color: color as string }}>{val as number}</span>
                </div>
              ))}
            </div>
            {(importResult.errorDetails ?? importResult.errorList ?? []).length > 0 && (
              <div style={{ marginTop: '12px', maxHeight: '160px', overflowY: 'auto' }}>
                {(importResult.errorDetails ?? importResult.errorList).map((e: any, i: number) => (
                  <div key={i} style={{ fontSize: '12px', color: '#dc2626', padding: '3px 0', borderTop: i > 0 ? '1px solid #fecaca' : undefined }}>
                    {typeof e === 'string' ? e : `Row ${e.row ?? i + 1}: ${e.message ?? JSON.stringify(e)}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Export section */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>📤 Export Catalog</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Download all active catalog data as XLSX.</p>
        <button onClick={handleExport} disabled={exporting} style={btnPrimary('#7c3aed')}>
          {exporting ? 'Preparing…' : '⬇ Export All as XLSX'}
        </button>
        {exportError && (
          <div style={{ marginTop: '12px', background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: '6px', fontSize: '13px' }}>{exportError}</div>
        )}
      </section>

      {/* Template downloads */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>📋 Download Templates</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Use these templates to prepare your import files.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {TEMPLATES.map((t) => (
            <button key={t.path} onClick={() => downloadTemplate(t.path)}
              style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{t.path.endsWith('.xlsx') ? '📊' : '📄'}</span>
              {t.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
