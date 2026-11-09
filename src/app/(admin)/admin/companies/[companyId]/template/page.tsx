'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { redirectTarget } from '@/lib/template-sections';

/**
 * **The old address, redirected** (ADR-0185 §2; P18.11-T20 AC-6). It held one template behind a select and nine tabs;
 * a bookmark, a manual or a pasted link that names it lands where its content lives now. Read in the browser, because
 * the hash never reaches the server; replaced, not pushed, so Back does not return here.
 */
export default function OldTemplateAddress({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(redirectTarget(companyId, window.location.search, window.location.hash));
  }, [companyId, router]);
  return <PageSkeleton />;
}
