'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Compatibility URL: active result entry lives under /lims/results. */
export default function LegacyResultsRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/lims/results/encounters/${id}`);
  }, [id, router]);

  return <p className="p-6 text-sm text-muted-foreground">Opening result entry…</p>;
}
