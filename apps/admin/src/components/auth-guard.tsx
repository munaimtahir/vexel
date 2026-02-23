'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getToken } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    // Simple token check — if token exists and isAuthenticated(), allow access
    if (!isAuthenticated()) {
      router.replace('/login');
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
