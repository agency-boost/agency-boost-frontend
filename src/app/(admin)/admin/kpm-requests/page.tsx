'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * **The old address, redirected** (P19.23-T3 AC-2; ADR-0277). *Pending KPM requests* is one of the two queues
 * *Persetujuan* (`/admin/approvals`) now lists with the leaders past the limit; a bookmark, a manual or a notification
 * that names this address lands there. Replaced, not pushed, so Back does not return here.
 *
 * Neither a screen nor a placeholder: it renders no data and calls no endpoint. The route registry's row says
 * *(retired → redirect)*.
 */
export default function RetiredKpmRequestsAddress() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/approvals');
  }, [router]);
  return <PageSkeleton />;
}
