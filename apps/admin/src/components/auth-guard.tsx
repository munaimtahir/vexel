'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, logout } from '@/lib/auth';

/**
 * AuthGuard — client hydration guard only.
 * Real auth protection is handled by middleware.ts (server-side).
 * This prevents a brief flash before hydration completes.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      logout();
      router.replace('/login');
      return;
    }

    setReady(true);

    const interval = window.setInterval(() => {
      if (!isAuthenticated()) {
        logout();
        router.replace('/login');
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
