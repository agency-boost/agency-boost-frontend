'use client';

import { Fragment, useEffect, useId, useState } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readQuant, type Quant, type QuantMetric } from '@/lib/advanced-analytics-page';
import { cn } from '@/lib/cn';
import { formatMonth, formatMonthName, formatNumber, formatPercent, toMajor } from '@/lib/format';
import { BlockTitle, PeerStatusChip, PersonName, SectionError, SectionLoading, TabControls } from './shared';

const RUPIAH_PER_JUTA = 1_000_000;

/** A Quant figure as its metric writes it: a share whole, D1 in *Rp jt* to a tenth, A2 signed, a ratio to a tenth. */
export function quantText(code: string, value: number, language: Language): string {
  if (code === 'B1' || code === 'B2' || code === 'B3') return formatPercent(value, {}, language);
  if (code === 'D1') return formatNumber(toMajor(value) / RUPIAH_PER_JUTA, { maxDecimals: 1 }, language);
  if (code === 'A2') return `${value > 0 ? '+' : ''}${formatNumber(value, {}, language)}`;
  return formatNumber(value, { maxDecimals: 1 }, language);
}

type GroupKey = 'A' | 'B' | 'C' | 'D';
const GROUPS: GroupKey[] = ['A', 'B', 'C', 'D'];

/**
 * ***Analisa kuantitatif*** (P19.22-T4; ADR-0275 §4; the approved `advanced-analytics-*` frames 18–21): the half-year
 * picker and *Peers = KPM {company} lain dengan data lengkap (min. 3)*. Left: the navy **Posisi KPM vs peers** — green *Di
 * atas peers*, yellow *Sejajar*, red *Di bawah peers* — and the red *Perlu fokus* chips that open their metric; then one
 * row per metric grouped A Manpower · B Activation · C Productivity · D Case size: ID chip, name, position chip, and
 * *KPM Anda* (navy) · *Median peers* · *Semester lalu* ▲/▼. Right: **the metric's distribution per leader**, opening on
 * the first — a bar per leader with photo and label, high to low, the KPM leaders' median a dashed line under a navy
 * *Median KPM x*, green at or above, red below, the median leader in bold, *"x dari y leader di atau di atas median"*, the
 * peer median, the legend. The metric on the right is highlighted on the left (orange tint, orange left bar). **On a
 * phone and a tablet held upright the distribution opens right under the tapped row.** No range chart, no *cara membaca*.
 */
export function QuantSection({ platformKpmId }: { platformKpmId?: string }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const q = t.quant;
  const language = useFigureLanguage();
  const runId = useId();
  const [periodEnd, setPeriodEnd] = useState<string | undefined>(undefined);
  const [view, setView] = useState<Quant | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    readQuant({ periodEnd }, platformKpmId)
      .then((answer) => { if (live) setView(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [periodEnd, platformKpmId]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  if (view.periodEnd === null) {
    return <p data-section="quant" className="rounded-card bg-card px-4 py-6 text-center text-md text-muted">{q.noRun}</p>;
  }
  const label = (run: { periodEnd: string; fromMonth: string }) => {
    const from = formatMonthName(run.fromMonth, language);
    return { from: run.fromMonth.slice(0, 4) === run.periodEnd.slice(0, 4) ? from : formatMonth(run.fromMonth, language), to: formatMonth(run.periodEnd, language) };
  };
  const selected = view.metrics.find((m) => m.code === picked) ?? view.metrics[0];
  const count = (status: QuantMetric['status']) => view.metrics.filter((m) => m.status === status).length;
  const focus = view.metrics.filter((m) => m.status === 'below');
  const nameOf = (m: QuantMetric) => q.metrics[m.code as keyof typeof q.metrics] ?? m.metric;

  return (
    <div data-section="quant">
      <TabControls note={view.companyName ? q.peersNote({ company: view.companyName, n: view.needed }) : q.peersNoCompany({ n: view.needed })}>
        <span className="relative inline-flex">
          <label htmlFor={runId} className="sr-only">{t.filters.period}</label>
          <select
            id={runId}
            value={view.periodEnd}
            onChange={(e) => { setPeriodEnd(e.target.value); setPicked(null); }}
            className="h-11 appearance-none rounded-pill border border-hairline bg-card pl-4 pr-9 text-md font-semibold text-ink"
          >
            {view.runs.map((r) => <option key={r.periodEnd} value={r.periodEnd}>{q.period(label(r))}</option>)}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm">⌄</span>
        </span>
      </TabControls>
      {view.lateWriteAt && (
        <p role="note" data-late-write="" className="mb-3 rounded-md bg-pill-red px-3 py-2 text-sm font-semibold text-pill-red-ink">{q.late}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section data-position="" className="rounded-card bg-secondary p-4 text-secondary-contrast">
            <h2 className="mb-3 font-bold">{q.position({ n: view.metrics.length })}</h2>
            <div className="grid grid-cols-3 gap-2">
              {([['above', q.above, 'bg-pill-green text-pill-green-ink'], ['in_line', q.inLine, 'bg-pill-amber text-pill-amber-ink'], ['below', q.below, 'bg-pill-red text-pill-red-ink']] as const)
                .map(([status, words, tone]) => (
                  <div key={status} className={cn('rounded-row p-3', tone)} data-count={status}>
                    <p className="text-2xl font-extrabold tabular-nums">{formatNumber(count(status), {}, language)}</p>
                    <p className="text-sm font-bold">{words}</p>
                  </div>
                ))}
            </div>
            {focus.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-on-navy-line pt-3">
                <span className="text-sm font-bold">{q.focus}</span>
                {focus.map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => setPicked(m.code)}
                    aria-pressed={selected?.code === m.code}
                    className="rounded-pill bg-card px-2.5 py-1 text-sm font-semibold text-ink"
                  >
                    <span className="mr-1 font-extrabold text-pill-red-ink">{m.code}</span>
                    {nameOf(m)}
                  </button>
                ))}
              </div>
            )}
          </section>

          {GROUPS.map((group) => {
            const metrics = view.metrics.filter((m) => m.code.startsWith(group));
            if (metrics.length === 0) return null;
            return (
              <section key={group} aria-label={q.groups[group]}>
                <BlockTitle>{q.groups[group]}</BlockTitle>
                <div className="divide-y divide-divider overflow-hidden rounded-card bg-card">
                  {metrics.map((m) => {
                    const on = selected?.code === m.code;
                    return (
                      <Fragment key={m.code}>
                        <MetricRow metric={m} name={nameOf(m)} on={on} needed={view.needed} onPick={() => setPicked(m.code)} />
                        {on && (
                          <div className="border-t border-divider bg-base p-3 lg:hidden" data-inline-distribution="">
                            <Distribution metric={m} name={nameOf(m)} />
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {selected && (
          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-4">
              <BlockTitle>{`${selected.code} · ${nameOf(selected)}`}</BlockTitle>
              <div className="rounded-card bg-card p-4"><Distribution metric={selected} name={nameOf(selected)} /></div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** One metric's row: ID chip, name, position chip, and *KPM Anda* · *Median peers* · *Semester lalu*. */
function MetricRow({ metric: m, name, on, needed, onPick }: { metric: QuantMetric; name: string; on: boolean; needed: number; onPick: () => void }) {
  const q = useMessages(advancedAnalyticsPageMessages).quant;
  const language = useFigureLanguage();
  const own = m.value === null
    ? (m.reason === 'not_enough_data' ? q.notEnoughData : m.reason === 'no_leader' ? q.noLeader : '–')
    : quantText(m.code, m.value, language);
  const up = m.value !== null && m.previous !== null ? (m.value > m.previous ? true : m.value < m.previous ? false : null) : null;
  return (
    <div
      data-metric={m.code}
      data-selected={on ? '' : undefined}
      className={cn('relative px-4 py-3', on && 'bg-today before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[""]')}
    >
      <button
        type="button"
        onClick={onPick}
        aria-expanded={on}
        aria-label={q.open({ name: `${m.code} ${name}` })}
        className="absolute inset-0 z-0 h-full w-full focus-visible:outline-offset-[-2px]"
      />
      <p className="relative z-[1] mb-2 flex items-center gap-2 pointer-events-none">
        <span className="rounded-md bg-pill-grey px-1.5 text-xs font-bold text-pill-grey-ink">{m.code}</span>
        <span className="min-w-0 flex-1 font-bold text-ink">{name}</span>
        <PeerStatusChip status={m.status} />
      </p>
      <div className="pointer-events-none relative z-[1] grid grid-cols-3 gap-2">
        <div className="rounded-row bg-secondary px-2.5 py-1.5 text-secondary-contrast">
          <p className="text-xs font-semibold">{q.yours}</p>
          <p className="text-lg font-extrabold tabular-nums">{own}</p>
          {m.value !== null && !m.complete && (
            <p className="text-xs">{q.incomplete({ months: m.missingMonths.map((x) => formatMonthName(x, language)).join(', ') })}</p>
          )}
        </div>
        <div className="rounded-row bg-base px-2.5 py-1.5">
          <p className="text-xs font-semibold text-muted">{q.median}</p>
          {m.median === null
            ? <p className="text-xs text-muted">{q.notEnough({ n: m.peers, needed })}</p>
            : <p className="text-lg font-extrabold tabular-nums text-ink">{quantText(m.code, m.median, language)}</p>}
        </div>
        <div className="rounded-row bg-base px-2.5 py-1.5">
          <p className="text-xs font-semibold text-muted">{q.previous}</p>
          <p className="text-lg font-extrabold tabular-nums text-ink">
            {m.previous === null ? '–' : quantText(m.code, m.previous, language)}
            {up !== null && (
              <span aria-hidden="true" className={cn('ml-1 text-sm', up ? 'text-signal-green' : 'text-signal-red')}>{up ? '▲' : '▼'}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * **A metric's distribution per leader** (AC-2): one bar per leader, high to low, green at or above the KPM leaders'
 * median and red below it, the dashed median under a navy *Median KPM x*, the median leader in bold, the line *x dari y
 * leader di atau di atas median KPM (m) · median peers p*, and the two-colour legend.
 */
function Distribution({ metric: m, name }: { metric: QuantMetric; name: string }) {
  const q = useMessages(advancedAnalyticsPageMessages).quant;
  const language = useFigureLanguage();
  const d = m.distribution;
  if (d.leaders.length === 0 || d.median === null) {
    return <p className="text-md text-muted" data-distribution={m.code}>{q.noLeaders}</p>;
  }
  const max = Math.max(...d.leaders.map((l) => l.value), d.median, 0) || 1;
  const at = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const median = quantText(m.code, d.median, language);
  const medianLeader = d.leaders.reduce((best, l) => (Math.abs(l.value - d.median!) < Math.abs(best.value - d.median!) ? l : best), d.leaders[0]);
  return (
    <div data-distribution={m.code}>
      <p className="font-bold text-ink">{q.distribution}</p>
      <p className="mb-3 text-sm text-muted">
        {q.distributionLine({
          x: d.atOrAbove, y: d.leaders.length, median,
          peers: m.median === null ? '–' : quantText(m.code, m.median, language),
        })}
      </p>
      <ul aria-label={`${q.distribution}: ${name}`} className="space-y-2">
        <li aria-hidden="true" className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-end gap-2">
          <span />
          <span className="relative block h-5">
            <span className="absolute -translate-x-1/2 whitespace-nowrap rounded-pill bg-secondary px-2 text-xs font-bold text-secondary-contrast" style={{ left: at(d.median) }}>
              {q.kpmMedian({ value: median })}
            </span>
          </span>
          <span />
        </li>
        {d.leaders.map((l) => {
          const above = l.value >= d.median!;
          return (
            <li key={l.membershipId} data-leader={l.membershipId} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-center gap-2">
              <PersonName person={l} size={24} nameClassName={cn('text-xs', l.membershipId === medianLeader.membershipId ? 'font-extrabold' : 'font-semibold')} />
              <span className="relative block h-3 rounded-pill bg-divider">
                <span className={cn('block h-full rounded-pill', above ? 'bg-on-navy-green' : 'bg-on-navy-red')} style={{ width: at(l.value) }} />
                <span aria-hidden="true" className="absolute -top-1 bottom-[-4px] border-l border-dashed border-secondary" style={{ left: at(d.median!) }} />
              </span>
              <span className={cn('text-right text-sm tabular-nums text-ink', l.membershipId === medianLeader.membershipId ? 'font-extrabold' : 'font-semibold')}>
                {quantText(m.code, l.value, language)}
                <span className="sr-only">{` · ${above ? q.legendAbove : q.legendBelow}`}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-on-navy-green" />{q.legendAbove}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-on-navy-red" />{q.legendBelow}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 border-l border-dashed border-secondary" />{q.legendMedian}</span>
      </p>
    </div>
  );
}
