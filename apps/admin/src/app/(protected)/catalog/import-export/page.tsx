'use client';
import { useRef, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

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
