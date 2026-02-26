'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { TenantScopeBanner } from '@/components/tenant-scope-banner';

export default function CatalogPage() {
  const [stats, setStats] = useState<{ params: number; tests: number; panels: number } | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const api = getApiClient(getToken() ?? undefined);
        const [pRes, tRes, panRes] = await Promise.allSettled([
          api.GET('/catalog/parameters' as any, { params: { query: { limit: 1 } } }),
          api.GET('/catalog/tests' as any, { params: { query: { limit: 1 } } }),
          api.GET('/catalog/panels' as any, { params: { query: { limit: 1 } } }),
        ]);
        setStats({
          params: pRes.status === 'fulfilled' ? ((pRes.value.data as any)?.total ?? 0) : 0,
          tests: tRes.status === 'fulfilled' ? ((tRes.value.data as any)?.total ?? 0) : 0,
          panels: panRes.status === 'fulfilled' ? ((panRes.value.data as any)?.total ?? 0) : 0,
        });
      } catch { /* stats optional */ }
    }
    loadStats();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>Catalog</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '24px', fontSize: '14px' }}>Manage lab tests, parameters, panels, and bulk import/export.</p>
      <div style={{ marginBottom: '16px' }}>
        <TenantScopeBanner mode="current-auth" pageLabel="Catalog" note="Catalog pages are scoped to the current authenticated tenant/host." />
      </div>

      {/* Quick stats */}
      {stats && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Parameters', value: stats.params, color: 'hsl(var(--primary))', bg: 'hsl(var(--status-info-bg))' },
            { label: 'Tests', value: stats.tests, color: 'hsl(var(--primary))', bg: 'hsl(var(--status-info-bg))' },
            { label: 'Panels', value: stats.panels, color: 'hsl(var(--status-success-fg))', bg: 'hsl(var(--status-success-bg))' },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: '8px', padding: '14px 20px', minWidth: '120px' }}>
              <div style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: s.color, opacity: 0.8, marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '640px' }}>
        {[
          { href: '/catalog/tests', label: 'Tests', icon: '🧬', desc: 'Lab test catalog' },
          { href: '/catalog/parameters', label: 'Parameters', icon: '📐', desc: 'Result parameters' },
          { href: '/catalog/panels', label: 'Panels', icon: '📋', desc: 'Test panels / profiles' },
          { href: '/catalog/import-export', label: 'Import / Export', icon: '⬆️', desc: 'Bulk import & XLSX export' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ display: 'block', padding: '20px', background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', textDecoration: 'none', color: 'inherit', border: '1px solid hsl(var(--muted))' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{item.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>{item.label}</div>
            <div style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginTop: '4px' }}>{item.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
