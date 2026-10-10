'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  ANALYTICS_PERIODS, OWN_COPY, PROTOTYPE_COPY, readKpmAnalytics,
  type AnalyticsPeriod, type KpmAnalyticsView,
} from '@/lib/kpm-analytics';
import { MocDialog, type MocOpen } from './moc';
import { MonthlyProductionChart } from './monthly-production';
import { UnitComparisonTable } from './unit-comparison';

/**
 * KPM analytics' *Overview* tab (`KPM_Owner.html:1233-1260`; P18-T2): *Unit comparison* with its *Period*,
 * and *Monthly production*, over one read of the server's (`GET /kpm/analytics`).
 *
 * **The period is the address's** (`?period=this_month|previous_month`, D-period), so a refresh keeps it:
 * choosing one re-reads the comparison for it, and a retry after a failure keeps it too. The columns
 * without a month — *APE — Annual*, *Coached (7d)*, *Manpower* — are today's whichever is chosen, as the
 * server answers them.
 *
 * The states the prototype lacks are Fills (L-01): a skeleton shaped like the table and the chart, an
 * error with a retry, and a team with no AB yet, which says so in plain words and still shows the
 * months' production.
 */
export function KpmAnalytics({ period }: { period: AnalyticsPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const comparisonId = useId();
  const chartId = useId();

  /** The period on screen: the address's, and the one just chosen until the address catches up. */
  const [shown, setShown] = useState<AnalyticsPeriod>(period);
  useEffect(() => setShown(period), [period]);

  const [held, setHeld] = useState<{ period: AnalyticsPeriod; view: KpmAnalyticsView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [listed, setListed] = useState<ReadonlySet<string>>(() => new Set());
  const [moc, setMoc] = useState<MocOpen | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    setHeld(null);
    readKpmAnalytics(shown)
      .then((view) => { if (live) setHeld({ period: shown, view }); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [shown, attempt]);

  // A new period starts from the skeleton: the old month's figures under the new month's header would lie.
  const view = held?.period === shown ? held.view : null;

  const choose = (next: AnalyticsPeriod) => {
    if (next === shown) return;
    setShown(next);
    router.replace(`${pathname}?period=${next}`, { scroll: false });
  };

  const toggle = useCallback((id: string) => setExpanded((open) => flip(open, id)), []);
  const toggleList = useCallback((id: string) => setListed((open) => flip(open, id)), []);

  const abCount = view?.total.abCount ?? null;

  return (
    <div className="min-w-0">
      <SectionHead
        id={comparisonId}
        title={PROTOTYPE_COPY.unitComparison}
        // The sub-line counts the ABs (contradiction 11), so it waits for the read, and a team with none has none.
        sub={abCount ? PROTOTYPE_COPY.unitComparisonSub(abCount) : undefined}
        first
      />
      <PeriodSelect period={shown} onChoose={choose} />

      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <AnalyticsSkeleton />}

      {view && (
        <>
          {view.agencies.length === 0 ? (
            <Card className="p-0">
              <EmptyState title={OWN_COPY.noAbTitle} action={<p>{OWN_COPY.noAbLine}</p>} />
            </Card>
          ) : (
            <UnitComparisonTable
              view={view}
              labelledBy={comparisonId}
              expanded={expanded}
              onToggle={toggle}
              listed={listed}
              onToggleList={toggleList}
              onOpenMoc={setMoc}
            />
          )}

          <SectionHead id={chartId} title={PROTOTYPE_COPY.monthlyProduction} sub={PROTOTYPE_COPY.monthlySub} />
          <MonthlyProductionChart monthly={view.monthly} labelledBy={chartId} />
          <MocDialog open={moc} onClose={() => setMoc(null)} />
        </>
      )}
    </div>
  );
}

/** The set with `id` added, or taken out if it was in. */
function flip(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * `.section-head` (`:77-83`): the title and its grey sub-line on one baseline, stacked on a phone; 34px
 * above every head but the first.
 */
function SectionHead({ id, title, sub, first = false }: { id: string; title: string; sub?: string; first?: boolean }) {
  return (
    <div
      className={cn(
        'mb-3.5 flex flex-col items-start gap-[3px] md:flex-row md:items-baseline md:justify-between',
        first ? 'mt-0' : 'mt-[34px]',
      )}
    >
      <h2 id={id} className="font-display text-lg font-bold text-navy">{title}</h2>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}

/** *Period* (`.month-filter-row`, `:338-341`): a labelled native select, its value the address's. */
function PeriodSelect({ period, onChoose }: { period: AnalyticsPeriod; onChoose: (period: AnalyticsPeriod) => void }) {
  const id = useId();
  return (
    <div className="mb-3 flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-muted">{PROTOTYPE_COPY.period}</label>
      <select
        id={id}
        value={period}
        onChange={(e) => onChoose(e.target.value as AnalyticsPeriod)}
        className="rounded-md border border-hairline bg-card px-2.5 py-[7px] text-base text-navy focus:border-amber"
      >
        {ANALYTICS_PERIODS.map(({ id: value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}

/** The bars' outline while the months are read: a shape, not figures. */
const CHART_OUTLINE = [40, 55, 50, 70, 65, 85];

/** The table and the chart, in outline, while the comparison is read. */
function AnalyticsSkeleton() {
  return (
    <Skeleton label={OWN_COPY.loading}>
      <div className="rounded-lg border border-hairline bg-card">
        <div className="flex gap-6 border-b border-hairline bg-base px-4 py-3">
          {[0, 1, 2, 3, 4].map((i) => <SkeletonBar key={i} className="h-2.5 w-1/6" />)}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-6 border-b border-hairline px-4 py-4 last:border-b-0">
            <SkeletonBar className="h-3.5 w-1/5" />
            <SkeletonBar className="h-3.5 w-1/12" />
            <SkeletonBar className="h-3.5 w-1/6" />
            <SkeletonBar className="h-3.5 w-1/6" />
            <SkeletonBar className="h-3.5 w-1/12" />
          </div>
        ))}
      </div>
      <SkeletonBar className="mt-[34px] h-4 w-40" />
      <div className="mt-3.5 flex h-[140px] items-end gap-3.5 rounded-lg border border-hairline bg-card p-5">
        {CHART_OUTLINE.map((height, i) => (
          <div key={i} className="w-full flex-1" style={{ height: `${height}%` }}>
            <SkeletonBar className="h-full w-full" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
