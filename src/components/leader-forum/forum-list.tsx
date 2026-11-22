'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buttonClass, Button } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  daysToGo, forumWhen, readMeetings, signInAndReturn, type MeetingCard, type MeetingListView,
} from '@/lib/leader-meetings';
import { useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { CoreLeaderStack } from './forum-people';
import { ListSkeleton, LoadError, NotFound } from './forum-states';

const ForumDialog = dynamic(() => import('./forum-dialog').then((m) => m.ForumDialog), { ssr: false });

/** A forum's address, on a tab when one is named. */
export const forumHref = (id: string, tab?: 'agenda' | 'actions') =>
  `/leader-meetings/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ''}`;

/** *Akan datang* navy on its blue tint, *Selesai* green on its tint — the mockup's two pills, from tokens. */
export const STATE_PILL = {
  upcoming: 'bg-pill-blue text-pill-blue-ink',
  completed: 'bg-pill-green text-pill-green-ink',
} as const;

/**
 * **The Strategic Leader Forum's list** (`/leader-meetings`, P19.22-T8 AC-1; `slf-*` frame 1).
 *
 * - The note *"Pertemuan core leader tiap 2 minggu · 60–90 menit"* and the orange *+ Forum baru* (full width on a phone).
 * - **The navy *Forum berikutnya* card**: the nearest forum not yet held — *Forum #15* in orange, *Kam, 27 Nov 2026 ·
 *   14.00 · 8 hari lagi*, the core leaders' photos and *"7 core leader"*, and *Siapkan agenda*, which opens it on its
 *   agenda; on a phone the button sits under the words.
 * - ***Semua forum*, newest first**: *#n*, *Forum #n*, date · time, *Action items x/y selesai* for one held or *Agenda n
 *   item* for one to come (from 768px), the state pill, ›. A row on a phone is two lines.
 *
 * Every state: a skeleton, the shared banner with *Try again*, *Belum ada forum*, and not-found for a reader who is no
 * steward (the server's 404).
 */
export function ForumList() {
  const t = useMessages(forumMessages);
  const { me, loading, signedOut, expired } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = !loading && me !== null;
  const [view, setView] = useState<MeetingListView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const createOpened = useOpenedOnce(creating);

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

  const next = view.meetings.find((m) => m.id === view.nextId) ?? null;

  return (
    <div data-forum-list="">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-base text-muted">{t.note}</p>
        {view.can.create && (
          <Button onClick={() => setCreating(true)} className="w-full md:w-auto">
            <LineIcon name="plus" className="h-4 w-4" />
            {t.newForum}
          </Button>
        )}
      </div>

      {next && <NextForumCard card={next} view={view} />}

      <h2 className="mb-2 text-md font-bold text-navy">{t.all}</h2>
      {view.meetings.length === 0 ? (
        <p className="rounded-lg border border-card-edge bg-card px-4 py-10 text-center text-base text-muted">{t.noForums}</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-card-edge bg-card">
          {view.meetings.map((card) => <ForumRow key={card.id} card={card} />)}
        </ul>
      )}

      {view.can.create && createOpened && (
        <ForumDialog
          mode="create"
          open={creating}
          today={view.today}
          onClose={() => setCreating(false)}
          onSaved={(card) => router.push(forumHref(card.id, 'agenda'))}
        />
      )}
    </div>
  );
}

/** **Forum berikutnya** — the navy card (AC-1). */
function NextForumCard({ card, view }: { card: MeetingCard; view: MeetingListView }) {
  const t = useMessages(forumMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  return (
    <section
      data-next-forum={card.id}
      aria-labelledby="next-forum-title"
      className="mb-5 flex flex-col gap-4 rounded-lg bg-secondary px-4 py-4 text-secondary-contrast md:flex-row md:items-center md:justify-between md:px-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary-muted">{t.next}</p>
        <h2 id="next-forum-title" className="font-display text-[28px] font-bold leading-tight text-primary-on-secondary">{t.forumN({ n: card.number })}</h2>
        <p className="mt-1 text-md font-semibold text-secondary-contrast">
          {forumWhen(card, language)} · {daysToGo(card.daysUntil, words)}
        </p>
        <CoreLeaderStack people={view.coreLeaders} onNavy className="mt-2" />
      </div>
      <Link href={forumHref(card.id, 'agenda')} className={cn(buttonClass('primary'), 'w-full shrink-0 md:w-auto')}>
        {t.prepare}
      </Link>
    </section>
  );
}

/** One forum in *Semua forum* — two lines on a phone (part C). */
function ForumRow({ card }: { card: MeetingCard }) {
  const t = useMessages(forumMessages);
  const language = useFigureLanguage();
  const summary = card.state === 'completed'
    ? <>{t.actionsLabel} <b className="font-bold text-navy">{card.actionProgress.done}/{card.actionProgress.total}</b> {t.doneWord}</>
    : t.agendaCount({ n: card.agendaCount });
  return (
    <li className="border-b border-divider last:border-0" data-forum-row={card.number}>
      <Link
        href={forumHref(card.id)}
        aria-label={t.open({ n: card.number })}
        className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-hover-row focus-visible:bg-hover-row"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-hover-row text-sm font-bold text-navy" aria-hidden="true">
          {t.chipN({ n: card.number })}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-md font-bold text-navy">{t.forumN({ n: card.number })}</b>
          <span className="block truncate text-sm text-muted">{forumWhen(card, language)}</span>
        </span>
        <span className="hidden text-sm text-muted md:inline">{summary}</span>
        <span className={cn('shrink-0 rounded-pill px-2.5 py-0.5 text-sm font-semibold', STATE_PILL[card.state])}>
          {t.state[card.state]}
        </span>
        <LineIcon name="chevronRight" className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
