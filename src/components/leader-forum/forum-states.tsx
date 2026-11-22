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
 * **The forum's states** (L-110, *States*): the mockups draw none, so each is ours, in their idiom — a skeleton shaped
 * like what is coming, the shared banner with *Try again*, and one not-found state per way in.
 */

/** The list's wait: the note, the navy card, then four rows. */
export function ListSkeleton() {
  const t = useMessages(forumMessages);
  return (
    <Skeleton label={t.loadingList}>
      <SkeletonBar className="mb-3 h-4 w-2/3" />
      <SkeletonBar className="mb-5 h-32 w-full rounded-lg" />
      <div className="rounded-lg border border-card-edge bg-card">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-divider px-4 py-3 last:border-0">
            <SkeletonBar className="h-9 w-9 rounded-md" />
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

/** A forum's wait: the header card, then the tabs and a list. */
export function MeetingSkeleton() {
  const t = useMessages(forumMessages);
  return (
    <Skeleton label={t.loadingForum}>
      <SkeletonBar className="mb-3 w-32" />
      <div className="mb-4 rounded-lg border border-card-edge bg-card px-4 py-4">
        <SkeletonBar className="h-5 w-1/4" />
        <SkeletonBar className="mt-2 w-1/3" />
        <SkeletonBar className="mt-3 h-7 w-1/2 rounded-pill" />
      </div>
      <SkeletonBar className="mb-4 h-11 w-full rounded-lg" />
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
 * **Not found** — one state for every way a forum is not there for the reader: another office's, deleted, or a member
 * who is no core leader (the server's `404` never says which). By a link, one state for every failure of the link.
 * Each links on to what the reader may open: the list for a steward of the office, and otherwise where the reader lands
 * when they sign in.
 */
export function NotFound({ via }: { via: 'address' | 'list' | 'link' }) {
  const t = useMessages(forumMessages);
  const { me } = useSession();
  const copy = via === 'link' ? t.linkNotFound : t.notFound;
  const steward = Boolean(me?.permissions.includes('leader_meeting:create'));
  const toList = via === 'address' && steward;
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
