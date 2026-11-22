'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { platformHref } from '@/lib/platform';

/**
 * **`/admin/platform` opens on its first section** (P19.23-T6; frame f52): the console's *Platform* item lands here, and
 * the page is *Audit log*. Replaced, not pushed, so Back does not return to an address that only forwards.
 */
export default function PlatformIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(platformHref('audit'));
  }, [router]);
  return <PageSkeleton />;
}
