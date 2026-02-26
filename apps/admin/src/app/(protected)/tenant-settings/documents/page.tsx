'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/permission-guard';
import { TenantScopeBanner } from '@/components/tenant-scope-banner';

export default function TenantDocumentsHubPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');

  return (
    <PermissionGuard anyOf={['document.generate', 'document.publish']}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenant Documents</h1>
          <p className="mt-1 text-sm text-slate-600">
            Document pipeline and publishing operations for the selected tenant. {tenantId ? `Tenant ID: ${tenantId}` : 'Current auth tenant scope is used.'}
          </p>
          <div className="mt-4">
            <TenantScopeBanner
              mode="current-auth"
              pageLabel="Tenant Documents Hub"
              tenantId={tenantId}
              note="Documents page remains scoped to current authenticated tenant/host. Explicit tenant switching is not yet implemented there."
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/documents" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Open Documents List</div>
            <p className="mt-1 text-sm text-slate-600">View document statuses and re-publish failed documents for the current authenticated tenant scope.</p>
          </Link>
          <Link href="/tenant-settings" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Back To Tenant Overview</div>
            <p className="mt-1 text-sm text-slate-600">Return to the tenant hub and open Branding / Feature Flags (explicit tenant selection supported there).</p>
          </Link>
        </div>
      </div>
    </PermissionGuard>
  );
}
