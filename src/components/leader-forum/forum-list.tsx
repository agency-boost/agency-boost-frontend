'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  defaultMeetingTitle, filterMeetings, FORUM_COPY, readMeetings, type MeetingFilter, type MeetingListView,
} from '@/lib/leader-meetings';
import { useSession } from '@/lib/session';
import { ListSkeleton, LoadError, NotFound } from './forum-states';
import { MeetingCardRow } from './meeting-card';
import { MeetingDialog } from './meeting-dialog';
import { signInAndReturn } from './meeting-screen';

const FILTERS: readonly MeetingFilter[] = ['all', 'upcoming', 'past'];

/**
 * **The list** (`/leader-meetings`, `:2002-2013`, `:2588-2630`; *The list*): the list's own line, the filter
 * *All* · *Upcoming* · *Past* over the one read, *+ New meeting* beside it for whoever may make one, and a
 * card per meeting, newest first. A member the server does not let read the forum is answered `404`, and
 * meets the not-found state.
 */
export function ForumList() {
  const { me, loading, signedOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = !loading && me !== null;
  const [view, setView] = useState<MeetingListView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<MeetingFilter>('all');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace(signInAndReturn(pathname, signedOut));
  }, [loading, me, signedOut, router, pathname]);

  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    setError(null);
    readMeetings()
      .then((answer) => { if (live) setView(answer); })
      .catch((err) => {
        if (!live) return;
        const refused = toDisplayError(err);
        if (refused.code === 'NOT_FOUND') setMissing(true);
        else setError(refused);
      });
    return () => { live = false; };
  }, [signedIn, attempt]);

  if (missing) return <NotFound via="list" />;
  if (error && !view) return <LoadError error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!view) return <ListSkeleton />;

  const shown = filterMeetings(view.meetings, filter);

  return (
    <>
      <p className="mb-[18px] text-md text-muted">{FORUM_COPY.listLine}</p>

      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        {/* `#meeting-segmented` (`:596-601`): each button says whether it is the one on (I-255). */}
        <div className="inline-flex rounded-[9px] border border-hairline bg-card p-[3px]">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-4 py-[7px] text-base font-semibold',
                filter === f ? 'bg-navy text-white' : 'text-muted hover:text-navy',
              )}
            >
              {FORUM_COPY.filters[f]}
            </button>
          ))}
        </div>
        {view.can.create && (
          <Button onClick={() => setCreating(true)}>{FORUM_COPY.newMeeting}</Button>
        )}
      </div>

      {view.meetings.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-card px-[18px] py-10 text-center text-base text-muted">
          {FORUM_COPY.noMeetings}
        </p>
      ) : shown.length === 0 ? (
        <p className="px-[18px] py-10 text-center text-base text-muted">{FORUM_COPY.noMatch}</p>
      ) : (
        <ul className="mb-8 flex flex-col gap-3">
          {shown.map((meeting) => <MeetingCardRow key={meeting.id} meeting={meeting} />)}
        </ul>
      )}

      {view.can.create && (
        <MeetingDialog
          open={creating}
          onClose={() => setCreating(false)}
          limits={view.limits}
          defaultTitle={defaultMeetingTitle(view.meetings)}
          onCreated={(card) => router.push(`/leader-meetings/${encodeURIComponent(card.id)}`)}
        />
      )}
    </>
  );
}
