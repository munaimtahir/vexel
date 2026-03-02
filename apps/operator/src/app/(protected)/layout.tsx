'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import QueryProvider from '@/components/query-provider';
import { ImpersonationBanner } from '@/components/impersonation-banner';

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
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <QueryProvider>
      <ImpersonationBanner />
      {children}
    </QueryProvider>
  );
}
