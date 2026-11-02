'use client';

import { useId, type ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { PersonRow } from '@/components/ui/person-row';
import { StatTile } from '@/components/ui/stat-tile';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { cn } from '@/lib/cn';
import { formatMonth, formatPercent, formatRupiahCompact } from '@/lib/format';
import {
  ANALYTICS_PERIODS, drillsAnywhere, shortMonth, unitDashboardHref,
  type AgencyRow, type AnalyticsMoney, type AnalyticsPeriod, type KpmAnalyticsView, type MonthlyProduction,
} from '@/lib/kpm-analytics';
import { useSession } from '@/lib/session';
import type { MocOpen } from './moc';

/**
 * **KPM Analytics' Overview on a phone, in the field shell** (UI V1, 2026-10-30; UI-109; `kpm-mobile` 2): *Unit
 * comparison* with its period pill; the five agencies' totals as two-column tiles (`StatTile`, Unit Dashboard style);
 * each AB as one 60px row (`PersonRow`: the APE bar and %, the APE, the people, the club pill, the MOC pill); *Monthly
 * production* as six bars, **no footnote**, a month with no upload a hatched bar and *–*.
 *
 * **A row opens what its reader may open** (ADR-0159 §2, `drillsAnywhere`): a Core Leader their own unit's figures, the
 * Owner and the Admins every leader's; any other row reads and leads nowhere, rather than to a refusal. The MOC pill is
 * its own target, opening the requirements (`MocDialog`), as the table's cell does.
 *
 * Below 768px in the field shell only: the tablet, the desktop and the office console keep the table and the cards.
 */
export function V1Overview({
  view, period, onPeriod, onOpenMoc,
}: {
  view: KpmAnalyticsView;
  period: AnalyticsPeriod;
  onPeriod: (period: AnalyticsPeriod) => void;
  onOpenMoc: (open: MocOpen) => void;
}) {
  const t = useMessages(kpmAnalyticsMessages);
  const figures = useFigureLanguage();
  const headId = useId();
  const listId = useId();
  const chartId = useId();
  const { total } = view;

  return (
    <div className="min-w-0" data-v1-overview="">
      <Head id={headId} title={t.unitComparison} aside={<PeriodPill period={period} onChoose={onPeriod} />} />
      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t.headManpower} value={String(total.manpower.total)} sub={t.manpowerSub(total.manpower)} />
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
          value={total.activeAgents === null ? '—' : String(total.activeAgents)}
          unit={total.activeAgents === null ? undefined : `/ ${total.activeOf}`}
          sub={total.activeAgents === null ? t.notUploaded : total.activePct === null ? '—' : formatPercent(total.activePct, {}, figures)}
        />
        <StatTile label={t.headMoc} value={String(total.mocMet)} unit={`/ ${total.mocOf}`} sub={t.absMeetingMoc} />
      </div>

      {view.agencies.length === 0 && (
        <div className="mt-3 rounded-lg bg-card">
          <EmptyState title={t.noAbTitle} action={<p>{t.noAbLine}</p>} />
        </div>
      )}
      {view.agencies.length > 0 && (
        <>
          <Head id={listId} title={t.v1.perAb} aside={<span className="text-sm text-muted">{t.v1.abCount({ n: total.abCount })}</span>} />
          <ul aria-labelledby={listId} className="divide-y divide-divider overflow-hidden rounded-lg bg-card">
            {view.agencies.map((agency) => (
              <li key={agency.head.membershipId}>
                <AgencyLine agency={agency} split={view.thresholds.statusSplitPct} onOpenMoc={onOpenMoc} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Head id={chartId} title={t.monthlyProduction} aside={<span className="text-sm text-muted">{t.v1.months({ n: view.monthly.length })}</span>} />
      <Bars monthly={view.monthly} labelledBy={chartId} />
    </div>
  );
}

/** A section's head: its title left, its count or control right (`.sh`). */
function Head({ id, title, aside }: { id: string; title: string; aside?: ReactNode }) {
  return (
    <div className="mx-0.5 mb-2 mt-3.5 flex min-h-11 items-center justify-between gap-3 first:mt-1">
      <h2 id={id} className="text-md font-bold text-navy">{title}</h2>
      {aside}
    </div>
  );
}

/** *Bulan ini ⌄*: the period, a navy pill over the native list (44px). */
function PeriodPill({ period, onChoose }: { period: AnalyticsPeriod; onChoose: (period: AnalyticsPeriod) => void }) {
  const t = useMessages(kpmAnalyticsMessages);
  return (
    <span className="relative inline-flex shrink-0">
      <select
        aria-label={t.period}
        value={period}
        onChange={(e) => onChoose(e.target.value as AnalyticsPeriod)}
        className="min-h-11 appearance-none rounded-pill bg-navy py-0 pl-3.5 pr-8 text-base font-semibold text-white"
      >
        {ANALYTICS_PERIODS.map((value) => <option key={value} value={value}>{t.periods[value]}</option>)}
      </select>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
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

/** One AB: 60px, the APE bar and % in the status' colour, the APE, the people, the club, the MOC pill. */
function AgencyLine({ agency, split, onOpenMoc }: { agency: AgencyRow; split: number; onOpenMoc: (open: MocOpen) => void }) {
  const t = useMessages(kpmAnalyticsMessages);
  const figures = useFigureLanguage();
  const { me } = useSession();
  const { head, apeMonth, manpower, club, moc } = agency;
  const href = drillsAnywhere(me, head.isReader) ? unitDashboardHref(head) : undefined;
  const good = apeMonth.pct !== null && apeMonth.pct >= split;
  const meta = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted">
      {apeMonth.pct !== null && (
        <>
          <span aria-hidden="true" className="inline-block h-[5px] w-11 overflow-hidden rounded-sm bg-base align-middle">
            <span className={cn('block h-full', good ? 'bg-signal-green' : 'bg-signal-red')} style={{ width: `${Math.min(100, Math.max(0, apeMonth.pct))}%` }} />
          </span>
          <span className={cn('font-semibold', good ? 'text-signal-green' : 'text-signal-red')}>{formatPercent(apeMonth.pct, {}, figures)}</span>
        </>
      )}
      <span>
        {apeMonth.achievedMinor === null ? t.notUploaded : formatRupiahCompact(apeMonth.achievedMinor, {}, figures)}
        {' · '}{t.v1.people({ n: manpower.total })}
        {apeMonth.targetMinor === null && <>{' · '}{t.noGoal}</>}
      </span>
      {club && <span className="rounded-pill bg-amber/15 px-2 text-sm font-semibold text-amber-ink">{club.label}</span>}
    </span>
  );
  const mocPill = moc ? (
    <button
      type="button"
      onClick={() => onOpenMoc({ name: head.name, moc })}
      aria-label={moc.status === 'unknown' && moc.missing
        ? t.mocUnknown({ name: head.name, missing: moc.missing })
        : t.mocFor({ verdict: moc.status === 'met' ? t.mocMet : t.mocNotMet, name: head.name })}
      className="relative z-[1] flex min-h-11 shrink-0 items-center"
    >
      <TonePill tone={moc.status === 'met' ? 'green' : 'grey'}>
        {moc.status === 'met' && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-0.5 h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        )}
        {t.headMoc}
      </TonePill>
    </button>
  ) : <TonePill tone="grey">{t.headMoc}</TonePill>;

  return (
    <PersonRow
      name={head.name}
      seed={head.membershipId}
      height={60}
      href={href}
      chevron={false}
      badge={head.isReader ? <TonePill tone="blue">{t.v1.you}</TonePill> : undefined}
      meta={meta}
      trailing={mocPill}
      className="rounded-none"
    />
  );
}

/**
 * *Monthly production*: six bars, the latest in the accent and the rest grey, each month's sum over it in juta — **no
 * footnote** (the owner removed it) — and a month with no upload a hatched outline and *–*. A list for a screen reader:
 * each month by name and its sum, or *not uploaded*.
 */
function Bars({ monthly, labelledBy }: { monthly: readonly MonthlyProduction[]; labelledBy: string }) {
  const t = useMessages(kpmAnalyticsMessages);
  const figures = useFigureLanguage();
  const top = Math.max(0, ...monthly.map((m) => m.apeMinor ?? 0));
  const last = monthly.length - 1;
  return (
    <div className="rounded-lg bg-card p-3" data-v1-bars="">
      <ul aria-labelledby={labelledBy} className="grid h-[120px] items-end" style={{ gridTemplateColumns: `repeat(${Math.max(1, monthly.length)}, minmax(0, 1fr))` }}>
        {monthly.map((m, i) => {
          const none = m.apeMinor === null;
          const height = none ? 20 : top > 0 ? Math.max(4, Math.round(((m.apeMinor ?? 0) / top) * 100)) : 4;
          // The sum without its currency mark (*462 jt*): six of them share 343px, and the mark is the section's.
          const value = none ? '–' : formatRupiahCompact(m.apeMinor!, {}, figures).replace(/^(Rp|IDR)\s/, '');
          return (
            <li key={m.month} className="flex h-full min-w-0 flex-col items-center justify-end">
              <span className="sr-only">{formatMonth(m.month, figures)}: {none ? t.v1.noData : formatRupiahCompact(m.apeMinor!, {}, figures)}</span>
              <span aria-hidden="true" className={cn('whitespace-nowrap text-xs font-semibold tabular-nums', none ? 'text-signal-grey' : 'text-pill-grey-ink')}>{value}</span>
              <span
                aria-hidden="true"
                data-bar={none ? 'none' : i === last ? 'latest' : 'month'}
                className={cn(
                  'mt-1 block w-7 rounded-t-[6px] rounded-b-[3px]',
                  none
                    ? 'border border-dashed border-signal-grey bg-[repeating-linear-gradient(45deg,var(--color-base)_0_4px,var(--color-card)_4px_8px)]'
                    : i === last ? 'bg-amber' : 'bg-line',
                )}
                style={{ height: `${height}px` }}
              />
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="mt-1.5 grid border-t border-divider pt-1.5 text-center text-xs text-muted" style={{ gridTemplateColumns: `repeat(${Math.max(1, monthly.length)}, minmax(0, 1fr))` }}>
        {monthly.map((m) => <span key={m.month}>{shortMonth(m.month, figures)}</span>)}
      </div>
    </div>
  );
}
