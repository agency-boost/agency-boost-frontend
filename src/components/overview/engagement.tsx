'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { Button, ErrorBanner } from '@/components/ui/field';
import { PersonRow } from '@/components/ui/person-row';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay } from '@/lib/format';
import { firstNameOf, logLink } from '@/lib/home';
import {
  readNotLogged, silentMeta, SILENT_SHOWN, type NotLoggedList, type NotLoggedMember, type OverviewEngagement,
} from '@/lib/kpm-overview';
import { useSession } from '@/lib/session';
import { MEDIA_RANGES } from '@/lib/use-media-query';
import { PctPill } from './parts';

/** Is the Overview drawn at 1024px or wider? Where there is no width to read (jsdom), the desktop — what specs read. */
export const onDesktop = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function'
  || window.matchMedia(MEDIA_RANGES.desktop).matches;

/** The not-logged list, read once per attempt and kept: each name on it is an audited read (D-audit). */
export interface SilentList {
  list: NotLoggedList | null;
  error: ApiError | null;
  /** Read it, unless it is read or on its way. */
  load: () => void;
  retry: () => void;
}

/**
 * **`GET /kpm/overview/not-logged`, read only when somebody is shown it** (D-audit): the desktop's third card as it
 * mounts there, the sheet when it opens below 1024px — never on a phone's first render. One read per attempt, kept
 * whatever the card or the sheet does, dropped only if the page goes.
 */
export function useSilentList(): SilentList {
  const [list, setList] = useState<NotLoggedList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [wanted, setWanted] = useState(false);
  const requested = useRef<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!wanted || list || requested.current === attempt) return;
    requested.current = attempt;
    setError(null);
    readNotLogged()
      .then((next) => { if (mounted.current) setList(next); })
      .catch((err) => { if (mounted.current) setError(toDisplayError(err)); });
  }, [wanted, list, attempt]);
  const load = useCallback(() => setWanted(true), []);
  const retry = useCallback(() => { setWanted(true); setAttempt((n) => n + 1); }, []);
  return { list, error, load, retry };
}

/**
 * ***Aktif bulan ini*** (P19.3-T2 AC-1; P19.3-T1 AC-1, AC-8; ADR-0200 §2, D1, D8) — the first row's second tile, where
 * OD-142's *Agents who logged activity this month* was: the members whose upload for the month shows APE or a policy,
 * over today's headcount. **A month not uploaded reads *"–"* and *Belum diunggah***, never *0 / 28*; an uploaded one
 * names its day, *"per 3 Nov 2026"*. Its ⓘ says what it counts, as the old tile's did.
 *
 * **Beneath it, *Pengguna aktif* over 7 days** (ADR-0200 §3; UI-148): the pill ***"7 hari: n belum ›"***, which opens
 * *Belum mencatat · 7 hari* — the sheet below 1024px, the third card from it. Nobody silent, no pill. **No trend**: the
 * month's logging and its *"Turun dari 10 bulan lalu (−100%)"* are gone (OWN R3, UI-023), so nothing on the Overview is
 * set against a whole last month.
 */
export function ActiveMonthTile({
  engagement, onOpenSilent,
}: {
  engagement: OverviewEngagement;
  onOpenSilent: () => void;
}) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const active = engagement.activeThisMonth;
  const week = engagement.loggedThisWeek;
  return (
    <StatTile
      label={<>{t.activeMonth} <TippedGlyph glyph="ⓘ" name={t.activeMonthTip} tip={t.activeMonthTip} align="fit" /></>}
      value={active.count === null ? <span aria-label={t.notUploaded}>–</span> : active.count}
      unit={`/ ${active.of}`}
      sub={(
        <span className="flex flex-col items-start gap-1">
          {active.count === null
            ? <span className="font-semibold text-muted">{t.notUploaded}</span>
            : (
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <PctPill pct={active.pct} size="sm" />
                {active.asOf && <span className="text-xs">{t.asOf({ day: formatCalendarDay(active.asOf, figures) })}</span>}
              </span>
            )}
          {week.notLogged > 0 && (
            <button
              type="button"
              data-week-pill=""
              aria-haspopup="dialog"
              aria-label={t.weekPillLabel({ n: week.notLogged, of: week.logged + week.notLogged })}
              onClick={onOpenSilent}
              className="inline-flex items-center rounded-pill bg-pill-amber px-2.5 text-xs font-semibold text-pill-amber-ink max-lg:min-h-11 lg:min-h-7 lg:hover:underline"
            >
              {t.weekPill({ n: week.notLogged })}
            </button>
          )}
        </span>
      )}
    />
  );
}

/**
 * ***Belum mencatat · 7 hari*** **from 1024px: the third card of the lists' row** (P19.3-T2 AC-2; UI-148,
 * `kpm-overview-desktop` 2): *"n dari N"*, three 56px rows and *"Semua n ›"*. It reads the list as it mounts there —
 * a phone draws it hidden and never asks.
 */
export function NotLoggedCard({
  silent, of, headingRef, className,
}: {
  silent: SilentList;
  of: number;
  /** The card's heading, where the tile's pill sends the keyboard on a desktop. */
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  className?: string;
}) {
  const t = useMessages(kpmOverviewMessages);
  const { load } = silent;
  useEffect(() => { if (onDesktop()) load(); }, [load]);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-not-logged-card="" className={cn('min-w-0 rounded-lg border border-card-edge bg-card px-4 pb-3 pt-3', className)}>
      <div className="mb-1.5 flex min-h-8 items-center gap-2">
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="min-w-0 flex-1 font-display text-md font-bold text-navy focus:outline-none">
          {t.notLoggedTitle}
        </h2>
        {silent.list && silent.list.total > 0 && <AllSilent total={silent.list.total} />}
      </div>
      <SilentBody silent={silent} of={of} shown={SILENT_SHOWN} />
    </section>
  );
}

/**
 * ***Belum mencatat · 7 hari*** **below 1024px: a sheet** (P19.3-T2 AC-2; UI-148, `kpm-overview-mobile` 3), opened by
 * the tile's pill — and from 1024px too while the setup card stands in the card's place. *"n dari N"*, then every row the
 * server sent (five), then *"Semua n ›"*. The list is read when it opens.
 */
export function NotLoggedSheet({
  open, onClose, silent, of,
}: {
  open: boolean;
  onClose: () => void;
  silent: SilentList;
  of: number;
}) {
  const t = useMessages(kpmOverviewMessages);
  const { load } = silent;
  useEffect(() => { if (open) load(); }, [open, load]);
  return (
    <ResponsiveSheet
      open={open}
      title={t.notLoggedTitle}
      description={silent.list ? t.notLoggedOf({ n: silent.list.total, of }) : undefined}
      onClose={onClose}
    >
      <SilentBody silent={silent} of={of} shown={null} withCount={false} />
      {silent.list && silent.list.total > 0 && (
        <div className="mt-2 flex justify-center"><AllSilent total={silent.list.total} /></div>
      )}
    </ResponsiveSheet>
  );
}

/** *"Semua n ›"*: the full list, which is *All members*' *Last activity* column (D-directory). */
function AllSilent({ total }: { total: number }) {
  const t = useMessages(kpmOverviewMessages);
  return (
    <Link
      href="/people/members"
      className="-mr-1 inline-flex shrink-0 items-center rounded-sm px-1 text-base font-semibold text-primary-ink underline-offset-2 hover:underline max-lg:min-h-11 lg:min-h-8"
    >
      {t.allRows({ n: total })}
    </Link>
  );
}

/** The list's body: waiting, refused with a retry, everybody logged, or the rows. */
function SilentBody({
  silent, of, shown, withCount = true,
}: {
  silent: SilentList;
  of: number;
  /** How many rows to draw; `null`, every one sent. */
  shown: number | null;
  withCount?: boolean;
}) {
  const t = useMessages(kpmOverviewMessages);
  const { list, error } = silent;
  if (error) {
    return (
      <div>
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-2" onClick={silent.retry}>{t.tryAgain}</Button>
      </div>
    );
  }
  if (!list) {
    return (
      <Skeleton label={t.loadingList}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <SkeletonBar className="h-9 w-9 rounded-full" />
            <SkeletonBar className="h-3.5 w-1/2" />
          </div>
        ))}
      </Skeleton>
    );
  }
  const members = list.members ?? [];
  if (list.total === 0 || members.length === 0) return <p className="py-1.5 text-base text-muted">{t.everybodyLogged}</p>;
  const rows = shown === null ? members : members.slice(0, shown);
  return (
    <>
      {withCount && <p className="mb-1 text-sm text-muted">{t.notLoggedOf({ n: list.total, of })}</p>}
      <ul data-silent-list="">
        {rows.map((member) => <SilentRow key={member.membershipId} member={member} />)}
      </ul>
    </>
  );
}

/**
 * **One silent member: a 56px row** (UI-148; UI-059's person row): the NAME, *"role · leader · last log"*, the D-22
 * WhatsApp reminder, and **the row opens their member page** (Overview R1). **The reader's own row has no reminder** —
 * one does not remind oneself — and reads *Anda*. A member with no number on file has none either: the Owner and an
 * Admin may not save somebody's number (`member:update_phone` is a leader's), so no sheet the API would refuse.
 */
function SilentRow({ member }: { member: NotLoggedMember }) {
  const language = useLanguage();
  const team = useMessages(homeMessages).team;
  const { me } = useSession();
  const self = me?.membership?.membershipId === member.membershipId;
  const host = typeof window === 'undefined' ? '' : window.location.host;
  const leaderName = firstNameOf(me?.user?.preferredName || me?.user?.fullName || '');
  return (
    <li className="border-t border-divider first:border-t-0">
      <PersonRow
        name={member.name}
        seed={member.membershipId}
        meta={<span className="truncate">{silentMeta(member, self, language)}</span>}
        href={`/people/members/${encodeURIComponent(member.membershipId)}`}
        chevron
        height={56}
        className="gap-2 rounded-none bg-transparent px-0 lg:hover:bg-transparent"
        trailing={!self && member.phone ? (
          <MemberContactButtons
            membershipId={member.membershipId}
            name={member.name}
            phone={member.phone}
            channels={['whatsapp']}
            size={36}
            // The D-22 reminder (UI-101), word for word: *"Halo Budi 👋 Aktivitas kemarin & hari ini belum diisi …"*.
            whatsAppText={team.reminder({ name: firstNameOf(member.name), both: true, link: logLink(host), leader: leaderName })}
          />
        ) : undefined}
      />
    </li>
  );
}
