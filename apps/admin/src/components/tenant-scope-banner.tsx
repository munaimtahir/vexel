'use client';

type TenantScopeBannerProps = {
  tenantId?: string | null;
  tenantName?: string | null;
  mode: 'explicit' | 'current-auth';
  pageLabel?: string;
  note?: string;
};

export function TenantScopeBanner({
  tenantId,
  tenantName,
  mode,
  pageLabel,
  note,
}: TenantScopeBannerProps) {
  const explicit = mode === 'explicit';

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${
      explicit ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'
    }`}>
      <div className="font-medium">
        Tenant Scope {pageLabel ? `• ${pageLabel}` : ''}
      </div>
      <div className="mt-1 text-xs">
        {explicit
          ? 'This page supports explicit tenant selection.'
          : 'This page uses the current authenticated tenant/host scope (no tenantId query switching).'}
        {' '}
        {tenantName ? <>Current: <strong>{tenantName}</strong></> : tenantId ? <>Tenant ID: <code>{tenantId}</code></> : 'Tenant resolved from current session/host.'}
      </div>
      {note && <div className="mt-1 text-xs opacity-90">{note}</div>}
    </div>
  );
}

