'use client';
import { useRef, useState } from 'react';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// ── Template metadata ────────────────────────────────────────────────────────
const TEMPLATES = [
  { label: 'Full Workbook Template (XLSX) — all sheets', path: 'workbook.xlsx', icon: '📊' },
  { label: 'Parameters CSV', path: 'parameters.csv', icon: '📄' },
  { label: 'Tests CSV', path: 'tests.csv', icon: '📄' },
  { label: 'Test-Parameters Mapping CSV', path: 'test-parameters.csv', icon: '🔗' },
  { label: 'Panels CSV', path: 'panels.csv', icon: '📄' },
  { label: 'Panel-Tests Mapping CSV', path: 'panel-tests.csv', icon: '🔗' },
];

async function downloadFile(url: string, filename: string) {
  const token = getToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

export default function ImportExportPage() {
  // ── Import state ────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'UPSERT_PATCH' | 'CREATE_ONLY'>('UPSERT_PATCH');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Mapping import state ─────────────────────────────────────────────────────
  const mappingFileRef = useRef<HTMLInputElement>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [mappingImporting, setMappingImporting] = useState(false);
  const [mappingResult, setMappingResult] = useState<any | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  // ── Export state ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!file) return;
    setImporting(true); setImportResult(null); setImportError(null);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      const res = await fetch(`${API_BASE}/api/catalog/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? `Import failed: ${res.status}`);
      setImportResult(json);
    } catch (err: any) {
      setImportError(err.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleMappingImport() {
    if (!mappingFile) return;
    setMappingImporting(true); setMappingError(null); setMappingResult(null);
    try {
      const csv = await mappingFile.text();
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/catalog/test-parameter-mappings/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ csv }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? `Import failed: ${res.status}`);
      setMappingResult(json);
    } catch (err: any) {
      setMappingError(err.message ?? 'Import failed');
    } finally {
      setMappingImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true); setExportError(null);
    try {
      await downloadFile(
        `${API_BASE}/api/catalog/export`,
        `catalog-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch (err: any) {
      setExportError(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleTemplateDownload(templatePath: string) {
    try {
      await downloadFile(`${API_BASE}/api/catalog/templates/${templatePath}`, templatePath);
    } catch {
      alert('Template download failed');
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  const sectionStyle: React.CSSProperties = {
    background: 'hsl(var(--card))', borderRadius: '8px', padding: '24px',
    marginBottom: '20px', boxShadow: 'var(--shadow-sm)',
  };
  const btn = (color: string, disabled?: boolean): React.CSSProperties => ({
    padding: '9px 20px', background: disabled ? 'hsl(var(--border))' : color,
    color: disabled ? 'hsl(var(--muted-foreground))' : 'white', border: 'none', borderRadius: '6px',
    cursor: disabled ? 'default' : 'pointer', fontSize: '14px', fontWeight: 600,
  });

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>Import / Export</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '24px', fontSize: '14px' }}>
        Upload XLSX or CSV to bulk-import catalog data, or export the full catalog.
      </p>

      {/* ── Import ─────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>📥 Import Catalog</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Upload the full workbook (.xlsx) or any individual CSV sheet. Supported sheets: Parameters, Tests, TestParameters, Panels, PanelTests.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>File (.xlsx or .csv)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.csv"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setImportResult(null); setImportError(null); }}
              style={{ display: 'block', padding: '7px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value as any)}
              style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <option value="UPSERT_PATCH">UPSERT_PATCH — update existing, insert new</option>
              <option value="CREATE_ONLY">CREATE_ONLY — insert new, skip existing</option>
            </select>
          </div>
        </div>

        <button onClick={handleImport} disabled={importing || !file} style={btn('hsl(var(--primary))', importing || !file)}>
          {importing ? '⏳ Importing…' : '▶ Upload & Import'}
        </button>

        {importError && (
          <div style={{ marginTop: '14px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '12px 16px', borderRadius: '6px', fontSize: '13px' }}>
            ✗ {importError}
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: '14px', background: 'hsl(var(--status-success-bg))', border: '1px solid hsl(var(--status-success-border))', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, color: 'hsl(var(--status-success-fg))', marginBottom: '10px', fontSize: '14px' }}>✓ Import complete</div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px', flexWrap: 'wrap' }}>
              {[
                ['Inserted', importResult.inserted ?? 0, 'hsl(var(--status-success-fg))'],
                ['Updated', importResult.updated ?? 0, 'hsl(var(--status-info-fg))'],
                ['Skipped', importResult.skipped ?? 0, 'hsl(var(--muted-foreground))'],
              ].map(([label, val, color]) => (
                <div key={label as string}>
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}: </span>
                  <span style={{ fontWeight: 700, color: color as string }}>{val as number}</span>
                </div>
              ))}
            </div>
            {importResult.errors?.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', color: 'hsl(var(--status-destructive-fg))', fontWeight: 700, marginBottom: '4px' }}>
                  {importResult.errors.length} error(s):
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {importResult.errors.slice(0, 10).map((e: any, i: number) => (
                    <li key={i} style={{ fontSize: '12px', color: 'hsl(var(--status-destructive-fg))' }}>
                      {e.sheet ? `[${e.sheet}] ` : ''}{e.row ? `Row ${e.row}: ` : ''}{e.message}
                    </li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li style={{ fontSize: '12px', color: 'hsl(var(--status-destructive-fg))' }}>…and {importResult.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Parameter Mappings Import ──────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>🔗 Import Parameter Mappings (CSV)</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>
          Dedicated sheet-based CSV import. First column = <code style={{ fontFamily: 'monospace', background: 'hsl(var(--muted))', padding: '1px 4px', borderRadius: '3px' }}>testExternalId</code> (e.g. <strong>t1</strong>),
          second column = <code style={{ fontFamily: 'monospace', background: 'hsl(var(--muted))', padding: '1px 4px', borderRadius: '3px' }}>parameterExternalId</code> (e.g. <strong>p1</strong>).
        </p>
        <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Alternatively, use the TestParameters sheet in the full XLSX workbook above.
        </p>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>File (.csv only)</label>
          <input ref={mappingFileRef} type="file" accept=".csv"
            onChange={e => { setMappingFile(e.target.files?.[0] ?? null); setMappingResult(null); setMappingError(null); }}
            style={{ display: 'block', padding: '7px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }} />
        </div>

        <button onClick={handleMappingImport} disabled={mappingImporting || !mappingFile} style={btn('hsl(var(--primary))', mappingImporting || !mappingFile)}>
          {mappingImporting ? '⏳ Importing…' : '▶ Import Mappings'}
        </button>

        {mappingError && (
          <div style={{ marginTop: '12px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '10px 12px', borderRadius: '6px', fontSize: '13px' }}>
            ✗ {mappingError}
          </div>
        )}
        {mappingResult && (
          <div style={{ marginTop: '12px', background: 'hsl(var(--status-success-bg))', border: '1px solid hsl(var(--status-success-border))', borderRadius: '6px', padding: '12px 16px', fontSize: '13px' }}>
            <div style={{ fontWeight: 600, color: 'hsl(var(--status-success-fg))', marginBottom: '6px' }}>
              ✓ Imported {mappingResult.imported ?? 0} mappings, Skipped {mappingResult.skipped ?? 0} rows
            </div>
            {(mappingResult.warnings?.length ?? 0) > 0 && (
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {mappingResult.warnings.map((w: any, i: number) => (
                  <li key={i} style={{ fontSize: '12px', color: 'hsl(var(--status-warning-fg))' }}>
                    {w.row != null ? `Row ${w.row}: ` : ''}{w.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── Export ────────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>📤 Export Catalog</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Export all catalog data as a ready-to-re-import XLSX workbook with all 5 sheets.
        </p>
        <button onClick={handleExport} disabled={exporting} style={btn('hsl(var(--primary))', exporting)}>
          {exporting ? '⏳ Preparing…' : '⬇ Export All as XLSX'}
        </button>
        {exportError && (
          <div style={{ marginTop: '12px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '10px 12px', borderRadius: '6px', fontSize: '13px' }}>
            ✗ {exportError}
          </div>
        )}
      </section>

      {/* ── Template Downloads ──────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>📋 Download Templates</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Fill in these templates and upload above. IDs use format: tests = <strong>t1, t2…</strong>, parameters = <strong>p1, p2…</strong>, panels = <strong>g1, g2…</strong>.
          Leave <code style={{ fontFamily: 'monospace', background: 'hsl(var(--muted))', padding: '1px 4px', borderRadius: '3px' }}>externalId</code> blank to auto-assign the next available ID.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
          {TEMPLATES.map(t => (
            <button key={t.path} onClick={() => handleTemplateDownload(t.path)}
              style={{ padding: '10px 14px', background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'hsl(var(--foreground))', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
