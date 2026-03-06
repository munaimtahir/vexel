'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, logout } from '@/lib/auth';
import QueryProvider from '@/components/query-provider';

/** Auth guard only — no sidebar here. Sidebar lives in /lims/layout.tsx */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      logout();
      router.replace('/login');
      return;
    }
    setChecked(true);

    const interval = window.setInterval(() => {
      if (!isAuthenticated()) {
        logout();
        router.replace('/login');
      }
    }, 30_000);

    return () => window.clearInterval(interval);
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
      {children}
    </QueryProvider>
  );
}
