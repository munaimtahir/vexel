'use client';

import type { ReactNode } from 'react';
import { useCurrentUser } from '@/lib/use-auth';
import { hasAllPermissions, hasAnyPermission, type CurrentAdminUser } from '@/lib/rbac';

type PermissionGuardProps = {
  anyOf?: string[];
  allOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
  user?: CurrentAdminUser;
  loading?: boolean;
};

function DefaultDenied({ anyOf, allOf }: { anyOf?: string[]; allOf?: string[] }) {
  const needed = allOf?.length ? allOf : anyOf;
  return (
    <div className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-xl font-semibold text-amber-900">403: Permission Required</h1>
      <p className="mt-2 text-sm text-amber-800">
        You do not have access to this page.
        {needed?.length ? ` Required: ${needed.join(', ')}` : ''}
      </p>
    </div>
  );
}

export function PermissionGuard({ anyOf, allOf, children, fallback, user: userProp, loading: loadingProp }: PermissionGuardProps) {
  const auth = useCurrentUser();
  const user = userProp === undefined ? auth.user : userProp;
  const loading = loadingProp === undefined ? auth.loading : loadingProp;

  if (loading) {
    return <div className="p-2 text-sm text-slate-600">Loading permissions...</div>;
  }

  const allowed = hasAnyPermission(user, anyOf) && hasAllPermissions(user, allOf);
  if (!allowed) return <>{fallback ?? <DefaultDenied anyOf={anyOf} allOf={allOf} />}</>;

  return <>{children}</>;
}

