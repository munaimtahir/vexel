'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/permission-guard';

export default function TenantCatalogHubPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');

  return (
    <PermissionGuard anyOf={['catalog.read', 'catalog.manage', 'catalog.write']}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenant Catalog & Pricing</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tenant-owned catalog configuration entry point. {tenantId ? `Tenant ID: ${tenantId}` : 'Current auth tenant scope is used.'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { href: '/catalog', label: 'Catalog Overview', desc: 'Stats and module shortcuts' },
            { href: '/catalog/tests', label: 'Tests', desc: 'Tests and pricing fields' },
            { href: '/catalog/panels', label: 'Panels', desc: 'Panel/group definitions' },
            { href: '/catalog/parameters', label: 'Parameters', desc: 'Result parameters' },
            { href: '/catalog/reference-ranges', label: 'Reference Ranges', desc: 'Age/gender ranges' },
            { href: '/catalog/import-export', label: 'Import / Export', desc: 'XLSX bulk operations' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
              <div className="text-base font-semibold text-slate-900">{item.label}</div>
              <p className="mt-1 text-sm text-slate-600">{item.desc} (current authenticated tenant scope)</p>
            </Link>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
