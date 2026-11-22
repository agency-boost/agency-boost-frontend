'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * **The old address, redirected** (P19.27-T3 AC-4; UI-212 (21 Nov); ADR-0285 §4). *Ganti Owner* was a page of its own,
 * replacing **the** Owner; a KPM has one or more owners now, added and removed in *KPM Owner · n* on the KPM's page —
 * changing the owner is adding the new one, then removing the old. A bookmark, a manual or a pasted link that names it
 * lands on that section (`#owners`). Replaced, not pushed, so Back does not return here.
 *
 * Neither a screen nor a placeholder: it renders no data and calls no endpoint. The route registry's row says *(retired
 * → redirect)*.
 */
export default function RetiredOwnerAddress({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/tenants/${encodeURIComponent(kpmId)}#owners`);
  }, [kpmId, router]);
  return <PageSkeleton />;
}
