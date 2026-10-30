'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { PageHeader } from '@/components/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, buttonClass, Card, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { kept } from '@/i18n/kept';
import { cn } from '@/lib/cn';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { withDetail } from '@/lib/confirmations';
import { askedFor, type AddAgentResult } from '@/lib/invites';
import { useCan, useSession } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';
import { useOpenedOnce } from '@/lib/use-opened-once';
import {
  lockedWords, productionToast, readUnitDashboard, unitPeriods,
  type UnitDashboardView, type UnitPeriod, type UnitTab,
} from '@/lib/unit-dashboard';
import { UnitRoster } from './unit-roster';
import { UnitTiles } from './unit-tiles';
import { UpdateProductionDialog } from './update-production-dialog';

/** The Activities tab, downloaded when it is first opened (the bundle's budget). */
const UnitActivities = dynamic(() => import('./unit-activities').then((m) => m.UnitActivities), {
  ssr: false,
  loading: () => <TabSkeleton />,
});
/** The title row's *Search agent* sheet, downloaded when the pill is first pressed. */
const UnitSearchSheet = dynamic(() => import('./unit-search-sheet'), { ssr: false });
/** *+ Tambah agent*'s form, downloaded when it is first opened and mounted from then on (`useOpenedOnce`; P18.99-T16). */
const AddAgentDialog = dynamic(() => import('@/components/add-agent-form').then((m) => m.AddAgentDialog), { ssr: false });

/**
 * **The Unit Dashboard** (UI V1, Phase 18.99 T4; the owner's report of 2026-10-30, UI-001 to UI-012 and UI-028;
 * `unit-dashboard-mobile`, `unit-dashboard-desktop`; before it P15-T2 to T4).
 *
 * - **The title row** (UI-004's): *Unit Dashboard* — or *Unit Dashboard {name}* for a unit below the reader — and,
 *   below 1024px, **the *Search agent* pill** (O-13; UI-012), which opens the shared picker in a sheet. From 1024px the
 *   sidebar's *Search agent* does it.
 * - **Overview | Activities** (UI-001): a pill segmented control under the title, the tab in the address
 *   (`?tab=activities`), switching without a reload. *Overview* reads `GET /unit/dashboard` for its period — the period
 *   pill beside the tabs, *Bulan ini* first, in the address (`?period=`) — and draws the tiles (UI-003) and the roster
 *   (UI-002, UI-005, UI-007, UI-009, UI-011, UI-028). *Activities* reads its own (`unit-activities.tsx`).
 * - **A row opens the person** (UI-011): the scroll is kept, so the person page's ‹ comes back to the same place.
 * - ***+ Tambah agent*** and ***Perbarui produksi*** on a tablet and a desktop, in the roster's header; **not on a
 *   phone** (the owner, 30 Oct: adding people lives in User Management).
 *
 * The states the prototype lacks are Fills (L-01): a skeleton shaped like the tiles and the roster, an error with a
 * retry, the empty unit of somebody who leads nobody, and the not-found unit.
 */
export function UnitDashboard({ forId, period, tab = 'overview' }: { forId?: string; period: UnitPeriod; tab?: UnitTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useSession();
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const v1 = useMessages(uiV1Messages);
  const addAgent = useMessages(addAgentMessages);
  const confirmed = useMessages(confirmationMessages);
  const { toast, show } = useToast();
  /** Which range to draw, asked before the read answers so a phone never draws a table first. */
  const phone = useMediaQuery('phone');
  const tablet = useMediaQuery('tablet');
  const size = phone ? 'phone' : tablet ? 'tablet' : 'desktop';
  const tabsId = useId();

  /** The period and the tab on screen: the address's, and the one just pressed until the address catches up. */
  const [shown, setShown] = useState<UnitPeriod>(period);
  const [shownTab, setShownTab] = useState<UnitTab>(tab);
  useEffect(() => setShown(period), [period]);
  useEffect(() => setShownTab(tab), [tab]);

  const key = `${forId ?? ''}|${shown}`;
  const [held, setHeld] = useState<{ key: string; view: UnitDashboardView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);
  const addOpened = useOpenedOnce(adding);
  const [searching, setSearching] = useState(false);
  /** The head's name, from whichever tab read it: the title of a unit below the reader. */
  const [headName, setHeadName] = useState<string | null>(null);
  const mayInvite = useCan('member:invite');

  useEffect(() => {
    if (shownTab !== 'overview') return;
    let live = true;
    setError(null);
    setMissing(false);
    readUnitDashboard({ period: periodOf(key), for: forId })
      .then((view) => {
        if (!live) return;
        setHeld({ key, view });
        setHeadName(view.head.name);
      })
      .catch((err) => {
        if (!live) return;
        if (forId && err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [key, forId, attempt, shownTab]);

  // A save's read keeps the roster on screen until the new one arrives; a new period starts from the skeleton.
  const view = held?.key === key ? held.view : null;
  /** This page's address as a row's ‹ comes back to it: the period and the tab when they are not the first. */
  const here = addressOf(pathname, shown, shownTab);

  // Back from a person (UI-011): the roster where it was left.
  useEffect(() => {
    if (view) returnToScroll(here);
  }, [view, here]);
  const keepScroll = useCallback(() => saveScroll(here), [here]);
  const onActivitiesHead = useCallback((head: { name: string }) => setHeadName(head.name), []);

  const go = (nextPeriod: UnitPeriod, nextTab: UnitTab) => router.replace(addressOf(pathname, nextPeriod, nextTab), { scroll: false });
  const choosePeriod = (next: UnitPeriod) => {
    if (next === shown) return;
    setShown(next);
    go(next, shownTab);
  };
  const chooseTab = (next: UnitTab) => {
    if (next === shownTab) return;
    setShownTab(next);
    go(shown, next);
  };

  if (missing) return <UnitNotFound />;

  const title = forId && headName ? t.titleOf({ name: headName }) : t.prototype.title;
  const canUpdate = !!view && view.production.canUpdate && !me?.impersonationReadOnly;
  /*
   * **+ Tambah agent** (P18.96-T3 AC-1, ADR-0170 §1): into the unit on screen — the reader's own, or for the Owner and an
   * Admin any leader's. A leader opening a unit below their own is not offered it. Not on a phone (UI-002, the owner).
   */
  const office = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);
  const canAdd = !!view && mayInvite && !me?.impersonationReadOnly && (view.head.isReader || office) && size !== 'phone';
  const addLeader = view && !view.head.isReader ? { membershipId: view.head.membershipId, name: view.head.name } : null;
  const addButton = canAdd ? (
    <Button variant="secondary" className="h-auto rounded-pill px-3.5 py-1.5 text-sm" onClick={() => setAdding(true)}>
      {addAgent.open}
    </Button>
  ) : null;
  const added = (result: AddAgentResult) => {
    if (result.outcome === 'linked') {
      show(withDetail(confirmed.agentAdded, t.addedDetail({ name: result.member.fullName })));
      setAttempt((n) => n + 1);
    }
    if (result.outcome === 'transfer_requested') {
      show(withDetail(confirmed.transferRequested, t.transferDetail({ name: askedFor(result.transfer) })));
    }
  };
  const updateButton = canUpdate && size !== 'phone' ? (view.production.locked ? (
    // Drawn and not usable: the month is locked, and the words say who reopens it (P15-T3).
    <TippedGlyph
      glyph={t.prototype.updateProduction}
      name={t.prototype.updateProduction}
      tip={lockedWords(view.production.month, language, figures)}
      unavailable
      align="fit"
      face={buttonClass('primary', 'h-auto w-auto rounded-pill px-3.5 py-1.5 text-sm')}
    />
  ) : (
    <Button className="h-auto rounded-pill px-3.5 py-1.5 text-sm" onClick={() => setUpdating(true)}>
      {t.prototype.updateProduction}
    </Button>
  )) : null;

  const nobody = <NobodyYet action={canAdd ? addButton : null} />;
  const searchPill = (
    <button
      type="button"
      aria-label={v1.search.label}
      onClick={() => setSearching(true)}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink"
    >
      <LineIcon name="search" className="h-5 w-5" />
    </button>
  );

  return (
    <div className="min-w-0">
      <PageHeader title={title} control={searchPill} />

      <div className="mb-3 flex items-center gap-2">
        <div role="tablist" aria-label={t.prototype.title} className="flex min-w-0 flex-1 rounded-pill bg-card p-[3px] lg:flex-none">
          {(['overview', 'activities'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabsId}-${id}`}
              aria-selected={shownTab === id}
              aria-controls={`${tabsId}-panel`}
              onClick={() => chooseTab(id)}
              className={cn(
                'min-h-11 flex-1 whitespace-nowrap rounded-pill px-4 text-base font-semibold lg:min-h-9 lg:flex-none',
                shownTab === id ? 'bg-navy text-white' : 'text-muted hover:text-navy',
              )}
            >
              {t.v1.tabs[id]}
            </button>
          ))}
        </div>
        {shownTab === 'overview' && !view?.empty && <PeriodPill period={shown} onChoose={choosePeriod} />}
      </div>

      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${shownTab}`}>
        {shownTab === 'activities' ? (
          <UnitActivities forId={forId} onHead={onActivitiesHead} empty={nobody} />
        ) : (
          <>
            {error && (
              <div className="mt-2">
                <ErrorBanner {...error} />
                <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.own.tryAgain}</Button>
              </div>
            )}
            {!view && !error && <UnitSkeleton />}
            {view?.empty && nobody}
            {view && !view.empty && (
              <>
                <UnitTiles view={view} period={shown} />
                <UnitRoster
                  view={view}
                  period={shown}
                  from={here}
                  size={size}
                  onLeave={keepScroll}
                  actions={(addButton || updateButton) && <>{addButton}{updateButton}</>}
                />
                {updating && (
                  <UpdateProductionDialog
                    view={view}
                    onClose={() => setUpdating(false)}
                    onStale={() => setAttempt((n) => n + 1)}
                    onSaved={(updated) => {
                      setUpdating(false);
                      show(productionToast(updated, language));
                      if (updated > 0) setAttempt((n) => n + 1);
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
      {canAdd && view && addOpened && (
        <AddAgentDialog open={adding} today={view.today} leader={addLeader} onClose={() => setAdding(false)} onAdded={added} />
      )}
      {searching && <UnitSearchSheet onClose={() => setSearching(false)} />}
      <Toast toast={toast} />
    </div>
  );
}

const periodOf = (key: string) => key.slice(key.indexOf('|') + 1) as UnitPeriod;

/** The page's address for a period and a tab: each in the query only when it is not the first. */
export function addressOf(pathname: string, period: UnitPeriod, tab: UnitTab): string {
  const search = new URLSearchParams();
  if (period !== 'month') search.set('period', period);
  if (tab !== 'overview') search.set('tab', tab);
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Where the roster was left, for a row's ‹ (UI-011). Per tab, in this tab's session only; it may be unavailable. */
const SCROLL_KEY = 'unit-dashboard:return';

function saveScroll(at: string) {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ at, y: window.scrollY }));
  } catch {
    // No storage (a private window): ‹ comes back to the top.
  }
}

function returnToScroll(at: string) {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { at?: string; y?: number };
    if (saved.at !== at || typeof saved.y !== 'number') return;
    sessionStorage.removeItem(SCROLL_KEY);
    const y = saved.y;
    requestAnimationFrame(() => window.scrollTo(0, y));
  } catch {
    // Unreadable: the top.
  }
}

/**
 * **The period pill** (UI-002, `unit-dashboard-mobile` screen 1, `unit-dashboard-desktop`): *Bulan ini ⌄*, navy, a
 * native select — the phone's own picker — of *7 hari terakhir · Bulan ini · Tahun ini*, 16px on a phone so it does not
 * zoom. Hidden on *Activities*, whose own controls set its period (UI-001).
 */
function PeriodPill({ period, onChoose }: { period: UnitPeriod; onChoose: (p: UnitPeriod) => void }) {
  const language = useLanguage();
  const t = useMessages(unitDashboardMessages);
  return (
    <label className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">{t.period}</span>
      <select
        value={period}
        onChange={(e) => onChoose(e.target.value as UnitPeriod)}
        className="h-11 cursor-pointer appearance-none rounded-pill border-0 bg-navy py-0 pl-4 pr-9 text-lg font-semibold text-white md:text-base lg:h-9"
      >
        {unitPeriods(language).map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
      </select>
      <LineIcon name="chevronDown" className="pointer-events-none absolute right-3 h-4 w-4 text-white" />
    </label>
  );
}

/** The tiles and the roster, in outline, while the dashboard is read. */
function UnitSkeleton() {
  const t = useMessages(unitDashboardMessages).own;
  return (
    <Skeleton label={t.loading}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="min-h-[90px] rounded-lg bg-card px-3 py-2.5">
            <SkeletonBar className="h-2.5 w-1/2" />
            <SkeletonBar className="mt-3 h-6 w-2/3" />
            <SkeletonBar className="mt-2 w-4/5" />
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-card lg:mt-4">
        <div className="px-3 py-3"><SkeletonBar className="h-4 w-40" /></div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-t border-divider px-3 py-3">
            <SkeletonBar className="h-9 w-9 rounded-full" />
            <SkeletonBar className="h-3.5 w-1/3" />
            <SkeletonBar className="ml-auto h-5 w-20 rounded-pill" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

function TabSkeleton() {
  const t = useMessages(unitDashboardMessages).v1;
  return (
    <Skeleton label={t.loadingActivities}>
      <div className="h-64 rounded-lg bg-card" />
    </Skeleton>
  );
}

/**
 * Somebody who leads nobody (D-reach): an empty unit, never a refusal. Ours to word (L-01), pointing to the reader's own
 * screens. On a tablet and a desktop a leader who leads nobody yet adds their first agent here (P18.96-T3).
 */
function NobodyYet({ action }: { action?: React.ReactNode }) {
  const t = useMessages(unitDashboardMessages).own;
  return (
    <Card className="mt-2 p-0">
      <EmptyState
        title={t.emptyTitle}
        boost="thinking"
        action={(
          <div className="text-md text-muted">
            <p>{t.emptyLine}</p>
            {action && <div className="mt-3 flex justify-center">{action}</div>}
            <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
              <Link href="/summary" className={cn('font-semibold text-navy underline-offset-2 hover:underline', TEXT_TAP)}>{kept('Personal summary')}</Link>
              <Link href="/activity/log" className={cn('font-semibold text-navy underline-offset-2 hover:underline', TEXT_TAP)}>{kept('Activity management')}</Link>
            </p>
          </div>
        )}
      />
    </Card>
  );
}

/**
 * A unit the reader cannot open (P15-T4 AC-2): one answer for each case, so it tells nobody who exists. Ours to word
 * (L-01).
 */
function UnitNotFound() {
  const t = useMessages(unitDashboardMessages);
  return (
    <div className="min-w-0">
      <PageHeader title={t.prototype.title} />
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{t.own.notFoundTitle}</h2>
        <p className="mt-1 text-md text-muted">{t.own.notFoundLine}</p>
        <p className="mt-3">
          <Link href="/unit/dashboard" className={cn('text-md font-semibold text-navy underline-offset-2 hover:underline', TEXT_TAP)}>
            {t.own.backToYours}
          </Link>
        </p>
      </Card>
    </div>
  );
}
