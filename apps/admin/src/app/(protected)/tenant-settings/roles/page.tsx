'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/permission-guard';

export default function TenantRolesHubPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');

  return (
    <PermissionGuard anyOf={['role.read']}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenant Roles</h1>
          <p className="mt-1 text-sm text-slate-600">
            RBAC role definitions for the selected tenant. {tenantId ? `Tenant ID: ${tenantId}` : 'Current auth tenant scope is used.'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/roles" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Open Roles</div>
            <p className="mt-1 text-sm text-slate-600">Create/edit roles for the current authenticated tenant scope.</p>
          </Link>
          <Link href={tenantId ? `/tenant-settings/users?tenantId=${tenantId}` : '/tenant-settings/users'} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Back To Tenant Users</div>
            <p className="mt-1 text-sm text-slate-600">Assign these roles to tenant users.</p>
          </Link>
        </div>
      </div>
    </PermissionGuard>
  );
}
