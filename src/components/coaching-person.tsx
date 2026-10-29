'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader, PageLanguageSwitch, usePageLanguageSwitch } from '@/components/app-shell';
import { TitledPageContext } from '@/components/require-session';
import { Card, ErrorBanner } from '@/components/ui/field';
import { TAB_PHONE, TAB_ROW_PHONE, TAP_HEIGHT, UNDERLINED_ROW_PHONE } from '@/components/ui/phone';
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
 * The person shell (`Overall.html:3969-3995`, P11-T7): one coachee's page — *← Back to Coaching
 * Session*, who they are, *Leader view* / *Agent view*, and the tabs.
 *
 * **One component for every person** (contradiction #12, I-05): the prototype draws its shell twice,
 * once with `-j` ids. This is mounted once, by the route's layout, so it stays mounted while the
 * reader moves between tabs and the view toggle keeps its place.
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

type View = 'leader' | 'agent';

interface ShellTab {
  tab: CoachingTab;
  /** Its name's key in the catalogue (`messages/coaching.ts`): the same words in both languages (§A.3). */
  name: keyof typeof coachingMessages.en.person.tabs;
  /** In the bar, not followable: the tab's screen is not built yet (P11-T7 AC-7). */
  upcoming?: boolean;
  /** The leader's own tab, which *Agent view* takes away (`Overall.html:3994`, `:11298-11306`). */
  leaderOnly?: boolean;
}

/**
 * The prototype's tabs, in its order and words (`Overall.html:3988-3995`), and *Activity* between *Goal
 * Setting* and *Training*: the client's request of 2026-10-07 (P13.1-T9), a coachee's Activity Dashboard.
 */
const TABS: readonly ShellTab[] = [
  { tab: 'summary', name: 'summary' },
  { tab: 'goal-setting', name: 'goalSetting' },
  { tab: 'activity', name: 'activity' },
  // Live since P18.5-T4 (AC-2): the person's training, read-only, from the learner's own read.
  { tab: 'training', name: 'training' },
  { tab: 'activation', name: 'activation' },
  { tab: 'session', name: 'session' },
  { tab: 'leader-notes', name: 'leaderNotes', leaderOnly: true },
];

export function PersonShell({ membershipId, children }: { membershipId: string; children: ReactNode }) {
  const t = useMessages(coachingMessages);
  const pathname = usePathname();
  const router = useRouter();
  const [coachee, setCoachee] = useState<Coachee | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<View>('leader');
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
   * *Agent view* moves a reader standing on Leader Notes to Personal Summary (`Overall.html:11298-11306`),
   * and that covers arriving there by Back as well as switching while on it. The notes tab is not drawn
   * in the meantime (below), so what it fetched is dropped with it: the toggle is a preview, not a
   * permission (roles §1.7), and the notes were never in any other tab's payload (ADR-0078).
   */
  const previewingNotes = view === 'agent' && current === 'leader-notes';
  useEffect(() => {
    if (previewingNotes) router.replace(coachingTabHref(membershipId, 'summary'));
  }, [previewingNotes, membershipId, router]);

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
        <BackLink />
        {error && <ErrorBanner {...error} />}
        {!coachee && !error && <HeaderSkeleton />}
        {coachee && (
          <>
            <PersonHeader coachee={coachee} view={view} onView={setView} />
            <PersonTabs membershipId={membershipId} current={current} view={view} />
            <CoacheeContext.Provider value={coachee}>
              <CoacheeGoneContext.Provider value={gone}>
                <HistoryPrefetchContext.Provider value={takeHistory}>
                  {/* The shell's own boundary: a tab that suspends waits here, under the header (above). */}
                  <Suspense fallback={null}>{!previewingNotes && children}</Suspense>
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
 * `.person-header` (`Overall.html:1083-1092`, `:3972-3985`): the avatar's initials, the name, the rung
 * and whose unit; the view toggle on the right.
 *
 * **The name is the page's title, its one `<h1>`** (P18.95-T7 AC-2; the client's UI review, UI-021). It was the second
 * heading under *Coaching Session*, which was also a tab and the way back; the prototype's two `<h1>`s left a screen
 * reader two pages' worth of top-level headings, and one is all there is now. It looks as the prototype's
 * `.person-name` does.
 */
function PersonHeader({ coachee, view, onView }: { coachee: Coachee; view: View; onView: (view: View) => void }) {
  const language = useLanguage();
  return (
    <PersonIdentity initials={coacheeInitials(coachee.name)} name={coachee.name} line={coacheeUnitLine(coachee, language)} title>
      <ViewToggle view={view} onView={onView} />
    </PersonIdentity>
  );
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
  return (
    <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4">
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
      {withLanguage ? (
        <div className="flex flex-wrap items-center gap-4">
          <PageLanguageSwitch className="md:my-0" />
          {children}
        </div>
      ) : children}
    </div>
  );
}

/**
 * *Leader view* / *Agent view* (`Overall.html:3980-3985`, `.view-toggle` `:1086-1091`): a segmented pair.
 *
 * **Two toggle buttons, not tabs.** It controls no panel — it changes which tabs the bar offers — so
 * each is a button whose `aria-pressed` says which view is on. No hint sentence goes with it (ADR-0083):
 * the prototype styles one and never renders it.
 */
function ViewToggle({ view, onView }: { view: View; onView: (view: View) => void }) {
  const t = useMessages(coachingMessages).person;
  const option = (id: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === id}
      onClick={() => onView(id)}
      className={cn(
        'rounded-md px-4 py-[7px] text-base font-semibold',
        view === id ? 'bg-navy text-white' : 'text-muted hover:text-navy',
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t.view} className="inline-flex rounded-[9px] border border-hairline bg-card p-[3px]">
      {option('leader', t.leaderView)}
      {option('agent', t.agentView)}
    </div>
  );
}

/**
 * The person's tabs (`Overall.html:3988-3995`, and *Activity*, P13.1-T9). *Training* is live since
 * P18.5-T4 (AC-2), shown in *Leader view* and *Agent view* alike (`:4331`); *Activation* since P13-T9 (AC-3). *Agent view* takes *🔒 Leader Notes* out of the bar, as the
 * prototype's `display: none` does; *Activity* stays, the coachee's own screen as Personal Summary is.
 */
function PersonTabs({ membershipId, current, view }: { membershipId: string; current: CoachingTab | null; view: View }) {
  const names = useMessages(coachingMessages).person.tabs;
  return (
    <CoachingTabBar
      items={TABS.filter((t) => !(t.leaderOnly && view === 'agent')).map((t) => ({
        key: t.tab,
        label: names[t.name],
        href: t.upcoming ? null : coachingTabHref(membershipId, t.tab),
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
  /** *🔒 Leader Notes*: the lock before its name. */
  locked?: boolean;
}

/**
 * The tab bar (`.toptabbar`, `Overall.html:1095-1103`): the person shell's, and `/coaching/me`'s, whose
 * first two tabs open the reader's own screens (P11-T10). `RouteTabs`' underline idiom, because each tab
 * is an address — links in a `nav`, the current one carrying `aria-current`.
 *
 * **A tab with no address is in the bar and cannot be followed yet** (P11-T7 AC-7), in the prototype's
 * disabled idiom, `.nav a.disabled` (`:63`): muted text and a plain cursor, nothing else, its sidebar
 * tint carried to a light ground. Each is a `link` that is `aria-disabled`, so assistive technology hears
 * the tab by its name and that it is not available, and names no phase.
 *
 * **On a phone, one row that scrolls sideways**, as `RouteTabs` is (ADR-0167; UI-013: a session's seven
 * tabs took three lines), the current tab in view. Below 768px only.
 */
export function CoachingTabBar({ items }: { items: readonly CoachingTabItem[] }) {
  const t = useMessages(coachingMessages).person;
  const TAB = cn('-mb-px border-b-2 px-0.5 pb-3 text-md font-semibold', TAB_PHONE);
  const row = useTabRow<HTMLElement>(items.find((tab) => tab.current)?.key);
  return (
    <nav
      ref={row.ref}
      aria-label={t.nav}
      data-fade={row.fade}
      className={cn('mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-hairline', TAB_ROW_PHONE, UNDERLINED_ROW_PHONE)}
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
            className={cn(TAB, 'flex items-center gap-1.5', tab.current ? 'border-amber text-navy' : 'border-transparent text-muted')}
          >
            {tab.locked && <span aria-hidden="true" className="text-xs text-navy-soft">🔒</span>}
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
