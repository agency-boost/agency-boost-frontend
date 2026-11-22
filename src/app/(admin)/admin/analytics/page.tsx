'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * **The old address, redirected** (P19.23-T1 AC-4; ADR-0277 §1). *Cross-platform analytics* is replaced by the Dashboard's
 * *Adopsi per KPM* (`/admin`): company first, its KPMs beneath, *Pernah pakai · Pakai 14 hari terakhir · Power user* for
 * *Semua · Leader · Agent*. A bookmark or a manual that names this address lands there. Replaced, not pushed, so Back does
 * not return here.
 *
 * Neither a screen nor a placeholder: it renders no data and calls no endpoint. The route registry's row says
 * *(retired → redirect)*.
 */
export default function RetiredAnalyticsAddress() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);
  return <PageSkeleton />;
}
