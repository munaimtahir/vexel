'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Compatibility URL: specimen commands are handled by the central worklist. */
export default function LegacyReceiveRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/lims/sample-collection');
  }, [router]);

  return <p className="p-6 text-sm text-muted-foreground">Opening sample collection…</p>;
}
