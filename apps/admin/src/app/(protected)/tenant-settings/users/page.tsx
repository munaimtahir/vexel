'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/permission-guard';

export default function TenantUsersHubPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');

  return (
    <PermissionGuard anyOf={['user.read']}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenant Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tenant-scoped user management entry point. {tenantId ? `Tenant ID: ${tenantId}` : 'No tenant selected from hub; current auth tenant will apply.'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/users" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Open Users List</div>
            <p className="mt-1 text-sm text-slate-600">Create, edit, enable/disable users for the current authenticated tenant scope.</p>
          </Link>
          <Link href={tenantId ? `/tenant-settings/roles?tenantId=${tenantId}` : '/tenant-settings/roles'} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-lg font-semibold text-slate-900">Go To Tenant Roles</div>
            <p className="mt-1 text-sm text-slate-600">Manage role definitions and permissions used by these users.</p>
          </Link>
        </div>
      </div>
    </PermissionGuard>
  );
}
