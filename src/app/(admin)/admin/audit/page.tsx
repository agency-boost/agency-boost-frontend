'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageSkeleton } from '@/components/ui/skeleton';
import { platformHref } from '@/lib/platform';

/**
 * **The old address, redirected** (P19.23-T6 AC-1; ADR-0279): the audit log moved under *Platform*, to
 * `/admin/platform/audit`. Links still name this one — *Perubahan oleh pengelola*'s `?kpmId=&actorUserId=&action=` — so
 * the query goes with it. Replaced, not pushed, so Back does not return here. Renders no data and calls no endpoint.
 */
export default function MovedAuditAddress() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Forward />
    </Suspense>
  );
}

function Forward() {
  const router = useRouter();
  const query = useSearchParams()?.toString() ?? '';
  useEffect(() => {
    router.replace(query ? `${platformHref('audit')}?${query}` : platformHref('audit'));
  }, [router, query]);
  return <PageSkeleton />;
}
