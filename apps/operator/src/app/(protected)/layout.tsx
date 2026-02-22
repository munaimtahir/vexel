'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getToken } from '@/lib/auth';
import Sidebar from '@/components/sidebar';
import QueryProvider from '@/components/query-provider';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
    );
  }

  return (
    <QueryProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar currentPath={pathname} />
        <main style={{ flex: 1, padding: '32px', background: '#f8fafc', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </QueryProvider>
  );
}
