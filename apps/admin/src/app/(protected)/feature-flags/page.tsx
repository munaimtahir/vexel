'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const FLAG_DESCRIPTIONS: Record<string, string> = {
  'module.lims': 'LIMS core module — enables laboratory workflow',
  'module.printing': 'Printing module — allows report printing',
  'module.rad': 'Radiology (RAD) scaffold',
  'module.opd': 'OPD (Outpatient) scaffold',
  'module.ipd': 'IPD (Inpatient) scaffold',
  'lims.auto_verify': 'Auto-verify LIMS results without manual review',
  'lims.print_results': 'Allow printing results directly from LIMS',
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function loadFlags() {
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/feature-flags' as any);
    setFlags((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadFlags(); }, []);

  async function handleToggle(key: string, enabled: boolean) {
    setSaving(key);
    const api = getApiClient(getToken() ?? undefined);
    await api.PUT(`/feature-flags/${key}` as any, { body: { enabled } });
    await loadFlags();
    setSaving(null);
  }

  if (loading) return <p>Loading...</p>;

  const modules = flags.filter((f) => f.key.startsWith('module.'));
  const subFeatures = flags.filter((f) => !f.key.startsWith('module.'));

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Feature Flags</h1>
      <p style={{ color: '#64748b', marginBottom: '32px' }}>Control which modules and features are active for this tenant.</p>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>Module Toggles</h2>
        <div style={{ display: 'grid', gap: '8px' }}>
          {modules.map((f) => <FlagRow key={f.key} flag={f} saving={saving} onToggle={handleToggle} />)}
        </div>
      </section>

      {subFeatures.length > 0 && (
        <section>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>Sub-Features</h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {subFeatures.map((f) => <FlagRow key={f.key} flag={f} saving={saving} onToggle={handleToggle} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function FlagRow({ flag, saving, onToggle }: any) {
  return (
    <div style={{ background: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '13px' }}>{flag.key}</code>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
          {FLAG_DESCRIPTIONS[flag.key] ?? flag.description ?? ''}
        </p>
      </div>
      <button
        onClick={() => onToggle(flag.key, !flag.enabled)}
        disabled={saving === flag.key}
        style={{
          width: '48px', height: '26px', borderRadius: '13px',
          background: flag.enabled ? '#22c55e' : '#d1d5db',
          border: 'none', cursor: saving === flag.key ? 'wait' : 'pointer',
          transition: 'background 0.2s', position: 'relative',
        }}
        aria-label={`Toggle ${flag.key}`}
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: flag.enabled ? '25px' : '3px',
          width: '20px', height: '20px', borderRadius: '50%',
          background: 'white', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}
