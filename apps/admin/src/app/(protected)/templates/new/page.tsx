'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Source = 'blueprint' | 'clone' | 'shell';

const FAMILIES = [
  { value: 'GENERAL_TABLE', label: 'General Table', schemaTypes: ['TABULAR'] },
  { value: 'TWO_COLUMN_TABLE', label: 'Two Column Table', schemaTypes: ['TABULAR'] },
];

const SCHEMA_TYPES = [
  { value: 'TABULAR', label: 'Tabular' },
  { value: 'DESCRIPTIVE_HEMATOLOGY', label: 'Descriptive Hematology' },
  { value: 'HISTOPATHOLOGY', label: 'Histopathology' },
  { value: 'GRAPH_SERIES', label: 'Graph Series' },
  { value: 'IMAGE_ATTACHMENT', label: 'Image Attachment' },
  { value: 'MIXED_STRUCTURED', label: 'Mixed Structured' },
];

export default function NewTemplatePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState<Source>('blueprint');
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [existingTemplates, setExistingTemplates] = useState<any[]>([]);
  const [form, setForm] = useState({
    sourceBlueprintId: '',
    sourceTemplateId: '',
    templateFamily: 'GENERAL_TABLE',
    schemaType: 'TABULAR',
    name: '',
    code: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/admin/template-blueprints' as any, {}).then((res) => {
      setBlueprints((res.data as any)?.data ?? []);
    });
    api.GET('/admin/templates' as any, { params: { query: { limit: 100, status: 'ACTIVE' } } }).then((res) => {
      setExistingTemplates((res.data as any)?.data ?? []);
    });
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const body: any = { source };
      if (source === 'blueprint') {
        body.sourceBlueprintId = form.sourceBlueprintId;
        if (form.name) body.name = form.name;
        if (form.code) body.code = form.code;
      } else if (source === 'clone') {
        body.sourceTemplateId = form.sourceTemplateId;
        if (form.name) body.name = form.name;
        if (form.code) body.code = form.code;
      } else {
        body.templateFamily = form.templateFamily;
        body.schemaType = form.schemaType;
        if (form.name) body.name = form.name;
        if (form.code) body.code = form.code;
      }
      const res = await api.POST('/admin/templates' as any, { body });
      const id = (res.data as any)?.id;
      if (id) router.push(`/templates/${id}`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create template');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Create Template</h1>
        <p className="text-sm text-muted-foreground mt-1">Step {step} of 2 — {step === 1 ? 'Choose Source' : 'Configure'}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground mb-3">How do you want to create this template?</p>
          {[
            { value: 'blueprint' as Source, label: 'From Blueprint', desc: 'Start from a system-provided starter template' },
            { value: 'clone' as Source, label: 'Clone Existing', desc: 'Copy an existing tenant template as a starting point' },
            { value: 'shell' as Source, label: 'Empty Shell', desc: 'Start from scratch with a chosen family and schema type' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${source === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
            >
              <input
                type="radio"
                name="source"
                value={opt.value}
                checked={source === opt.value}
                onChange={() => setSource(opt.value)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
            </label>
          ))}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {source === 'blueprint' && (
            <div>
              <label className="block text-sm font-medium mb-1">Blueprint</label>
              <select
                value={form.sourceBlueprintId}
                onChange={e => setForm(f => ({ ...f, sourceBlueprintId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Select a blueprint…</option>
                {blueprints.map((bp) => (
                  <option key={bp.id} value={bp.id}>{bp.name} ({bp.templateFamily})</option>
                ))}
              </select>
            </div>
          )}

          {source === 'clone' && (
            <div>
              <label className="block text-sm font-medium mb-1">Source Template</label>
              <select
                value={form.sourceTemplateId}
                onChange={e => setForm(f => ({ ...f, sourceTemplateId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Select a template to clone…</option>
                {existingTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (v{t.templateVersion}, {t.templateFamily})</option>
                ))}
              </select>
            </div>
          )}

          {source === 'shell' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Template Family</label>
                <select
                  value={form.templateFamily}
                  onChange={e => setForm(f => ({ ...f, templateFamily: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  {FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Schema Type</label>
                <select
                  value={form.schemaType}
                  onChange={e => setForm(f => ({ ...f, schemaType: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  {SCHEMA_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Name <span className="text-muted-foreground font-normal">(optional — auto-filled from source)</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. My Custom General Report"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Code <span className="text-muted-foreground font-normal">(optional — auto-generated if blank)</span></label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
              placeholder="e.g. my_general_report"
              className="w-full border rounded-md px-3 py-2 text-sm font-mono bg-background"
            />
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-md text-sm">← Back</button>
            <button
              onClick={submit}
              disabled={loading || (source === 'blueprint' && !form.sourceBlueprintId) || (source === 'clone' && !form.sourceTemplateId)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Template'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
