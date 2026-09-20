'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Compatibility URL: report status and retry are surfaced by the report flow. */
export default function LegacyPublishRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/lims/reports');
  }, [router]);

  return <p className="p-6 text-sm text-muted-foreground">Opening reports…</p>;
}
