'use client';
import { useRef, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const TEMPLATES = [
  { label: 'Full Workbook Template (XLSX) — all sheets', path: 'workbook.xlsx', icon: '📊' },
  { label: 'Sample Types CSV', path: 'sample-types.csv', icon: '🧪' },
  { label: 'Parameters CSV', path: 'parameters.csv', icon: '📄' },
  { label: 'Tests CSV', path: 'tests.csv', icon: '📄' },
  { label: 'Test-Parameters Mapping CSV', path: 'test-parameters.csv', icon: '🔗' },
  { label: 'Panels CSV', path: 'panels.csv', icon: '📄' },
  { label: 'Panel-Tests Mapping CSV', path: 'panel-tests.csv', icon: '🔗' },
  { label: 'Reference Ranges CSV', path: 'reference-ranges.csv', icon: '📏' },
];

type JobRun = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | string;
  resultSummary?: Record<string, any> | null;
  errorSummary?: string | null;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadFile(url: string, filename: string) {
  const api = getApiClient(getToken() ?? undefined);
  const { data, error } = await api.GET(url as any, { parseAs: 'blob' } as any);
  if (error || !data) throw new Error((error as any)?.message ?? 'Download failed');
  const blob = data as Blob;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

async function pollJob(path: string, id: string, attempts = 40, delayMs = 1000): Promise<JobRun> {
  const api = getApiClient(getToken() ?? undefined);
  let last: JobRun | null = null;
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await api.GET(path as any, { params: { path: { id } } });
    if (error) throw new Error((error as any)?.message ?? 'Failed to poll job');
    last = (data as any) as JobRun;
    if (last.status === 'completed' || last.status === 'failed') return last;
    await sleep(delayMs);
  }
  if (!last) throw new Error('Job polling failed');
  return last;
}

export default function ImportExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'UPSERT_PATCH' | 'CREATE_ONLY'>('UPSERT_PATCH');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [validatePassed, setValidatePassed] = useState(false);

  const mappingFileRef = useRef<HTMLInputElement>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [mappingImporting, setMappingImporting] = useState(false);
  const [mappingResult, setMappingResult] = useState<any | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportJob, setExportJob] = useState<JobRun | null>(null);

  async function runWorkbookImport(validate: boolean) {
    if (!file) return;
    setImporting(true); setImportResult(null); setImportError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const form = new FormData();
      form.append('file', file);
      const { data, error } = await api.POST('/catalog/import/workbook' as any, {
        params: { query: { validate, mode } },
        body: form as any,
      } as any);
      if (error || !data) {
        const errMsg = (error as any)?.message ?? (error as any)?.detail ?? JSON.stringify(error) ?? 'Import failed';
        throw new Error(errMsg);
      }
      const summary = data as any;
      setImportResult(summary);
      const hasErrors = Array.isArray(summary?.errors) && summary.errors.length > 0;
      if (validate && !hasErrors) {
        setValidatePassed(true);
      } else if (validate) {
        setValidatePassed(false);
      }
    } catch (err: any) {
      setImportError(err.message ?? 'Import failed');
      if (validate) setValidatePassed(false);
    } finally {
      setImporting(false);
    }
  }

  async function handleValidate() {
    await runWorkbookImport(true);
  }

  async function handleImport() {
    if (!validatePassed) {
      setImportError('Run validate with zero errors before apply.');
      return;
    }
    await runWorkbookImport(false);
  }

  async function handleMappingImport() {
    if (!mappingFile) return;
    setMappingImporting(true); setMappingError(null); setMappingResult(null);
    try {
      const csv = await mappingFile.text();
      const api = getApiClient(getToken() ?? undefined);
      const { data, error } = await api.POST('/catalog/test-parameter-mappings/import', {
        body: { csv },
      });
      if (error || !data) throw new Error((error as any)?.message ?? 'Import failed');
      setMappingResult(data as any);
    } catch (err: any) {
      setMappingError(err.message ?? 'Import failed');
    } finally {
      setMappingImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true); setExportError(null); setExportJob(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error } = await api.POST('/catalog/export-jobs' as any, {});
      if (error || !data) throw new Error((error as any)?.message ?? 'Failed to create export job');
      const job = data as any as JobRun;
      setExportJob(job);

      const finalJob = await pollJob('/catalog/export-jobs/{id}', job.id);
      setExportJob(finalJob);
      if (finalJob.status === 'failed') throw new Error(finalJob.errorSummary ?? 'Export job failed');

      await downloadFile(
        `/catalog/export-jobs/${finalJob.id}/download`,
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
      await downloadFile(`/catalog/templates/${templatePath}`, templatePath);
    } catch (err: any) {
      alert(`Template download failed: ${err?.message ?? 'Unknown error'}`);
    }
  }

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
        Workbook validate/apply import plus job-based export and template downloads.
      </p>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>📥 Import Catalog Workbook</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Upload workbook/CSV, run validate first, then apply when validation passes.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>File (.xlsx or .csv)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.csv"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setImportResult(null); setImportError(null); setValidatePassed(false); }}
              style={{ display: 'block', padding: '7px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Mode</label>
            <select value={mode} onChange={e => { setMode(e.target.value as any); setValidatePassed(false); }}
              style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <option value="UPSERT_PATCH">UPSERT_PATCH — update existing, insert new</option>
              <option value="CREATE_ONLY">CREATE_ONLY — inserts only</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleValidate} disabled={importing || !file} style={btn('hsl(var(--status-info-fg))', importing || !file)}>
            {importing ? '⏳ Running…' : '✓ Validate'}
          </button>
          <button onClick={handleImport} disabled={importing || !file || !validatePassed} style={btn('hsl(var(--primary))', importing || !file || !validatePassed)}>
            {importing ? '⏳ Running…' : '▶ Apply'}
          </button>
        </div>

        {validatePassed && <div style={{ marginTop: '12px', fontSize: '12px', color: 'hsl(var(--status-success-fg))' }}>Validation passed. You can apply this file now.</div>}

        {importError && (
          <div style={{ marginTop: '14px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '12px 16px', borderRadius: '6px', fontSize: '13px' }}>
            ✗ {importError}
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: '14px', background: 'hsl(var(--status-success-bg))', border: '1px solid hsl(var(--status-success-border))', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, color: 'hsl(var(--status-success-fg))', marginBottom: '10px', fontSize: '14px' }}>✓ Import response</div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px', flexWrap: 'wrap' }}>
              {[
                ['Created', importResult.inserted ?? 0, 'hsl(var(--status-success-fg))'],
                ['Updated', importResult.updated ?? 0, 'hsl(var(--status-info-fg))'],
                ['Skipped', importResult.skipped ?? 0, 'hsl(var(--muted-foreground))'],
                ['Total', (importResult.inserted ?? 0) + (importResult.updated ?? 0) + (importResult.skipped ?? 0), 'hsl(var(--foreground))'],
              ].map(([label, val, color]) => (
                <div key={label as string}>
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}: </span>
                  <span style={{ fontWeight: 700, color: color as string }}>{val as number}</span>
                </div>
              ))}
            </div>
            {(importResult.errors?.length ?? 0) > 0 && (
              <ul style={{ marginTop: '10px', marginBottom: 0, paddingLeft: '18px' }}>
                {(importResult.errors as any[]).map((e, i) => (
                  <li key={i} style={{ fontSize: '12px', color: 'hsl(var(--status-warning-fg))' }}>
                    {e.sheet ? `${e.sheet} ` : ''}Row {e.row}: {e.field ? `${e.field} ` : ''}{e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>🔗 Import Parameter Mappings (CSV)</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>
          Dedicated CSV import endpoint for test-parameter mappings remains available.
        </p>
        <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Alternatively, use the TestParameters and PanelTests sheets in the job-based workbook import above.
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

      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>📤 Export Catalog (Job-Based)</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Creates an export job, waits for completion, then downloads the XLSX from `/catalog/export-jobs/{'{id}'}/download`.
        </p>
        <button onClick={handleExport} disabled={exporting} style={btn('hsl(var(--primary))', exporting)}>
          {exporting ? '⏳ Export Job Running…' : '⬇ Export All as XLSX'}
        </button>
        {exportJob && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
            Job: <code style={{ background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: '4px' }}>{exportJob.id}</code> • Status: <strong>{exportJob.status}</strong>
          </div>
        )}
        {exportError && (
          <div style={{ marginTop: '12px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '10px 12px', borderRadius: '6px', fontSize: '13px' }}>
            ✗ {exportError}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>📋 Download Templates</h2>
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Fill these templates and upload above. IDs use format: tests = <strong>t1, t2…</strong>, parameters = <strong>p1, p2…</strong>, panels = <strong>g1, g2…</strong>.
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
