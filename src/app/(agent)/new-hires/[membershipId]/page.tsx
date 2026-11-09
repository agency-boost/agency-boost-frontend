'use client';

import { use, useEffect, useState } from 'react';
import { NewHireDetail } from '@/components/new-hires';
import { Page } from '@/components/page';
import { newHiresHref, newHireYearFrom } from '@/lib/activation';

/**
 * One hire's activation, as a leader reads it (`/new-hires/[membershipId]`, `Overall.html:3363-3416`;
 * P13-T5, T6). Its title is the hire's name, which only the read knows, so the detail draws its own
 * header. Gated by `activation:read`; the API answers a hire outside the reader's reach 404.
 *
 * **Every reader's row on New Hires opens here** (P19.9-T3 AC-4; ADR-0233, the owner's R4), with the roster's year in
 * the address (`?year=previous`), so ‹ goes back to that year — read once when the page opens, as the coaching shell
 * reads its `?from=` (`backFrom`); nothing on the page changes it.
 */
export default function NewHireDetailPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  const [backHref, setBackHref] = useState(newHiresHref('current'));
  useEffect(() => {
    setBackHref(newHiresHref(newHireYearFrom(new URLSearchParams(window.location.search).get('year'))));
  }, [membershipId]);
  return (
    <Page permission="activation:read">
      <NewHireDetail membershipId={membershipId} backHref={backHref} />
    </Page>
  );
}
