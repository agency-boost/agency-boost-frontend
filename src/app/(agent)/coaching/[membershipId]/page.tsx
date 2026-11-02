'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';

/**
 * `/coaching/{membershipId}` opens the person on their *Coaching Session* tab, as the prototype's
 * *Coaching →* does (`Overall.html:10661`; `functional/coaching.md`, *The screens*).
 *
 * The `/activity` idiom: a client-side `replace` from inside the layout, so the person shell stays
 * mounted and nothing blinks, and a skeleton rather than content while it runs. `replace`, not `push`:
 * Back from the tab must not land on a page whose only act is to leave again.
 *
 * Neither a screen nor a placeholder: it renders no data, calls no endpoint and shows no sign.
 * `scripts/lib/screens.py` reads it as live, and the manual map's row for it names the chapter of the
 * tab its reader ends up on.
 */
export default function CoachingPersonIndex({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  const router = useRouter();
  const t = useMessages(coachingMessages).pages;

  useEffect(() => {
    router.replace(`/coaching/${encodeURIComponent(membershipId)}/session`);
  }, [router, membershipId]);

  return <SkeletonCards count={2} label={t.opening} />;
}
