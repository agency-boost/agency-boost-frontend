'use client';

import Link from 'next/link';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import type { ApiError } from '@/lib/api-client';
import { landingFor } from '@/lib/landing';
import { useSession } from '@/lib/session';

/**
 * **The forum's states** (L-110, *States*): the prototype draws none, so each is ours, in its idiom — a
 * skeleton shaped like what is coming, the shared banner with *Try again*, and one not-found state per way in.
 */

/** The list's wait: the filter, then three cards. */
export function ListSkeleton() {
  const t = useMessages(forumMessages);
  return (
    <Skeleton label={t.loadingList}>
      <SkeletonBar className="mb-[18px] h-4 w-3/4" />
      <div className="mb-[22px] flex w-fit gap-1 rounded-[9px] border border-hairline bg-card p-[3px]">
        {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-8 w-16" />)}
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-[18px] rounded-lg border border-card-edge bg-card px-[18px] py-4">
            <SkeletonBar className="h-[54px] w-[54px] rounded-[10px]" />
            <div className="min-w-0 flex-1">
              <SkeletonBar className="h-4 w-1/3" />
              <SkeletonBar className="mt-2 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/** A meeting's wait: the head, then the tab strip and a panel. */
export function MeetingSkeleton() {
  const t = useMessages(forumMessages);
  return (
    <Skeleton label={t.loadingMeeting}>
      <SkeletonBar className="mb-4 w-40" />
      <div className="mb-[18px] rounded-[14px] border border-hairline bg-card px-6 py-5">
        <SkeletonBar className="h-5 w-1/3" />
        <SkeletonBar className="mt-2 w-1/4" />
        <div className="mt-4 flex gap-2 border-t border-hairline pt-[14px]">
          {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-6 w-28 rounded-pill" />)}
        </div>
      </div>
      <div className="mb-5 flex gap-6 border-b border-hairline pb-2.5">
        {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-4 w-24" />)}
      </div>
      <div className="rounded-lg border border-card-edge bg-card p-4">
        {[0, 1, 2, 3, 4].map((i) => <SkeletonBar key={i} className="mt-3 w-full first:mt-0" />)}
      </div>
    </Skeleton>
  );
}

/** A read that failed: the shared banner, and *Try again*. */
export function LoadError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const t = useMessages(forumMessages);
  return (
    <div className="mb-4">
      <ErrorBanner {...error} />
      <Button variant="secondary" className="mt-3" onClick={onRetry}>{t.tryAgain}</Button>
    </div>
  );
}

/**
 * **Not found** — one state for every way a meeting is not there for the reader: another office's, deleted,
 * or a member not tagged (the server's `404` never says which). By a link, one state for every failure of the
 * link. Each links on to what the reader's shell offers: the list for whoever runs the office, and otherwise
 * where the reader lands when they sign in.
 */
export function NotFound({ via }: { via: 'address' | 'list' | 'link' }) {
  const t = useMessages(forumMessages);
  const { me } = useSession();
  const copy = via === 'link' ? t.linkNotFound : t.notFound;
  const runsOffice = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);
  const toList = via === 'address' && runsOffice;
  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">{copy.title}</h2>
      <p className="mt-1 text-md text-muted">{copy.body}</p>
      <Link
        href={toList ? '/leader-meetings' : landingFor(me)}
        className="mt-4 inline-flex text-sm font-semibold text-navy-soft underline-offset-2 hover:underline"
      >
        {toList ? t.back : t.home}
      </Link>
    </Card>
  );
}
