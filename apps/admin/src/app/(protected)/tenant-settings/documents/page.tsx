'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/permission-guard';

function q(path: string, tenantId: string | null) {
  return tenantId ? `${path}?tenantId=${encodeURIComponent(tenantId)}` : path;
}

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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href={q('/documents', tenantId)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Open Documents List</div>
            <p className="mt-1 text-sm text-slate-600">View document statuses and re-publish failed documents.</p>
          </Link>
          <Link href={q('/tenant-settings', tenantId)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Back To Tenant Overview</div>
            <p className="mt-1 text-sm text-slate-600">Manage branding and feature flags that affect generated documents.</p>
          </Link>
        </div>
      </div>
    </PermissionGuard>
  );
}

