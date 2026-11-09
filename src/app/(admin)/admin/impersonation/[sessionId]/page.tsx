'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * **The old address, redirected** (P19.4-T2 AC-1; ADR-0206 §3). It was a second Super Admin's approval of a support
 * session to write (P4-T10). A session only looks now, so there is nothing to approve: the API's
 * `POST /admin/impersonation/:sessionId/elevate` is gone (404), and a link to this page lands on the console's
 * overview. Replaced, not pushed, so Back does not return here.
 *
 * Neither a screen nor a placeholder: it renders no data and calls no endpoint. The route registry's row says
 * *(retired → redirect)*.
 */
export default function RetiredApprovalAddress() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);
  return <PageSkeleton />;
}
