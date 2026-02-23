'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getToken, decodeJwt } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    const payload = decodeJwt(token);
    const hasAccess = payload?.isSuperAdmin || payload?.permissions?.includes('module.admin');

    if (!hasAccess) {
      // If they are logged in but don't have admin access, maybe they are an operator?
      // For now just show error or redirect to a "no access" page.
      if (payload?.permissions?.includes('module.operator')) {
        // Redirect to operator app if possible, or just error
        router.replace('/login?error=no_admin_access');
      } else {
        router.replace('/login?error=unauthorized');
      }
      return;
    }

    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p>Verifying access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
