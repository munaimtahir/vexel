'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, decodeJwt } from '@/lib/auth';
import QueryProvider from '@/components/query-provider';

/** Auth guard only — no sidebar here. Sidebar lives in /lims/layout.tsx */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    const payload = decodeJwt(token);
    const hasAccess = payload?.isSuperAdmin || payload?.permissions?.includes('module.operator');
    if (!hasAccess) {
      router.replace('/login?error=no_operator_access');
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <QueryProvider>{children}</QueryProvider>;
}
