'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFieldChrome } from '@/components/field-nav';
import { Button } from '@/components/ui/field';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  defaultMeetingTitle, filterMeetings, readMeetings, signInAndReturn, type MeetingFilter, type MeetingListView,
} from '@/lib/leader-meetings';
import { useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { usePhone } from '@/lib/use-phone';
import { ListSkeleton, LoadError, NotFound } from './forum-states';
import { MeetingCardRow } from './meeting-card';
import { V1ForumList } from './v1-list';

/** *+ New meeting*'s dialog, downloaded when it is first opened and mounted from then on (`useOpenedOnce`; P18.99-T16). */
const MeetingDialog = dynamic(() => import('./meeting-dialog').then((m) => m.MeetingDialog), { ssr: false });

const FILTERS: readonly MeetingFilter[] = ['all', 'upcoming', 'past'];

/**
 * **The list** (`/leader-meetings`, `:2002-2013`, `:2588-2630`; *The list*): the filter *All* · *Upcoming* · *Past*
 * over the one read, *+ New meeting* beside it for whoever may make one, and a card per meeting, newest first. A member
 * the server does not let read the forum is answered `404`, and meets the not-found state.
 *
 * **One subtitle** (P18.97-T2 AC-1, I-496; the client's grey-text row for UI-015): the page's, from the shell. The list's
 * own line (`:2004`) said it again and is gone at every size.
 */
export function ForumList() {
  const t = useMessages(forumMessages);
  const language = useLanguage();
  const { me, loading, signedOut, expired } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = !loading && me !== null;
  const [view, setView] = useState<MeetingListView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<MeetingFilter>('all');
  const [creating, setCreating] = useState(false);
  const createOpened = useOpenedOnce(creating);
  // UI V1 (UI-110): a phone in the field shell reads the Event-like cards; the console and wider screens as before.
  const phone = usePhone();
  const field = useFieldChrome() !== null;

  useEffect(() => {
    if (!loading && !me) router.replace(signInAndReturn(pathname, { signedOut, expired }));
  }, [loading, me, signedOut, expired, router, pathname]);

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

  const dialog = view.can.create && createOpened && (
    <MeetingDialog
      open={creating}
      onClose={() => setCreating(false)}
      limits={view.limits}
      defaultTitle={defaultMeetingTitle(view.meetings, language)}
      onCreated={(card) => router.push(`/leader-meetings/${encodeURIComponent(card.id)}`)}
    />
  );

  if (phone && field) {
    return (
      <>
        <V1ForumList
          meetings={view.meetings}
          filter={filter}
          onFilter={setFilter}
          create={view.can.create ? <Button onClick={() => setCreating(true)}>{t.newMeeting}</Button> : null}
        />
        {dialog}
      </>
    );
  }

  return (
    <>
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
              {t.filters[f]}
            </button>
          ))}
        </div>
        {view.can.create && (
          <Button onClick={() => setCreating(true)}>{t.newMeeting}</Button>
        )}
      </div>

      {view.meetings.length === 0 ? (
        <p className="rounded-lg border border-card-edge bg-card px-[18px] py-10 text-center text-base text-muted">
          {t.noMeetings}
        </p>
      ) : shown.length === 0 ? (
        <p className="px-[18px] py-10 text-center text-base text-muted">{t.noMatch}</p>
      ) : (
        <ul className="mb-8 flex flex-col gap-3">
          {shown.map((meeting) => <MeetingCardRow key={meeting.id} meeting={meeting} />)}
        </ul>
      )}

      {dialog}
    </>
  );
}
