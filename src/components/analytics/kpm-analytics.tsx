'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { StatTile } from '@/components/ui/stat-tile';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import {
  ANALYTICS_PERIODS, analyticsQuery, leaderManpower, readKpmAnalytics,
  type AnalyticsLeader, type AnalyticsMoney, type AnalyticsPeriod, type KpmAnalyticsView, type LeaderChip,
} from '@/lib/kpm-analytics';
import { formatPercent, formatRupiahCompact } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';
import { keepTab, readKpmAnalyticsAsPlatform } from '@/lib/platform-reads';
import { GroupFilter } from './group-filter';
import { LeaderList, LeaderSheet } from './leaders';
import { MocDialog, type MocOpen } from './moc';
import { MonthlyProductionChart } from './monthly-production';

/**
 * **KPM Analytics' *Overview*, the owner's page for every leader** (UI-152, UI-109, UI-091, UI-092, UI-095, UI-097;
 * P19.3-T3; the `kpm-leaders` mockups of 3 November and `kpm-mobile` 2), **at every size and for every reader** — the
 * Owner, an Admin, a Core Leader — in the one shell (Phase 19.2), where UI V1 drew it on a phone in the field shell only.
 *
 * 1. **The period pill and *Seluruh KPM ⌄*** (the custom-group filter, OD-258), both in the address (`?period=`,
 *    `?group=`), so a refresh, a retry and *Back* keep them.
 * 2. **The KPM's totals** (UI-109's tiles; AC-4, AC-5): two across on a phone, three on a tablet, six in one row from
 *    1024px — *Manpower* with *"n leader · n agent"*; *APE this month*; ***APE YTD***, the KPM's production this year a
 *    leaver's included, the Overview's figure (ADR-0204 §1); *Coached (7D)*; ***Active this month*** (D1); *MOC*.
 * 3. **The *Leader* list** (`LeaderList`): rows below 1024px, the table from it; a row opens the leader's sheet, or side
 *    panel from 1024px (`LeaderSheet`), and its links go **in the same tab** (UI-095). Back from one, the page comes
 *    back where it was left, the same leader open.
 * 4. ***Monthly production***: six bars ending with this month (UI-091).
 *
 * The states the prototype lacks are Fills (L-01): a skeleton shaped like the tiles and the rows, an error with a retry
 * that keeps the period and the group, and an office with no leader yet.
 */
export function KpmAnalytics({ period, group, platformKpmId }: {
  period: AnalyticsPeriod;
  group: string | null;
  /**
   * ***Lihat sebagai KPM*** (P19.4-T3 AC-4; ADR-0207 §3): the KPM's analytics, read by the Super Admin through the
   * platform read, read-only — no group to manage, no leader's page to open (the Super Admin is in no office).
   */
  platformKpmId?: string;
}) {
  const t = useMessages(kpmAnalyticsMessages);
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useSession();
  const chartId = useId();
  const desktop = useMediaQuery('desktop', { beforePaint: true });
  const office = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);

  /** The period and the group on screen: the address's, and the one just chosen until the address catches up. */
  const [shown, setShown] = useState<{ period: AnalyticsPeriod; group: string | null }>({ period, group });
  useEffect(() => setShown({ period, group }), [period, group]);
  const key = `${shown.period}|${shown.group ?? ''}`;

  const [held, setHeld] = useState<{ key: string; view: KpmAnalyticsView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [chip, setChip] = useState<LeaderChip>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [moc, setMoc] = useState<MocOpen | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    (platformKpmId === undefined
      ? readKpmAnalytics(shown.period, shown.group)
      // Read-only: the leaders' links go to an office's own pages, which the Super Admin does not open.
      : readKpmAnalyticsAsPlatform(platformKpmId, shown.period, shown.group)
        .then((read) => ({ ...read, leaders: read.leaders.map((leader) => ({ ...leader, opens: false })) })))
      .then((view) => { if (live) setHeld({ key, view }); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [key, shown.period, shown.group, attempt, platformKpmId]);

  // A new period or group starts from the skeleton: the old figures under the new choice would lie.
  const view = held?.key === key ? held.view : null;
  const here = `${pathname}${analyticsQuery(shown.period, shown.group)}`;

  // Back from a leader's Unit Dashboard, Group Tree or member page (UI-095): the scroll and the leader as they were.
  useEffect(() => {
    if (!view) return;
    const back = takeReturn(here);
    if (!back) return;
    setChip(back.chip);
    setOpenId(back.leader);
    requestAnimationFrame(() => window.scrollTo(0, back.y));
  }, [view, here]);

  const go = (next: { period: AnalyticsPeriod; group: string | null }) => {
    setShown(next);
    setOpenId(null);
    router.replace(`${pathname}${keepTab(analyticsQuery(next.period, next.group), platformKpmId, 'overview')}`, { scroll: false });
  };
  const opened = view?.leaders.find((l) => l.head.membershipId === openId) ?? null;
  const leave = useCallback(() => saveReturn(here, { leader: openId, chip }), [here, openId, chip]);

  return (
    <div className="min-w-0" data-analytics-overview="">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <PeriodPill period={shown.period} onChoose={(next) => next !== shown.period && go({ period: next, group: shown.group })} />
        {view && (office || view.groups.length > 0) && (
          <GroupFilter
            groups={view.groups}
            group={view.group}
            officePeople={view.officePeople}
            manages={office}
            onChoose={(next) => go({ period: shown.period, group: next })}
          />
        )}
      </div>

      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <OverviewSkeleton />}

      {view && (
        <>
          <Totals view={view} />
          {/* Over a group, its production is its members' — all current — and says so (ADR-0204 §4). */}
          {view.group && <p className="mx-0.5 mt-1.5 text-xs text-muted" data-group-members="">{t.currentMembersOnly}</p>}
          <LeaderList
            leaders={view.leaders}
            period={view.period}
            split={view.thresholds.statusSplitPct}
            desktop={desktop}
            chip={chip}
            onChip={setChip}
            onOpen={(leader: AnalyticsLeader) => setOpenId(leader.head.membershipId)}
            onOpenMoc={setMoc}
          />
          <div className="mx-0.5 mb-2 mt-3.5 flex min-h-11 items-center justify-between gap-3">
            <h2 id={chartId} className="text-md font-bold text-navy">{t.monthlyProduction}</h2>
            <span className="text-sm text-muted">{t.v1.months({ n: view.monthly.length })}</span>
          </div>
          <MonthlyProductionChart monthly={view.monthly} labelledBy={chartId} />
          <LeaderSheet
            leader={opened}
            period={view.period}
            split={view.thresholds.statusSplitPct}
            office={office}
            onClose={() => setOpenId(null)}
            onLeave={leave}
          />
          <MocDialog open={moc} onClose={() => setMoc(null)} />
        </>
      )}
    </div>
  );
}

/**
 * **The KPM's six tiles** (UI-109; `kpm-leaders` 1 and the desktop's one row): 2 across on a phone, 3 on a tablet, 6
 * from 1024px. Every figure the server's, written with the shared formatters.
 */
function Totals({ view }: { view: KpmAnalyticsView }) {
  const t = useMessages(kpmAnalyticsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { total, period } = view;
  return (
    <div className="grid grid-cols-2 gap-2 md:max-lg:grid-cols-3 lg:grid-cols-6" data-totals="">
      <StatTile label={t.headManpower} value={String(total.manpower.total)} sub={leaderManpower(total.manpower, language)} />
      <MoneyTile label={t.headApeMonth({ period })} money={total.apeMonth} />
      <MoneyTile label={t.headApeAnnual} money={total.apeAnnual} />
      <StatTile
        label={t.headCoached}
        value={String(total.coached7d.count)}
        unit={`/ ${total.coached7d.of}`}
        sub={total.coached7d.pct === null ? '—' : formatPercent(total.coached7d.pct, {}, figures)}
      />
      <StatTile
        label={t.headActive({ period })}
        value={total.activeAgents === null ? '–' : String(total.activeAgents)}
        unit={total.activeAgents === null ? undefined : `/ ${total.activeOf}`}
        sub={total.activeAgents === null ? t.notUploaded : total.activePct === null ? '—' : formatPercent(total.activePct, {}, figures)}
      />
      <StatTile label={t.headMoc} value={String(total.mocMet)} unit={`/ ${total.mocOf}`} sub={t.absMeetingMoc} />
    </div>
  );
}

/** An APE tile: the sum, its bar, and *45% of Rp 1,3 M* — or the month not uploaded, or no goal. */
function MoneyTile({ label, money }: { label: string; money: AnalyticsMoney }) {
  const t = useMessages(kpmAnalyticsMessages);
  const figures = useFigureLanguage();
  const sub = money.targetMinor === null
    ? t.noGoal
    : money.pct === null
      ? undefined
      : t.v1.pctOf({ pct: formatPercent(money.pct, {}, figures), target: formatRupiahCompact(money.targetMinor, {}, figures) });
  return (
    <StatTile
      label={label}
      value={money.achievedMinor === null ? t.notUploaded : formatRupiahCompact(money.achievedMinor, {}, figures)}
      bar={money.pct}
      sub={sub}
    />
  );
}

/** *Bulan ini ⌄*: the period, a navy pill over the native list (44px; 40px from 1024px, as the mockup's). */
function PeriodPill({ period, onChoose }: { period: AnalyticsPeriod; onChoose: (period: AnalyticsPeriod) => void }) {
  const t = useMessages(kpmAnalyticsMessages);
  return (
    <span className="relative inline-flex shrink-0">
      <select
        aria-label={t.period}
        value={period}
        onChange={(e) => onChoose(e.target.value as AnalyticsPeriod)}
        className="min-h-11 appearance-none rounded-pill bg-secondary py-0 pl-3.5 pr-8 text-base font-semibold text-secondary-contrast lg:min-h-10"
      >
        {ANALYTICS_PERIODS.map((value) => <option key={value} value={value}>{t.periods[value]}</option>)}
      </select>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-contrast" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

/** The tiles and the rows in outline while the analytics are read: a shape, not figures. */
function OverviewSkeleton() {
  const t = useMessages(kpmAnalyticsMessages);
  return (
    <Skeleton label={t.loading}>
      <div className="grid grid-cols-2 gap-2 md:max-lg:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg bg-card px-3 py-2.5">
            <SkeletonBar className="h-2.5 w-1/2" />
            <SkeletonBar className="mt-2 h-5 w-2/3" />
          </div>
        ))}
      </div>
      <div className="mt-3.5 rounded-lg bg-card p-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <SkeletonBar className="h-9 w-9 rounded-full" />
            <div className="flex-1">
              <SkeletonBar className="h-3 w-1/3" />
              <SkeletonBar className="mt-2 h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/*
 * ── Back to where the reader was (UI-095; P19.3-T3 AC-11) ───────────────────────────────────────
 */

/** Where the page was left for a leader's page: the address, the scroll, the chip and the leader open. This tab only. */
const RETURN_KEY = 'kpm-analytics:return';

interface Return {
  at: string;
  y: number;
  leader: string | null;
  chip: LeaderChip;
}

export function saveReturn(at: string, open: { leader: string | null; chip: LeaderChip }) {
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ at, y: window.scrollY, ...open } satisfies Return));
  } catch {
    // No storage (a private window): Back comes to the top, every leader closed.
  }
}

/** The saved place for this address, taken once; anything else — another address, nothing saved — `null`. */
export function takeReturn(at: string): Return | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Return>;
    if (saved.at !== at || typeof saved.y !== 'number') return null;
    sessionStorage.removeItem(RETURN_KEY);
    const chip: LeaderChip = saved.chip === 'ab' || saved.chip === 'aab' ? saved.chip : 'all';
    return { at, y: saved.y, leader: typeof saved.leader === 'string' ? saved.leader : null, chip };
  } catch {
    return null;
  }
}
