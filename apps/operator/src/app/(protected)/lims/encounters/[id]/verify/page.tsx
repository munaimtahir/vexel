'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Compatibility URL: active verification lives under /lims/verification. */
export default function LegacyVerifyRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/lims/verification/encounters/${id}`);
  }, [id, router]);

  return <p className="p-6 text-sm text-muted-foreground">Opening verification…</p>;
}
