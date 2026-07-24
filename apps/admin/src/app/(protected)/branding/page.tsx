'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { TenantScopeBanner } from '@/components/tenant-scope-banner';

const HEADER_LAYOUTS = [
  { value: 'default', label: 'Default — Logo left, name centered, address right' },
  { value: 'classic', label: 'Classic — Logo left, name + address right' },
  { value: 'minimal', label: 'Minimal — Text only, name + address centered' },
];

const FOOTER_LAYOUTS = [
  { value: 'text', label: 'Text only' },
  { value: 'image', label: 'Image only' },
  { value: 'both', label: 'Both — image above text' },
];

const RECEIPT_LAYOUTS = [
  { value: 'a4', label: 'A4 — Dual copy (patient + office) on one A4 sheet' },
  { value: 'thermal', label: 'Thermal — 80mm roll (coming soon)' },
];

const inputClass =
  'w-full box-border px-2.5 py-2 border border-border rounded-md text-[13px] bg-background text-foreground';
const selectClass = `${inputClass} cursor-pointer`;
const labelClass = 'block text-[13px] font-medium mb-1.5 text-foreground';
const hintClass = 'text-[11px] text-muted-foreground mt-1';
const sectionClass = 'bg-card px-6 py-5 rounded-lg shadow-sm mb-4';
const sectionTitleClass = 'text-sm font-bold text-foreground mb-4 pb-2 border-b border-border';

function Field({ label, hint, value, onChange, placeholder, type = 'text' }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="mb-3.5">
      <label className={labelClass}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={2}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={inputClass}
        />
      )}
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

function Select({ label, hint, value, onChange, options }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="mb-3.5">
      <label className={labelClass}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={selectClass}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

export default function BrandingPage() {
  const searchParams = useSearchParams();
  const qTenantId = searchParams.get('tenantId');
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [cfg, setCfg] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: string) => (val: string) => setCfg((c: any) => ({ ...c, [key]: val }));
  const get = (key: string, def = '') => cfg[key] ?? def;

  useEffect(() => {
    async function init() {
      const api = getApiClient(getToken() ?? undefined);
      const [meRes, tenantsRes] = await Promise.all([api.GET('/me'), api.GET('/tenants')]);
      const myTenantId = meRes.data?.tenantId ?? '';
      const all: any[] = (tenantsRes.data as any)?.data ?? [];
      setTenants(all);
      setTenantId(qTenantId ?? myTenantId ?? all[0]?.id ?? '');
    }
    init();
  }, [qTenantId]);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/tenants/{tenantId}/config' as any, { params: { path: { tenantId } } })
      .then(({ data }) => { setCfg(data ?? {}); setLoading(false); });
  }, [tenantId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    const api = getApiClient(getToken() ?? undefined);
    await api.PATCH('/tenants/{tenantId}/config' as any, { params: { path: { tenantId } }, body: cfg });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const selectedTenant = tenants.find(t => t.id === tenantId);

  return (
    <div className="max-w-[680px]">
      <h1 className="text-[22px] font-bold mb-1 text-foreground">
        Branding &amp; PDF Layout
      </h1>
      <p className="text-[13px] text-muted-foreground mb-5">
        Configure how your lab name, logo, and document layouts appear on printed receipts and lab reports.
      </p>

      {tenants.length > 1 && (
        <div className="mb-4 flex items-center gap-2.5">
          <label className="text-[13px] text-muted-foreground">Tenant:</label>
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} className={`${selectClass} w-auto`}>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      {selectedTenant && (
        <p className="text-[13px] text-muted-foreground mb-4">
          Configuring: <strong>{selectedTenant.name}</strong>
        </p>
      )}
      <div className="mb-4">
        <TenantScopeBanner
          mode="explicit"
          pageLabel="Branding & Config"
          tenantId={tenantId}
          tenantName={selectedTenant?.name}
          note="This page reads and saves /tenants/{tenantId}/config for the selected tenant."
        />
      </div>

      {loading ? <p>Loading...</p> : (
        <form onSubmit={handleSave}>
          {/* ── General Branding ─────────────────────────────── */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>🏥 General Branding</p>
            <Field label="Lab / Brand Name" value={get('brandName')} onChange={set('brandName')}
              placeholder="e.g. City Diagnostics Lab" />
            <Field label="Logo URL" value={get('logoUrl')} onChange={set('logoUrl')}
              placeholder="https://..." hint="Used in both lab report and receipt headers when logo layout is selected." />
            <Field label="Primary Color" value={get('primaryColor')} onChange={set('primaryColor')}
              placeholder="e.g. brand-primary-blue" hint="Used in the web app UI (not in PDFs)." />
            {get('primaryColor') && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <div className="w-5 h-5 rounded border border-border" style={{ background: get('primaryColor') }} />
                Preview: {get('primaryColor')}
              </div>
            )}
            <Field label="App Header Text" value={get('headerText')} onChange={set('headerText')}
              hint="Displayed in the web app header bar." />
            <Field label="App Footer Text" value={get('footerText')} onChange={set('footerText')}
              hint="Displayed in the web app footer." />
          </div>

          {/* ── Lab Report — Header ────────────────────────────── */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>📋 Lab Report — Header</p>
            <Field label="Address / Contact Line" value={get('reportHeader')} onChange={set('reportHeader')}
              placeholder="123 Main St, Karachi | 021-111-2222"
              hint="Printed below the lab name in the report header." type="textarea" />
            <Select label="Header Layout"
              value={get('reportHeaderLayout', 'default')} onChange={set('reportHeaderLayout')}
              options={HEADER_LAYOUTS}
              hint="Controls how the logo, lab name, and address are arranged at the top of each page." />
          </div>

          {/* ── Lab Report — Footer ────────────────────────────── */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>📋 Lab Report — Footer</p>
            <Field label="Footer Text" value={get('reportFooter')} onChange={set('reportFooter')}
              placeholder="Results are valid for 30 days. Verified by Pathologist."
              type="textarea"
              hint="Printed at the bottom of every report page." />
            <Field label="Footer Image URL" value={get('reportFooterImageUrl')} onChange={set('reportFooterImageUrl')}
              placeholder="https://... (stamp, signature, or logo image)"
              hint="Optional image shown in the footer (e.g. pathologist stamp)." />
            <Select label="Footer Layout"
              value={get('reportFooterLayout', 'text')} onChange={set('reportFooterLayout')}
              options={FOOTER_LAYOUTS}
              hint="Choose whether to show text, image, or both in the footer." />
          </div>

          {/* ── Receipt — Header ──────────────────────────────── */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>🧾 Receipt — Header</p>
            <p className="text-xs text-muted-foreground mb-3">
              The receipt uses the same <strong>lab name</strong>, <strong>logo</strong>, and <strong>address</strong> as the lab report.
              Choose a layout style below.
            </p>
            <Select label="Receipt Header Layout"
              value={get('receiptHeaderLayout', 'default')} onChange={set('receiptHeaderLayout')}
              options={HEADER_LAYOUTS}
              hint="Controls how branding appears at the top of each receipt copy." />
          </div>

          {/* ── Receipt — Footer ──────────────────────────────── */}
          <div className={sectionClass}>
            <p className={sectionTitleClass}>🧾 Receipt — Footer</p>
            <p className="text-xs text-muted-foreground mb-3">
              The receipt uses the same <strong>footer text</strong> and <strong>footer image</strong> as the lab report.
              Set the content in the Lab Report footer section above, then choose the layout here.
            </p>
            <Select label="Receipt Footer Layout"
              value={get('receiptFooterLayout', 'text')} onChange={set('receiptFooterLayout')}
              options={FOOTER_LAYOUTS}
              hint="Choose whether to show text, image, or both in the receipt footer." />
            <Select label="Receipt Paper Format"
              value={get('receiptLayout', 'a4')} onChange={set('receiptLayout')}
              options={RECEIPT_LAYOUTS}
              hint="A4 prints two copies (patient + office) on one sheet, separated by a cut line." />
          </div>

          {/* ── Save ─────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mt-2">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-primary text-primary-foreground border-none rounded-md cursor-pointer text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && <span className="text-[hsl(var(--status-success-fg))] text-sm">✓ Saved successfully</span>}
          </div>
        </form>
      )}
    </div>
  );
}
