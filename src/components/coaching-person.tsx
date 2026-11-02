'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader, PageLanguageSwitch, usePageLanguageSwitch } from '@/components/app-shell';
import { TitledPageContext } from '@/components/require-session';
import { Card, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar } from '@/components/ui/person-row';
import { TAB_PHONE, TAP_HEIGHT } from '@/components/ui/phone';
import { useTabRow } from '@/components/ui/use-tab-row';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  coacheeInitials, coacheeUnitLine, coachingTabHref, coachingTabOf, myCoachingHref, readCoachee, readSessionHistory,
  type Coachee, type CoachingTab, type SessionHistory,
} from '@/lib/coaching';
import { useSession } from '@/lib/session';

/**
 * The person shell (`Overall.html:3969-3995`, P11-T7): one coachee's page — the way back, who they are, and the tabs.
 *
 * **UI V1 (UI-029, UI-030, UI-031, UI-041)**: one header — below 1024px a 48px row, *‹*, the 36px avatar and the name
 * with its line *directly under it*, never beside it; from 1024px the way back, the avatar, the name and *ID | EN* as
 * before — and **no *Leader view* / *Agent view***: a leader always sees the leader's page. The tabs in the owner's
 * order, *Coaching Session* first, on one row that scrolls sideways where they do not fit.
 *
 * **One component for every person** (contradiction #12, I-05): the prototype draws its shell twice,
 * once with `-j` ids. This is mounted once, by the route's layout, so it stays mounted while the
 * reader moves between tabs.
 *
 * **It reads the person once**, from `GET /coaching/coachees/:membershipId`, and hands them to the
 * tab beneath through `useCoachee()`. A tab is not drawn until the person is known: outside the
 * reader's reach the read is a 404, and the page is the not-found state below rather than a shell
 * whose tabs each fail on their own (P11-T7 AC-8).
 *
 * **The archive is the one exception** (P11-T10 AC-9, ADR-0082). A former coach reads the sessions they
 * led at their archive's address although the person read answers them 404, since they no longer coach
 * that person; the archive then stands on its own, under the way back, without the header and the tabs,
 * each of which would answer them 404 too. It reads the session itself, and says not-found when that
 * read does. The bar marks *Coaching Session* current there: a past session is that tab's record.
 *
 * **A tab that suspends never hides the shell** (F5 of P11's final walk). The tab is inside a boundary of
 * the shell's own: a page that reads its address with `use(params)` suspends the first time the shell
 * draws it, and the nearest boundary above was `(agent)/loading.tsx`'s, which hid the header and the
 * tabs behind the page skeleton and showed them again. Shown again, StrictMode runs every effect inside
 * once more: the person was read a second time, blanked meanwhile, and the tab beneath mounted twice.
 */

const CoacheeContext = createContext<Coachee | null>(null);

/** The person the shell is showing. Only inside the person shell, which renders no tab without one. */
export function useCoachee(): Coachee {
  const coachee = useContext(CoacheeContext);
  if (!coachee) throw new Error('useCoachee() is only available inside the coaching person shell.');
  return coachee;
}

/**
 * The person the shell is showing, or `null`: for the archive, which a former coach reads with no
 * person to show (above), and which renders outside the shell in a spec.
 */
export function useCoacheeIfAny(): Coachee | null {
  return useContext(CoacheeContext);
}

/** Takes the history read the shell started beside the person, once; `null` when it started none. */
type TakeHistory = (membershipId: string) => Promise<SessionHistory> | null;

const HistoryPrefetchContext = createContext<TakeHistory | null>(null);

/**
 * The *Coaching Session* tab's first read, started by the shell beside the person's (P11-T8's browser
 * walk): the history needs only the address, so it need not wait for the person to arrive before it
 * goes out. `null` outside the shell; the workspace then reads it itself.
 */
export function useSessionHistoryPrefetch(): TakeHistory | null {
  return useContext(HistoryPrefetchContext);
}

const CoacheeGoneContext = createContext<(() => void) | null>(null);

/**
 * Tell the shell that the person is out of the reader's reach after all: a tab's own read of them
 * answered 404 although the person read did not — the reach changed in between. The shell then shows
 * its not-found state in place of the header and the tabs, exactly as it would have on arrival, rather
 * than the tab inventing a refusal of its own beneath a header that says the reader coaches them.
 */
export function useCoacheeNotFound(): () => void {
  const gone = useContext(CoacheeGoneContext);
  if (!gone) throw new Error('useCoacheeNotFound() is only available inside the coaching person shell.');
  return gone;
}

interface ShellTab {
  tab: CoachingTab;
  /** Its name's key in the catalogue (`messages/coaching.ts`): the same words in both languages (§A.3). */
  name: keyof typeof coachingMessages.en.person.tabs;
  /** The leader's own tab, the line lock before its name (UI-029: 🔒 → a line icon). */
  leaderOnly?: boolean;
}

/**
 * **The owner's order** (UI V1, UI-029): *Coaching Session · Activity · Leads · Goal Setting · Personal Summary ·
 * Activation · Training · Capability mapping* — the session first, where *Coaching* lands, and the leader's own
 * *Capability mapping* (the address `leader-notes`, its old name *Leader Notes*) last.
 */
const TABS: readonly ShellTab[] = [
  { tab: 'session', name: 'session' },
  { tab: 'activity', name: 'activity' },
  { tab: 'leads', name: 'leads' },
  { tab: 'goal-setting', name: 'goalSetting' },
  { tab: 'summary', name: 'summary' },
  { tab: 'activation', name: 'activation' },
  { tab: 'training', name: 'training' },
  { tab: 'leader-notes', name: 'leaderNotes', leaderOnly: true },
];

export function PersonShell({ membershipId, children }: { membershipId: string; children: ReactNode }) {
  const t = useMessages(coachingMessages);
  const pathname = usePathname();
  const [coachee, setCoachee] = useState<Coachee | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  // Where the leader came from (UI-029): the entry point's `?from=`, read once — moving between tabs drops the query.
  const [back, setBack] = useState<string | null>(null);
  useEffect(() => { setBack(backFrom(window.location.search)); }, [membershipId]);
  const tab = coachingTabOf(pathname, membershipId);
  const gone = useCallback(() => setMissing(true), []);
  const archive = isArchivePath(pathname, membershipId);
  // A past session's record belongs to the *Coaching Session* tab, which stays current on it (F6).
  const current: CoachingTab | null = archive ? 'session' : tab;

  /*
   * The session tab's history, read beside the person when the shell opens on that tab. Taken once:
   * a later read, after a finalize or a reopen, is the workspace's own. Not on the archive, which
   * reads only its own session.
   */
  const opensOnSession = useRef(tab === 'session');
  const prefetched = useRef<{ membershipId: string; read: Promise<SessionHistory> } | null>(null);
  useEffect(() => {
    if (!opensOnSession.current) return;
    const read = readSessionHistory(membershipId);
    // Its failure is the workspace's to show, if a workspace ever asks for it.
    read.catch(() => undefined);
    prefetched.current = { membershipId, read };
    return () => { prefetched.current = null; };
  }, [membershipId]);
  const takeHistory = useCallback<TakeHistory>((id) => {
    const held = prefetched.current;
    prefetched.current = null;
    return held && held.membershipId === id ? held.read : null;
  }, []);

  useEffect(() => {
    let live = true;
    setCoachee(null);
    setError(null);
    setMissing(false);
    readCoachee(membershipId)
      .then((next) => { if (live) setCoachee(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [membershipId]);

  /*
   * **The page's title** (P18.95-T7 AC-2; UI-021): the person's name, as the header's heading, once they are read; the
   * prototype's *Coaching Session* while there is nobody to name — not found, a read that failed, a former coach's
   * archive. Whatever is drawn beneath is under that title (`TitledPageContext`), so a tab's refusal is a section.
   */
  const untitled = <PageHeader title={t.title} />;

  // A former coach on the archive of a session they led: the archive alone, under the way back.
  if (missing && archive) {
    return (
      <TitledPageContext.Provider value>
        <div>
          {untitled}
          <WayBack />
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </TitledPageContext.Provider>
    );
  }
  if (missing) {
    return (
      <TitledPageContext.Provider value>
        {untitled}
        <CoacheeNotFound />
      </TitledPageContext.Provider>
    );
  }

  return (
    <TitledPageContext.Provider value>
      <div>
        {error && !coachee && untitled}
        {!coachee && <BackLink />}
        {error && <ErrorBanner {...error} />}
        {!coachee && !error && <HeaderSkeleton />}
        {coachee && (
          <>
            <PersonHeader coachee={coachee} back={back} />
            <PersonTabs membershipId={membershipId} current={current} />
            <CoacheeContext.Provider value={coachee}>
              <CoacheeGoneContext.Provider value={gone}>
                <HistoryPrefetchContext.Provider value={takeHistory}>
                  {/* The shell's own boundary: a tab that suspends waits here, under the header (above). */}
                  <Suspense fallback={null}>{children}</Suspense>
                </HistoryPrefetchContext.Provider>
              </CoacheeGoneContext.Provider>
            </CoacheeContext.Provider>
          </>
        )}
      </div>
    </TitledPageContext.Provider>
  );
}

/** `/coaching/{membershipId}/archive/…`: a past session's record. */
function isArchivePath(pathname: string | null, membershipId: string): boolean {
  return pathname?.startsWith(`/coaching/${encodeURIComponent(membershipId)}/archive/`) ?? false;
}

/**
 * `.back-link` (`Overall.html:1080`, `:3970`, `:4385`): back to the roster, *Coaching Session*, or to where `href`
 * names, called `to`.
 */
export function BackLink({ href = '/coaching', to }: { href?: string; to?: string }) {
  const t = useMessages(coachingMessages);
  return (
    <Link
      href={href}
      className={cn('mb-3.5 inline-flex items-center gap-1 text-sm font-semibold text-navy-soft hover:underline', TAP_HEIGHT)}
    >
      {t.person.back({ to: to ?? t.title })}
    </Link>
  );
}

/**
 * Whether the reader leads somebody (ADR-0087): an active direct report. Only for them does the roster
 * have anybody on it, so only to them is it offered as the way back (`/coaching/me`'s rule, I-172).
 */
export function useLeadsSomebody(): boolean {
  const { me } = useSession();
  return (me?.membership?.directCount ?? 0) > 0;
}

/**
 * The way back from a coaching page that is not a person's tabs (F4 of P11's final walk): the roster,
 * for a reader who leads somebody; for anybody else, whose roster is empty, their own coaching, under
 * the name the prototype gives the way there, *My Coaching Notes* (`Overall.html:3958`).
 */
function WayBack() {
  const t = useMessages(coachingMessages).roster;
  return useLeadsSomebody() ? <BackLink /> : <BackLink href={myCoachingHref()} to={t.myNotes} />;
}

/**
 * **The coachee's header, the page's one `<h1>`** (P18.95-T7 AC-2; UI V1, UI-031, D-23).
 *
 * - **Below 1024px, one 48px row**: the way back as a *‹* (44px, its words for a screen reader), the 36px avatar, and
 *   the name 20px/800 (22px on a tablet) with *Agent · Unit langsung* in 12px **on its own line directly under it** —
 *   never beside it (the owner). No dark bar, no toggle: the content starts within ~180px of the top.
 * - **From 1024px as it was**: the way back on its own line, the 52px avatar, the name, the line, and *ID | EN*.
 *
 * **The way back is to where the leader came from** (UI-029): `/coaching` by default, or the in-app address the entry
 * point named in `?from=` (`coachingSessionHref(id, from)` — New Hires' rows), read once when the shell opens, since
 * moving between tabs drops the query.
 */
function PersonHeader({ coachee, back }: { coachee: Coachee; back: string | null }) {
  const language = useLanguage();
  const t = useMessages(coachingMessages);
  const withLanguage = usePageLanguageSwitch();
  return (
    <div data-coachee-header="" className="mb-1 flex flex-wrap items-center gap-x-2.5 lg:mb-[22px] lg:gap-x-3.5">
      <Link
        href={back ?? '/coaching'}
        className={cn(
          '-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-navy hover:bg-hover-row',
          'lg:mb-3.5 lg:ml-0 lg:h-auto lg:w-auto lg:basis-full lg:justify-start lg:rounded-sm lg:text-sm lg:font-semibold',
          'lg:text-navy-soft lg:hover:bg-transparent lg:hover:underline',
        )}
      >
        <LineIcon name="chevronLeft" className="h-[22px] w-[22px] lg:hidden" />
        <span className="max-lg:sr-only">{back ? t.person.backOnly : t.person.back({ to: t.title })}</span>
      </Link>
      <Avatar name={coachee.name} photoUrl={coachee.photoUrl ?? null} seed={coachee.membershipId} size={36} className="lg:hidden" />
      <span
        aria-hidden="true"
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-amber text-[1.1875rem] font-bold text-navy max-lg:hidden"
      >
        {coacheeInitials(coachee.name)}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-title font-extrabold leading-tight text-navy lg:text-[1.5rem] lg:font-bold">
          {coachee.name}
        </h1>
        <p className="mt-px truncate text-xs text-muted lg:mt-0.5 lg:text-base">{coacheeUnitLine(coachee, language)}</p>
      </div>
      {withLanguage && <PageLanguageSwitch className="shrink-0" />}
    </div>
  );
}

/**
 * The way back an entry point named (`?from=`), **an address of this app only**: a path, never `//host` or a scheme, so
 * the link cannot be pointed off the app. `null` for none.
 */
export function backFrom(search: string): string | null {
  const from = new URLSearchParams(search).get('from');
  return from && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\') ? from : null;
}

/**
 * The avatar, the name and the line under it (`.person-header`, `Overall.html:3972-3979`, `:4387-4394`),
 * with whatever goes on the right. The name is an `<h2>` under the page's own title, or with `title` **the page's
 * title**, its `<h1>` (the person shell's, P18.95-T7 AC-2) — drawn the same either way. `line` is `null`
 * for a person whose rung the reader is not told: the archive a former coach reads (ADR-0082).
 */
export function PersonIdentity({
  initials, name, line, title = false, children,
}: { initials: string; name: string; line: string | null; title?: boolean; children?: ReactNode }) {
  const Name = title ? 'h1' : 'h2';
  // The page's own header (`title`): once the language switch is live, it sits here, before the view toggle (P18.98-T2).
  const withLanguage = usePageLanguageSwitch() && title;
  const row = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-amber text-[1.1875rem] font-bold text-navy"
        >
          {initials}
        </span>
        <div>
          <Name className="font-display text-[1.5rem] font-bold leading-tight text-navy">{name}</Name>
          {line && <p className="mt-0.5 text-base text-muted">{line}</p>}
        </div>
      </div>
      {children}
      </div>
  );
  if (!withLanguage) return <div className="mb-[22px]">{row}</div>;
  // The switch at the top-right corner, a column of its own, as on every page header (`PageHeader`, 2026-10-29).
  return (
    <div className="mb-[22px] flex items-center gap-4">
      {row}
      <PageLanguageSwitch className="shrink-0 md:my-0" />
    </div>
  );
}

/**
 * The person's tabs, **in the owner's order** (UI V1, UI-029), every one followable, the leader's own *Capability
 * mapping* behind a line lock.
 */
function PersonTabs({ membershipId, current }: { membershipId: string; current: CoachingTab | null }) {
  const names = useMessages(coachingMessages).person.tabs;
  return (
    <CoachingTabBar
      items={TABS.map((t) => ({
        key: t.tab,
        label: names[t.name],
        href: coachingTabHref(membershipId, t.tab),
        current: current === t.tab,
        locked: t.leaderOnly,
      }))}
    />
  );
}

/** One tab of the bar: where it goes, or `null` for a tab that cannot be followed yet. */
export interface CoachingTabItem {
  key: string;
  label: string;
  href: string | null;
  current?: boolean;
  /** *Capability mapping*: the line lock before its name (UI-029). */
  locked?: boolean;
}

/**
 * The tab bar (`.toptabbar`, `Overall.html:1095-1103`): the person shell's, and `/coaching/me`'s, whose
 * first two tabs open the reader's own screens (P11-T10). `RouteTabs`' underline idiom, because each tab
 * is an address — links in a `nav`, the current one carrying `aria-current`.
 *
 * **One row that never wraps, at every width** (UI V1, UI-030): where the tabs do not fit — a phone, a tablet, a 1024px
 * desktop — it scrolls sideways by swipe, with no scrollbar and a 32px fade at the edge that has more; the current tab is
 * scrolled into view on load (`useTabRow`), and *Coaching Session*, first, is at the left edge. Each tab 44px tall below
 * 1024px. At 1280px all eight fit, and it reads as it did.
 *
 * **A tab with no address is in the bar and cannot be followed yet** (P11-T7 AC-7), in the prototype's
 * disabled idiom: muted text and a plain cursor, `aria-disabled`, named for what it is.
 */
export function CoachingTabBar({ items }: { items: readonly CoachingTabItem[] }) {
  const t = useMessages(coachingMessages).person;
  // The underline sits inside the row: a row that scrolls clips anything hung below it (the `-mb-px` it had).
  const TAB = cn(
    'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-3 text-md font-semibold',
    'max-lg:min-h-11 max-lg:pt-3 focus-visible:[outline-offset:-2px]',
    TAB_PHONE,
  );
  const row = useTabRow<HTMLElement>(items.find((tab) => tab.current)?.key);
  return (
    <nav
      ref={row.ref}
      aria-label={t.nav}
      data-fade={row.fade}
      data-coaching-tabs=""
      style={{ '--tab-fade': '2rem' } as React.CSSProperties}
      className={cn(
        'mb-3 flex flex-nowrap gap-x-[22px] overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-hairline)]',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mb-6 lg:gap-x-6',
        // The fade from 768px too — the phone's is `globals.css`' — while more tabs follow (UI-030).
        'md:data-[fade=end]:[mask-image:linear-gradient(to_left,transparent,black_2rem)]',
        'md:data-[fade=start]:[mask-image:linear-gradient(to_right,transparent,black_2rem)]',
        'md:data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]',
      )}
    >
      {items.map((tab) => {
        if (tab.href === null) {
          return (
            <span
              key={tab.key}
              role="link"
              aria-disabled="true"
              // Its name says it is there and not yet available, beginning with the words on screen
              // (WCAG 2.5.3). The tooltip says the same to a pointer.
              aria-label={t.upcomingName({ label: tab.label })}
              title={t.upcoming}
              className={cn(TAB, 'cursor-default border-transparent text-muted/50')}
            >
              {tab.label}
            </span>
          );
        }
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.current ? 'page' : undefined}
            className={cn(TAB, tab.current ? 'border-amber text-navy' : 'border-transparent text-muted')}
          >
            {tab.locked && <LineIcon name="lock" className="h-3.5 w-3.5 text-navy-soft" />}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function HeaderSkeleton() {
  const t = useMessages(coachingMessages).person;
  return (
    <Skeleton label={t.loading} className="mb-6">
      <div className="mb-[22px] flex items-center gap-3.5">
        <div className="h-[52px] w-[52px] rounded-full bg-hairline" />
        <div className="flex flex-col gap-2">
          <SkeletonBar className="h-5 w-48" />
          <SkeletonBar className="w-32" />
        </div>
      </div>
      <SkeletonBar className="h-4 w-2/3" />
    </Skeleton>
  );
}

/**
 * Outside the reader's reach (P11-T7 AC-8): the read is a 404, for somebody they do not coach, an
 * address that names nobody, and somebody who has left. Ours to word (L-01), inside the agent shell so
 * the nav and the way back stay, and the same for each of those, so it tells the reader nothing about
 * who exists. None of ADR-0084's six words. *Everyone you coach is on Coaching Session* only to a reader
 * who leads somebody, as the way back to the roster is (F4).
 */
function CoacheeNotFound() {
  const t = useMessages(coachingMessages).person;
  const leads = useLeadsSomebody();
  return (
    <div>
      <WayBack />
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{t.notFound}</h2>
        <p className="mt-1 text-md text-muted">{t.notFoundLine({ leads })}</p>
      </Card>
    </div>
  );
}
