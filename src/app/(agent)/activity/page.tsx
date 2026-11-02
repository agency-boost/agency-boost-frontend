'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';

/**
 * `/activity` hands off to `/activity/log`, as the route registry has said since Phase 6
 * (P10.1-T2 AC-8). Nothing links here — the sidebar's *Activity management* points straight at
 * the log — so this answers a typed or remembered URL, which answered 404 until 2026-10-01.
 *
 * The same shape as the root landing (`app/page.tsx`): a client-side `replace` from inside the
 * group's layout, so the sidebar stays mounted and nothing blinks, and a skeleton rather than
 * content, because two screens claiming to be the log would mean the one you saw depended on how
 * fast the redirect ran. `replace`, not `push`: Back from the log must not land on a page whose
 * only act is to leave again. No wait on the session, because the group's `RequireSession` has
 * already settled it before anything beneath it mounts.
 *
 * Neither a screen nor a placeholder: it renders no data, calls no endpoint and shows no sign.
 * `scripts/lib/screens.py` reads it as live, and the manual map's `/activity` *(redirect)* row
 * names the log's chapters, which is where its reader ends up.
 */
export default function ActivityIndex() {
  const t = useMessages(activityMessages);
  const router = useRouter();

  useEffect(() => {
    router.replace('/activity/log');
  }, [router]);

  return <PageSkeleton label={t.takingYou({ tab: t.dashboard.logActivity })} />;
}
