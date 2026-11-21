'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * **The old address, redirected** (P19.23-T2 AC-3; ADR-0277 §3). *KPM baru* is a sheet on the KPM list now — four fields,
 * the code made automatically, the Owner invited by WhatsApp — where the three-step page was; a bookmark or a manual
 * that names this address opens it there (`/admin/tenants?baru=1`). Replaced, not pushed, so Back does not return here.
 *
 * Neither a screen nor a placeholder: it renders no data and calls no endpoint.
 */
export default function RetiredNewKpmAddress() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/tenants?baru=1');
  }, [router]);
  return <PageSkeleton />;
}
