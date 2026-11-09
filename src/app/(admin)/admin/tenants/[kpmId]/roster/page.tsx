'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * **The old address, redirected** (P19.4-T2 AC-3, AC-8; UI-151, Overview case 10; ADR-0206 §6). *Impor roster* was the
 * Super Admin's import into any office; the people are the KPM's now, and its Owner or an Admin imports them on
 * `/people/import`. A bookmark, a manual or a pasted link that names it lands on the KPM's page, which says who adds
 * the members — with no link to an import. Replaced, not pushed, so Back does not return here.
 *
 * Neither a screen nor a placeholder: it renders no data and calls no endpoint. The route registry's row says
 * *(retired → redirect)*.
 */
export default function RetiredRosterAddress({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/admin/tenants/${encodeURIComponent(kpmId)}`);
  }, [kpmId, router]);
  return <PageSkeleton />;
}
