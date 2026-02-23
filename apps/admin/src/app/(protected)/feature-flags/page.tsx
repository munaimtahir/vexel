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
  'lims.verification.enabled': 'Enable verification step for LIMS results',
  'lims.verification.mode': 'Verification mode: separate worklist or inline with results',
  'lims.operator.verificationPages.enabled': 'Show verification pages in Operator UI navigation',
  'lims.operator.sample.receiveSeparate.enabled': 'Enable separate specimen receive step in sample collection',
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function loadFlags() {
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/feature-flags' as any, {});
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

  async function handleVariantSave(key: string, variantJson: string) {
    setSaving(key);
    const api = getApiClient(getToken() ?? undefined);
    await api.PUT(`/feature-flags/${key}` as any, { body: { enabled: true, variantJson } });
    await loadFlags();
    setSaving(null);
  }

  if (loading) return <p>Loading...</p>;

  const VERIFICATION_KEYS = new Set([
    'lims.verification.enabled',
    'lims.verification.mode',
    'lims.operator.verificationPages.enabled',
    'lims.operator.sample.receiveSeparate.enabled',
  ]);

  const modules = flags.filter((f) => f.key.startsWith('module.'));
  const subFeatures = flags.filter((f) => !f.key.startsWith('module.') && !VERIFICATION_KEYS.has(f.key));

  // Derive verification flags (use DB row if present, else synthetic defaults)
  function getFlag(key: string, defaultEnabled: boolean): any {
    return flags.find((f) => f.key === key) ?? { key, enabled: defaultEnabled };
  }

  const verificationEnabledFlag = getFlag('lims.verification.enabled', true);
  const verificationPagesFlag = getFlag('lims.operator.verificationPages.enabled', true);
  const receiveSeparateFlag = getFlag('lims.operator.sample.receiveSeparate.enabled', false);

  const modeFlagRaw = flags.find((f) => f.key === 'lims.verification.mode');
  let currentMode = 'separate';
  if (modeFlagRaw?.variantJson) {
    try { currentMode = JSON.parse(modeFlagRaw.variantJson).mode ?? 'separate'; } catch { /* keep default */ }
  }

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
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>Sub-Features</h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {subFeatures.map((f) => <FlagRow key={f.key} flag={f} saving={saving} onToggle={handleToggle} />)}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>Verification Workflow</h2>
        <div style={{ display: 'grid', gap: '8px' }}>
          <FlagRow
            flag={verificationEnabledFlag}
            saving={saving}
            onToggle={handleToggle}
            labelOverride="Verification Enabled"
            descriptionOverride="Enable the verification step before publishing reports. If disabled, operators can Submit & Verify in one step."
          />
          <VariantFlagRow
            flagKey="lims.verification.mode"
            label="Verification Mode"
            currentMode={currentMode}
            saving={saving}
            onSave={(mode: string) => handleVariantSave('lims.verification.mode', JSON.stringify({ mode }))}
          />
          <FlagRow
            flag={verificationPagesFlag}
            saving={saving}
            onToggle={handleToggle}
            labelOverride="Show Verification Pages in Operator UI"
            descriptionOverride="Controls whether the Verification worklist is visible in the Operator navigation."
          />
          <FlagRow
            flag={receiveSeparateFlag}
            saving={saving}
            onToggle={handleToggle}
            labelOverride="Separate Specimen Receive Step"
            descriptionOverride="Adds a separate 'Receive' tab in Sample Collection for when specimens arrive at the lab separately from collection."
          />
        </div>

        {currentMode === 'disabled' && (
          <div style={{ marginTop: '12px', padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1d4ed8', fontSize: '13px' }}>
            ℹ️ With verification disabled, operators will verify from the Results Entry screen. The Verification worklist will be hidden.
          </div>
        )}
        {currentMode === 'inline' && (
          <div style={{ marginTop: '12px', padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1d4ed8', fontSize: '13px' }}>
            ℹ️ With inline verification, operators can verify directly from Results Entry. The Verification worklist remains accessible.
          </div>
        )}
      </section>
    </div>
  );
}

function FlagRow({ flag, saving, onToggle, labelOverride, descriptionOverride }: {
  flag: any;
  saving: string | null;
  onToggle: (key: string, enabled: boolean) => void;
  labelOverride?: string;
  descriptionOverride?: string;
}) {
  return (
    <div style={{ background: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {labelOverride
            ? <span style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{labelOverride}</span>
            : null}
          <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '13px' }}>{flag.key}</code>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
          {descriptionOverride ?? FLAG_DESCRIPTIONS[flag.key] ?? flag.description ?? ''}
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

const MODE_OPTIONS = [
  { value: 'separate', label: 'Separate — Operators submit, verifiers verify in dedicated worklist' },
  { value: 'inline', label: 'Inline — Operators can Submit & Verify from results entry screen' },
  { value: 'disabled', label: 'Disabled — No verification step; Submit & Verify shown on results entry' },
];

function VariantFlagRow({ flagKey, label, currentMode, saving, onSave }: {
  flagKey: string;
  label: string;
  currentMode: string;
  saving: string | null;
  onSave: (mode: string) => void;
}) {
  const modeDescriptions: Record<string, string> = {
    separate: 'Operators submit results; a dedicated verifier reviews and approves in a separate worklist.',
    inline: 'Operators can submit and verify results in one step from the results entry screen.',
    disabled: 'No verification step. Operators submit results and they are published immediately.',
  };

  return (
    <div style={{ background: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>{label}</span>
          <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '13px' }}>{flagKey}</code>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
          {modeDescriptions[currentMode] ?? FLAG_DESCRIPTIONS[flagKey] ?? ''}
        </p>
      </div>
      <select
        value={currentMode}
        disabled={saving === flagKey}
        onChange={(e) => onSave(e.target.value)}
        style={{
          padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
          fontSize: '13px', color: '#1e293b', background: 'white',
          cursor: saving === flagKey ? 'wait' : 'pointer',
          minWidth: '220px',
        }}
        aria-label={`Select ${flagKey}`}
      >
        {MODE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
