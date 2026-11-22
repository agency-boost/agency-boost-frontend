'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { RungTag } from '@/components/ui/rung-tag';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import {
  barWidth, groupParam, readOverviewPerformance, shiftMonth, type OverviewGroupRef, type OverviewPerformanceView,
  type PerformanceRow, type PerformanceTotals,
} from '@/lib/kpm-overview';
import { useCan } from '@/lib/session';
import { kept } from '@/i18n/kept';
import { SectionHeading } from './usage-section';

/** The target and Group dialogs, loaded on the tap that opens one (the bundle). */
const TargetDialog = dynamic(() => import('@/components/groups/target-dialog').then((m) => m.TargetDialog), { ssr: false });
const GroupDialog = dynamic(() => import('@/components/groups/group-dialog').then((m) => m.GroupDialog), { ssr: false });

/** The orange label before an AB group's AB. */
const AB_RUNG = { code: 'ab', label: kept('AB') } as const;

/**
 * **5 · Performa vs target** (P19.19-T2; the brief's §4; ADR-0270): its own month — *‹ November 2026 ›*, › off on the
 * office's month — the navy ***Total KPM*** line, then each informal group's total line and **one row per AB group**:
 * APE % with *Rp x / target* (Goal Setting ÷ 12, not editable here), *Active Agent x / target* and *Rekrut x / target*.
 *
 * - **The two target tiles look tappable** — white, a thin border, a soft shadow and a › — and open the target dialog
 *   (`TargetDialog`, P19.17-T4); the APE tile has none. After *Simpan* the month is read again, so the row, its group's
 *   total and the KPM's update.
 * - **Group** on each AB group opens the Group dialog (`GroupDialog`); a move regroups the whole page (`onRegroup`).
 * - A month not uploaded reads *Belum diunggah* and *"–"*, never 0. Only a steward who may write sees the controls as
 *   controls: the server refuses everyone else all the same.
 */
export function PerformanceSection({
  group, version, onRegroup,
}: {
  group: OverviewGroupRef | null;
  /** Bumped when the page regroups: the section reads again. */
  version: number;
  onRegroup: () => void;
}) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const canGroup = useCan('member:tag_group');
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<OverviewPerformanceView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<PerformanceRow | null>(null);
  const [grouping, setGrouping] = useState<PerformanceRow | null>(null);

  const read = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    setError(null);
    readOverviewPerformance(month, groupParam(group))
      .then((next) => { if (live) setView(next); })
      .catch((err: unknown) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [month, group, version, attempt]);

  const shown = view?.month ?? month;
  const switcher = view && (
    <div className="flex items-center rounded-pill bg-card shadow-sm" data-month-switcher="">
      <button
        type="button"
        aria-label={t.previousMonth}
        disabled={view.month <= view.earliestMonth}
        onClick={() => setMonth(shiftMonth(view.month, -1))}
        className="flex h-11 w-11 items-center justify-center rounded-pill text-navy disabled:text-muted"
      >
        <LineIcon name="chevronLeft" className="h-4 w-4" />
      </button>
      <span className="min-w-[8.5rem] text-center text-md font-semibold text-navy" aria-live="polite">
        {formatMonthLong(view.month, figures)}
      </span>
      <button
        type="button"
        aria-label={t.nextMonth}
        disabled={view.month >= view.currentMonth}
        onClick={() => setMonth(shiftMonth(view.month, 1))}
        className="flex h-11 w-11 items-center justify-center rounded-pill text-navy disabled:text-muted"
      >
        <LineIcon name="chevronRight" className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <section aria-labelledby="overview-performance" data-section="performance" data-month={shown ?? undefined}>
      <SectionHeading id="overview-performance" aside={switcher}>{t.performanceTitle}</SectionHeading>
      {error ? (
        <div className="rounded-lg bg-card p-3.5">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-2" onClick={read}>{t.tryAgain}</Button>
        </div>
      ) : !view ? (
        <Skeleton label={t.loading}>
          <div className="space-y-2 rounded-lg bg-card p-3.5">
            <SkeletonBar className="h-20 w-full" />
            <SkeletonBar className="h-20 w-full" />
          </div>
        </Skeleton>
      ) : (
        <div className="overflow-hidden rounded-lg bg-card">
          {group === null && (
            <div data-total-kpm="" className="bg-secondary p-3.5 text-secondary-contrast">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-md font-extrabold">{t.totalKpm}</p>
                <p className="text-sm font-semibold text-secondary-muted">
                  {t.groupCounts({
                    groups: formatNumber(view.groups.filter((g) => g.group !== null).length, {}, figures),
                    abGroups: formatNumber(view.total.abGroups, {}, figures),
                  })}
                </p>
              </div>
              <Tiles totals={view.total} navy />
            </div>
          )}
          {view.groups.length === 0 && <p className="px-3.5 py-4 text-sm text-muted">{t.noAbGroups}</p>}
          {view.groups.map((g) => (
            <div key={g.group?.groupId ?? 'none'} data-perf-group={g.group?.groupId ?? 'none'}>
              <div className="bg-primary/[0.12] p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-md font-extrabold text-navy">{g.group?.name ?? t.noGroup}</p>
                  <p className="text-sm font-semibold text-navy">{t.groupTotal({ n: formatNumber(g.totals.abGroups, {}, figures) })}</p>
                </div>
                <Tiles totals={g.totals} />
              </div>
              {g.abGroups.map((row) => (
                <div key={row.abMembershipId} data-ab-group={row.abMembershipId} className="border-t border-divider p-3.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={row.name} photoUrl={row.photoUrl} seed={row.abMembershipId} size={32} />
                    <p className="min-w-0 flex-1 text-sm font-bold text-ink [overflow-wrap:anywhere]">
                      <RungTag rung={AB_RUNG} className="mr-1" />
                      <span className="uppercase">{t.abGroup({ name: row.name })}</span>
                    </p>
                    <span className="shrink-0 text-sm text-muted">{t.people({ n: formatNumber(row.people, {}, figures) })}</span>
                    {canGroup && (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={t.groupFor({ name: row.name })}
                        onClick={() => setGrouping(row)}
                        className="flex min-h-11 shrink-0 items-center gap-1 rounded-pill border border-line bg-card px-3 text-sm font-bold text-navy"
                      >
                        <LineIcon name="usersGroup" className="h-4 w-4" />{t.group}
                      </button>
                    )}
                  </div>
                  <Tiles
                    totals={row}
                    row={row}
                    onTarget={view.canWrite ? () => setTarget(row) : undefined}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {target && view && (
        <TargetDialog
          ab={{ membershipId: target.abMembershipId, name: target.name, role: AB_RUNG.label }}
          month={view.month}
          onClose={() => setTarget(null)}
          onSaved={() => { setTarget(null); read(); }}
        />
      )}
      {grouping && (
        <GroupDialog
          ab={{ membershipId: grouping.abMembershipId, name: grouping.name, role: AB_RUNG.label, people: grouping.people }}
          onClose={() => setGrouping(null)}
          onSaved={() => { setGrouping(null); onRegroup(); }}
        />
      )}
    </section>
  );
}

type Figures = Pick<PerformanceTotals, 'activeAgentTarget' | 'rekrutTarget' | 'apeTargetMinor' | 'actual'>
  | Pick<PerformanceRow, 'activeAgentTarget' | 'rekrutTarget' | 'apeTargetMinor' | 'actual'>;

/** A line's three tiles: APE (never a control), Active Agent and Rekrut (a control on an AB group's row). */
function Tiles({
  totals, navy = false, row, onTarget,
}: { totals: Figures; navy?: boolean; row?: PerformanceRow; onTarget?: () => void }) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const money = (minor: number) => formatRupiahCompact(minor, {}, figures);
  const n = (v: number | null) => (v === null ? '–' : formatNumber(v, {}, figures));
  const { actual } = totals;
  const apeWords = totals.apeTargetMinor <= 0 ? t.noGoal
    : actual.apeMinor === null ? `${t.notUploaded} / ${money(totals.apeTargetMinor)}`
      : `${money(actual.apeMinor)} / ${money(totals.apeTargetMinor)}`;
  const tile = navy ? 'bg-card/10 text-secondary-contrast' : 'bg-card text-ink';
  const bar = navy ? 'bg-primary' : 'bg-secondary';
  const track = navy ? 'bg-card/20' : 'bg-divider';
  const count = (label: string, value: number | null, of: number | null, what: 'activeAgent' | 'rekrut') => {
    const body = (
      <>
        <span className="flex items-center justify-between text-xs font-bold">
          {label}
          {onTarget && <LineIcon name="chevronRight" className="h-3.5 w-3.5" />}
        </span>
        <span className="mt-0.5 block text-lg font-extrabold leading-tight">
          {n(value)}<span className="text-sm font-semibold">/{n(of)}</span>
        </span>
        <span aria-hidden="true" className={cn('mt-1 block h-1.5 overflow-hidden rounded', track)}>
          <span className={cn('block h-full rounded', bar)} style={{ width: `${barWidth(value, of)}%` }} />
        </span>
        {row && <span className="mt-1 block text-xs text-muted">{t.monthlyTarget}</span>}
      </>
    );
    return onTarget && row ? (
      <button
        type="button"
        aria-haspopup="dialog"
        data-target-tile={what}
        aria-label={`${t.setTarget({ what: label, name: row.name })}: ${n(value)}/${n(of)}`}
        onClick={onTarget}
        className="rounded-xl border border-line bg-card p-2.5 text-left text-ink shadow-sm hover:bg-hover-row"
      >
        {body}
      </button>
    ) : <div className={cn('rounded-xl p-2.5', tile)}>{body}</div>;
  };
  return (
    <div className="mt-2 grid grid-cols-[1.2fr_1fr_1fr] gap-1.5">
      <div data-ape-tile="" className={cn('rounded-xl p-2.5', navy ? tile : 'bg-pill-grey/60 text-ink')}>
        <span className="block text-xs font-bold">{t.ape}</span>
        <span className="mt-0.5 block text-lg font-extrabold leading-tight">
          {actual.apePct === null ? '–' : formatPercent(actual.apePct, {}, figures)}
        </span>
        <span aria-hidden="true" className={cn('mt-1 block h-1.5 overflow-hidden rounded', track)}>
          <span className={cn('block h-full rounded', bar)} style={{ width: `${barWidth(actual.apePct, 100)}%` }} />
        </span>
        <span className={cn('mt-1 block truncate text-xs', navy ? 'text-secondary-muted' : 'text-muted')}>{apeWords}</span>
      </div>
      {count(t.activeAgent, actual.activeAgents, totals.activeAgentTarget, 'activeAgent')}
      {count(t.rekrut, actual.rekrut, totals.rekrutTarget, 'rekrut')}
    </div>
  );
}
