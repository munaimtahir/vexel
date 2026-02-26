'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFeatureFlags, isVerificationVisible } from '@/hooks/use-feature-flags';

/**
 * Route guard: if lims.verification.enabled is OFF, redirect to results entry.
 * This prevents direct navigation to /lims/verification/* when the feature is disabled.
 */
export default function VerificationLayout({ children }: { children: React.ReactNode }) {
  const { flags, loading } = useFeatureFlags();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isVerificationVisible(flags)) {
      router.replace('/lims/results');
    }
  }, [flags, loading, router]);

  if (loading) return null;
  if (!isVerificationVisible(flags)) return null;

  return <>{children}</>;
}
