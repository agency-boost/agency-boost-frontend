'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { SamplePreview, useSampleName } from '@/components/sample-preview';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, buttonClass, Card, ErrorBanner } from '@/components/ui/field';
import { HEADER_CONTROL } from '@/components/ui/header-control';
import { LineIcon } from '@/components/ui/line-icon';
import { PickerMenu } from '@/components/ui/picker-menu';
import { TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { samplePreviewMessages } from '@/i18n/messages/sample-preview';
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
import { leadsByRole } from '@/lib/field-nav';
import { sampleUnitView } from '@/lib/sample-data';
import {
  keepView, lockedWords, productionToast, readUnitDashboard, storedView, unitPeriods, unitViews,
  type GroupMembersAdded, type UnitDashboardView, type UnitInformal, type UnitPeriod, type UnitTab, type UnitView,
  type UnitViews,
} from '@/lib/unit-dashboard';
import { UnitRoster } from './unit-roster';
import { UnitTiles } from './unit-tiles';
import { UpdateProductionDialog } from './update-production-dialog';

/** The Activities tab, downloaded when it is first opened (the bundle's budget). */
const UnitActivities = dynamic(() => import('./unit-activities').then((m) => m.UnitActivities), {
  ssr: false,
  loading: () => <TabSkeleton />,
});
/** The *Potensi* tab (P19.1-T6, UI-155), downloaded when it is first opened (the bundle's budget). */
const UnitPotensi = dynamic(() => import('./unit-potensi').then((m) => m.UnitPotensi), {
  ssr: false,
  loading: () => <TabSkeleton />,
});
/** The title row's *Search agent* sheet, downloaded when the pill is first pressed. */
const UnitSearchSheet = dynamic(() => import('./unit-search-sheet'), { ssr: false });
/** *+ Tambah agent*'s form, downloaded when it is first opened and mounted from then on (`useOpenedOnce`; P18.11-T16). */
const AddAgentDialog = dynamic(() => import('@/components/add-agent-form').then((m) => m.AddAgentDialog), { ssr: false });
/** *+ Tambah ke grup*'s sheet (ADR-0249 §4), downloaded when it is first opened. */
const InformalGroupSheet = dynamic(() => import('./informal-group-sheet'), { ssr: false });

/** What a read of either tab says about the views: the one answered, those offered, and *Grup informal*'s line. */
interface ViewAnswer {
  scope: UnitView;
  scopes: UnitViews;
  informal: UnitInformal | null;
}

/**
 * **The Unit Dashboard** (UI V1, Phase 18.11 T4; the owner's report of 2026-10-30, UI-001 to UI-012 and UI-028;
 * `unit-dashboard-mobile`, `unit-dashboard-desktop`; before it P15-T2 to T4).
 *
 * - **The title row** (UI-004's): *Unit Dashboard* — or *Unit Dashboard {name}* for a unit below the reader — and,
 *   below 1024px, **the *Search agent* pill** (O-13; UI-012), which opens the shared picker in a sheet. From 1024px the
 *   sidebar's *Search agent* does it.
 * - **Overview | Activities | Potensi** (UI-001, UI-155): a pill segmented control under the title, the tab in the
 *   address (`?tab=activities`, `?tab=potensi`), switching without a reload. **On a phone the slider runs the full width
 *   on its own row, in the same place on every tab, and the row below holds that tab's controls** (P19.8-T4 AC-1, MOB
 *   UI-176; ADR-0229 §1) — 3 × 114px at 375px, 44px; from 768px the tabs and the period sit on one row, as before. Every
 *   control 13px / 600 / 44px at every size (MOB UI-171). *Overview* reads `GET /unit/dashboard` for its period — **the
 *   period picker**, *Bulan ini ⌄*, a menu under its button (`PickerMenu`, ADR-0227 §2; never a native select), in the
 *   address (`?period=`) — and draws the tiles (UI-003) and the roster (UI-002, UI-005, UI-007, UI-009, UI-011, UI-028).
 *   *Activities* and *Potensi* read their own (`unit-activities.tsx`, `unit-potensi.tsx`).
 * - **A row opens the person** (UI-011): the scroll is kept, so the person page's ‹ comes back to the same place.
 * - ***+ Tambah agent*** and ***Perbarui produksi*** on a tablet and a desktop, in the roster's header; **not on a
 *   phone** (the owner, 30 Oct: adding people lives in User Management).
 *
 * - **The view picker** (the client's message of 11 November 2026, item 7; ADR-0249): *Grup langsung · Grup informal ·
 *   Semua downline*, beside the period on *Overview* and beside the month on *Potensi* — **never on *Aktivitas***, whose
 *   *Group* is *Grup langsung*. Only the views the server offers this head; **hidden with one or none**. The choice is
 *   the address's (`?scope=`) first, then — the reader's own dashboard only — the one last chosen on this browser
 *   (`ab.unit.scope.{membershipId}`), then the server's default. In *Grup informal* a line says ***"{n} AB di bawah Anda
 *   belum masuk grup"***, and the Owner or an Admin is offered ***+ Tambah ke grup***, a sheet in place.
 *
 * The states the prototype lacks are Fills (L-01): a skeleton shaped like the tiles and the roster, an error with a
 * retry, the empty unit of somebody who leads nobody, and the not-found unit.
 */
export function UnitDashboard({
  forId, period, tab = 'overview', scope = null,
}: { forId?: string; period: UnitPeriod; tab?: UnitTab; scope?: UnitView | null }) {
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

  /*
   * **The view asked for** (ADR-0249): the address's; else, on the reader's own dashboard, the one last chosen here —
   * read in an effect, never on the server, before the first read; else `null`, the server's default. A view of another
   * leader's unit never reads nor writes the reader's own choice.
   */
  const readerId = me?.membership?.membershipId ?? null;
  const [view0, setView0] = useState<{ ready: boolean; view: UnitView | null }>({ ready: false, view: scope });
  useEffect(() => {
    setView0({ ready: true, view: scope ?? (forId ? null : storedView(readerId)) });
  }, [scope, forId, readerId]);
  const chosenView = view0.view;
  const [answer, setAnswer] = useState<ViewAnswer | null>(null);
  const [tagging, setTagging] = useState(false);
  const mayTag = useCan('member:tag_group');

  const key = `${forId ?? ''}|${shown}|${chosenView ?? ''}`;
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
  /*
   * **The *Potensi* tab is the role's** (P19.1-T6 AC-1; UI-155, UI-159 item 4; ADR-0189): an AB and an AAB see it
   * whatever their downline, the Owner and an Admin in their field view; **an Agent never does** — the API refuses their
   * read too (`unit_dashboard:read_potensi`). On a typed `?tab=potensi` an Agent lands on *Overview*.
   */
  const mayPotensi = useCan('unit_dashboard:read_potensi');
  const tabs = mayPotensi ? (['overview', 'activities', 'potensi'] as const) : (['overview', 'activities'] as const);
  const activeTab: UnitTab = shownTab === 'potensi' && !mayPotensi ? 'overview' : shownTab;

  useEffect(() => {
    if (activeTab !== 'overview' || !view0.ready) return;
    let live = true;
    setError(null);
    setMissing(false);
    readUnitDashboard({ period: periodOf(key), for: forId, scope: chosenView })
      .then((view) => {
        if (!live) return;
        setHeld({ key, view });
        setHeadName(view.head.name);
        if (view.scope && view.scopes) setAnswer({ scope: view.scope, scopes: view.scopes, informal: view.informal ?? null });
      })
      .catch((err) => {
        if (!live) return;
        if (forId && err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [key, forId, chosenView, attempt, activeTab, view0.ready]);

  // A save's read keeps the roster on screen until the new one arrives; a new period starts from the skeleton.
  const view = held?.key === key ? held.view : null;
  /** This page's address as a row's ‹ comes back to it: the period, the tab and the view when the address holds them. */
  const here = addressOf(pathname, shown, shownTab, scope);

  // Back from a person (UI-011): the roster where it was left.
  useEffect(() => {
    if (view) returnToScroll(here);
  }, [view, here]);
  const keepScroll = useCallback(() => saveScroll(here), [here]);
  const onActivitiesHead = useCallback((head: { name: string }) => setHeadName(head.name), []);
  // A read that names no views (one from before them) leaves the picker as it was.
  const onPotensiAnswered = useCallback((next: Partial<ViewAnswer>) => {
    if (next.scope && next.scopes) setAnswer({ scope: next.scope, scopes: next.scopes, informal: next.informal ?? null });
  }, []);

  const go = (nextPeriod: UnitPeriod, nextTab: UnitTab) =>
    router.replace(addressOf(pathname, nextPeriod, nextTab, scope), { scroll: false });
  const chooseView = (next: UnitView) => {
    if (next === (chosenView ?? answer?.scope)) return;
    setView0({ ready: true, view: next });
    // Remembered for the next visit, on the reader's own dashboard only (*"Pilihan terakhir diinget"*).
    if (!forId) keepView(readerId, next);
    router.replace(addressOf(pathname, shown, shownTab, next), { scroll: false });
  };
  const tagged = (result: GroupMembersAdded) => {
    setTagging(false);
    show(t.views.sheet.added({ n: result.added, group: result.name }));
    setAttempt((n) => n + 1);
  };
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
  /*
   * **The office's read-only view** (P19.3-T3 AC-3; UI-152's Appendix D row): the Owner or an Admin on another leader's
   * unit — from KPM Analytics' leader sheet, the member page or the org tree — reads it as that leader sees it, with no
   * write control. The server says so (`readOnly`) and refuses the save; before it answers, the address says so.
   */
  const office = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);
  const readOnly = view ? view.readOnly : Boolean(forId) && office;
  const canUpdate = !!view && view.production.canUpdate && !me?.impersonationReadOnly && !readOnly;
  /*
   * **+ Tambah agent** (P18.8-T3 AC-1, ADR-0170 §1): into the unit on screen — the reader's own, or for the Owner and an
   * Admin any leader's. A leader opening a unit below their own is not offered it. Not on a phone (UI-002, the owner).
   */
  const canAdd = !!view && mayInvite && !me?.impersonationReadOnly && !readOnly && (view.head.isReader || office) && size !== 'phone';
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

  /*
   * **The view picker** (ADR-0249): the views offered, hidden with one or none — beside the period on *Overview*, beside
   * the month on *Potensi*, never on *Aktivitas*. Its value is the view asked for while it is offered, else the answer's.
   */
  const offered = answer?.scopes.offered ?? [];
  const viewPicker = activeTab !== 'activities' && answer && offered.length > 1 ? (
    <PickerMenu
      label={t.views.label}
      value={chosenView && offered.includes(chosenView) ? chosenView : answer.scope}
      options={unitViews(language).filter((v) => offered.includes(v.id)).map(({ id, label }) => ({ value: id, label }))}
      onChange={chooseView}
      className="shrink-0"
    />
  ) : null;
  // *Grup informal*'s line (ADR-0249 §4): the ABs below the head in none of their groups — and, for the Owner or an
  // Admin, *+ Tambah ke grup*. Nothing when there are none.
  const informal = answer?.scope === 'informal' ? answer.informal : null;
  const canTag = !!informal?.canTag && mayTag && !me?.impersonationReadOnly && (informal?.abs?.length ?? 0) > 0;
  const informalLine = informal && informal.absNotInGroup > 0 ? (
    <p data-informal-line="" className="mb-3 flex flex-wrap items-center gap-x-3 text-md text-muted">
      <span>{t.views.absNotInGroup({ n: informal.absNotInGroup, name: forId ? headName : null })}</span>
      {canTag && (
        <button
          type="button"
          onClick={() => setTagging(true)}
          className="inline-flex items-center font-semibold text-navy underline-offset-2 hover:underline max-lg:min-h-11"
        >
          {t.views.addToGroup}
        </button>
      )}
    </p>
  ) : null;
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

      <div className="mb-3 flex items-center gap-2 max-md:flex-wrap">
        <div role="tablist" aria-label={t.prototype.title} className="flex min-w-0 flex-1 rounded-pill bg-card p-[3px] max-md:basis-full max-md:p-0 lg:flex-none">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabsId}-${id}`}
              aria-selected={activeTab === id}
              aria-controls={`${tabsId}-panel`}
              onClick={() => chooseTab(id)}
              className={cn(
                'flex-1 whitespace-nowrap rounded-pill px-4 lg:flex-none',
                HEADER_CONTROL,
                activeTab === id ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
              )}
            >
              {t.v1.tabs[id]}
            </button>
          ))}
        </div>
        {activeTab === 'overview' && <PeriodPill period={shown} onChoose={choosePeriod} />}
        {activeTab === 'overview' && viewPicker}
      </div>
      {activeTab === 'overview' && informalLine}

      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${activeTab}`}>
        {activeTab === 'potensi' ? (
          view0.ready ? (
            <UnitPotensi
              forId={forId}
              onHead={onActivitiesHead}
              readOnly={readOnly}
              scope={chosenView}
              reload={attempt}
              onAnswered={onPotensiAnswered}
              viewPicker={viewPicker}
              informalLine={informalLine && <div className="mt-2">{informalLine}</div>}
            />
          ) : <TabSkeleton />
        ) : activeTab === 'activities' ? (
          // A leader by role with nobody yet sees the normal table at 0 (MOB UI-181, D-37); anybody else, the empty unit.
          <UnitActivities forId={forId} onHead={onActivitiesHead} empty={leadsByRole(me?.membership) ? null : nobody} />
        ) : (
          <>
            {error && (
              <div className="mt-2">
                <ErrorBanner {...error} />
                <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.own.tryAgain}</Button>
              </div>
            )}
            {!view && !error && <UnitSkeleton />}
            {/* A leader by role sees the sample (ADR-0189 §3); anybody else on a typed address, the plain empty unit. */}
            {view?.empty && (leadsByRole(me?.membership) ? <EmptyUnit view={view} size={size} action={addButton} /> : nobody)}
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
      {tagging && informal && answer && (
        <InformalGroupSheet
          informal={informal}
          head={{ membershipId: view?.head.membershipId ?? forId ?? readerId ?? '', name: headName ?? view?.head.name ?? '' }}
          onClose={() => setTagging(false)}
          onAdded={tagged}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

const periodOf = (key: string) => key.split('|')[1] as UnitPeriod;

/**
 * The page's address for a period, a tab and a view: the period and the tab only when they are not the first; the view
 * when one was chosen (ADR-0249) — the address's is what a reload and a shared link open.
 */
export function addressOf(pathname: string, period: UnitPeriod, tab: UnitTab, view: UnitView | null = null): string {
  const search = new URLSearchParams();
  if (period !== 'month') search.set('period', period);
  if (tab !== 'overview') search.set('tab', tab);
  if (view !== null) search.set('scope', view);
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
 * **The period picker** (UI-002; and P19.8-T4 AC-12, MOB UI-171, ADR-0227 §2): *Bulan ini ⌄*, a header button that opens a
 * small menu right under it — *7 hari terakhir · Bulan ini · Tahun ini* — the shared `PickerMenu`, at every size; it
 * was a native select, 16px on a phone. On a phone it sits on the row under the slider (MOB UI-176). Hidden on
 * *Activities* and *Potensi*, whose own controls set their period (UI-001).
 */
function PeriodPill({ period, onChoose }: { period: UnitPeriod; onChoose: (p: UnitPeriod) => void }) {
  const language = useLanguage();
  const t = useMessages(unitDashboardMessages);
  return (
    <PickerMenu
      label={t.period}
      value={period}
      options={unitPeriods(language).map(({ id, label }) => ({ value: id, label }))}
      onChange={onChoose}
      className="shrink-0"
    />
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
 * screens. On a tablet and a desktop a leader who leads nobody yet adds their first agent here (P18.8-T3).
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
 * **A leader's unit with nobody in it yet** (P19-T4 AC-3; D-37, UI-159 item 3; ADR-0189 §3; P19.8-T4 AC-11, MOB UI-181,
 * ADR-0229 §9): the page's normal layout — its four tiles at *0*, *Active Agent* *0 dari –* with *–* in its ring and its
 * chips, from the server's empty view — and under it the roster as it will look, greyed and labelled *Contoh*
 * (`UnitTiles`' and `UnitRoster`'s own drawing of `sampleUnitView`), its chips on one row, with one next step: *+ Tambah
 * agent* where the screen offers it, else *Tambah agent pertama* in User Management. **No *Belum ada data* line** (OD-280's
 * default, amending ADR-0189 §2 for this page).
 */
function EmptyUnit({ view, size, action }: { view: UnitDashboardView; size: 'phone' | 'tablet' | 'desktop'; action: React.ReactNode }) {
  const t = useMessages(samplePreviewMessages);
  const { person } = useSampleName();
  const sample = sampleUnitView(view, person);
  return (
    <>
      <UnitTiles view={view} period={view.period} />
      <SamplePreview
        sample={<UnitRoster view={sample} period="month" from="/unit/dashboard" size={size} />}
        // Not on a phone, where adding people lives in User Management (UI-002, the owner, 30 Oct).
        action={action ?? <ButtonLink href="/user-management/add">{t.next.addFirstAgent}</ButtonLink>}
      />
    </>
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
