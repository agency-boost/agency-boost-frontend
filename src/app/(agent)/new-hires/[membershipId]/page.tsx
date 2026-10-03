'use client';

import { use } from 'react';
import { NewHireDetail } from '@/components/new-hires';
import { Page } from '@/components/page';

/**
 * One hire's activation, as a leader reads it (`/new-hires/[membershipId]`, `Overall.html:3363-3416`;
 * P13-T5, T6). Its title is the hire's name, which only the read knows, so the detail draws its own
 * header. Gated by `activation:read`; the API answers a hire outside the reader's reach 404.
 */
export default function NewHireDetailPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  return (
    <Page permission="activation:read">
      <NewHireDetail membershipId={membershipId} />
    </Page>
  );
}
