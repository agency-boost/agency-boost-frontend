'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Page } from '@/components/page';
import { Card, ErrorBanner } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonth } from '@/lib/format';
import { formatRupiah } from '@/lib/goals';
import { readSummary, type FigureSource, type Pace, type PeriodFigures, type Summary } from '@/lib/summary';

/**
 * The Personal Summary (P10-T4): your goal against what you produced, this month and this year, and
 * what is left (`Overall.html:3080-3136`, `personal-summary.md`).
 *
 * **Read from what other screens own, and editing none of it** (ADR-0058). The prototype's *produced*
 * figure is an input that writes Goal Settings; here it is shown with where it came from, and the
 * agent's own figure is changed on Goal Settings alone.
 *
 * **Later cards arrive with their tasks** — the activity targets and pulse (P10-T5), the leads that need
 * you (P10-T6), the insight cards (P10-T7). The page shows what is built and nothing standing in for
 * the rest.
 */
type View = 'month' | 'year';

const VIEWS = [
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
] as const;

export default function PersonalSummaryPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [view, setView] = useState<View>('month');

  useEffect(() => {
    let live = true;
    readSummary()
      .then((next) => { if (live) setSummary(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  return (
    <Page title="Personal Summary" subtitle="Your goals, activity and leads — on one page.">
      <div className="mx-auto max-w-[860px]">
        {error && <ErrorBanner {...error} />}
        {!summary && !error && <SkeletonCards count={2} label="Putting your summary together…" />}
        {summary && (
          <Segmented
            label="Period"
            tabs={VIEWS}
            active={view}
            onSelect={(id) => setView(id as View)}
            className="w-fit [&_button]:whitespace-nowrap [&_button]:px-3.5"
          >
            {() => <Cards summary={summary} view={view} />}
          </Segmented>
        )}
      </div>
    </Page>
  );
}

function Cards({ summary, view }: { summary: Summary; view: View }) {
  const month = view === 'month';
  const figures = month ? summary.monthly : summary.yearly;
  const period = month ? 'this month' : 'this year';

  return (
    <div className="grid gap-3">
      {/*
        * What the view is about, where the prototype prints *"Week of Aug 24 – Aug 30"* — a label for a
        * weekly digest this page is not; the figures here are the calendar month and year (ADR-0056).
        */}
      <p className="text-sm text-muted">
        {month ? formatMonth(summary.month) : summary.year}
      </p>

      {!summary.goal.set ? (
        <Card>
          <p className="text-md text-navy">
            You haven’t set a goal for {summary.year} yet, so there is nothing to measure against.
          </p>
          <Link href="/goals" className="mt-2 inline-block font-semibold text-navy underline">Set your goal</Link>
        </Card>
      ) : summary.yearly.targetMinor === null ? (
        // Saved, but with no APE target to measure against — zero, or inputs that make no plan.
        <Card>
          <p className="text-md text-navy">
            Your goal for {summary.year} has no APE target to measure against yet.
          </p>
          <Link href="/goals" className="mt-2 inline-block font-semibold text-navy underline">Open Goal Settings</Link>
        </Card>
      ) : (
        <>
          <GoalCard figures={figures} month={month} source={figures.source} summary={summary} />
          <GapCard figures={figures} period={period} pace={month ? summary.pace : null} />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  id, title, icon, tag, children,
}: { id: string; title: string; icon: 'target' | 'chart'; tag?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-md font-bold text-navy">
          <NavIcon name={icon} className="h-[17px] w-[17px] text-navy-soft" />
          {title}
        </h2>
        {tag && <span className="rounded-pill bg-base px-2.5 py-0.5 text-2xs font-semibold text-muted">{tag}</span>}
      </div>
      {children}
    </section>
  );
}

const SOURCE: Record<FigureSource['provenance'], string> = {
  imported: 'From the carrier’s file',
  corrected: 'Corrected by your office',
  self_reported: 'Your own figure, from Goal Settings',
};

/** *Goal vs. actual (APE)* (`Overall.html:3094-3115`), read-only (ADR-0058). */
function GoalCard({
  figures, month, source, summary,
}: { figures: PeriodFigures; month: boolean; source: FigureSource | null; summary: Summary }) {
  const pct = figures.attainmentPct;
  // The year was made before this month began: the month has no target left to fill (ADR-0047).
  const madeAlready = figures.targetMet && figures.targetMinor === 0;
  return (
    <SummaryCard id="summary-goal" title="Goal vs. actual (APE)" icon="target" tag={month ? 'This month' : 'This year'}>
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2.5">
        <p className="flex flex-wrap items-baseline gap-1.5">
          {figures.actualMinor === null ? (
            <strong className="font-body text-2xl font-bold text-muted">Not uploaded yet</strong>
          ) : (
            <strong className="font-body text-2xl font-bold text-navy">{formatRupiah(figures.actualMinor)}</strong>
          )}
          {figures.targetMinor !== null && !madeAlready && (
            <span className="text-sm text-muted">of {formatRupiah(figures.targetMinor)} target</span>
          )}
        </p>
        {pct !== null && (
          <span className="rounded-pill bg-amber/15 px-3 py-1 text-sm font-bold text-navy">{pct}%</span>
        )}
      </div>
      {madeAlready ? (
        <p className="text-sm text-navy">Your year’s target was made before this month began — this month needs nothing more.</p>
      ) : pct !== null && (
        // Only a measured figure gets a bar: an empty track under *Not uploaded yet* reads as zero.
        <>
          <div
            role="progressbar"
            aria-label={month ? 'This month’s target' : 'This year’s target'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, pct)}
            aria-valuetext={`${pct}%`}
            className="h-3 overflow-hidden rounded-md border border-hairline bg-base"
          >
            <div className="h-full rounded-md bg-gradient-to-r from-amber to-amber-dark" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>Rp 0</span>
            <span>{month ? 'This month’s target' : 'This year’s target'}</span>
          </div>
        </>
      )}
      <p className="mt-3 text-xs text-muted">
        {source === null
          ? `This month’s figure arrives with your office’s upload, after ${formatMonth(summary.month)} ends.`
          : `${SOURCE[source.provenance]}${source.month ? `, ${formatMonth(source.month)}` : ''}.`}
        {' '}
        <Link href="/goals" className="font-semibold text-navy underline">Goal Settings</Link>
        {source?.provenance === 'self_reported' ? ' is where you change it.' : ' has the whole plan.'}
      </p>
    </SummaryCard>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** *The gap* (`Overall.html:3117-3136`), and the pace sentence for this month (ADR-0057). */
function GapCard({ figures, period, pace }: { figures: PeriodFigures; period: string; pace: Pace | null }) {
  return (
    <SummaryCard id="summary-gap" title="The gap" icon="chart">
      <div className="grid gap-3 sm:grid-cols-2">
        <GapTile
          label={`Remaining ${period}`}
          value={figures.gapMinor === null ? '—'
            : figures.targetMet
              ? (figures.overMinor ? `Reached — ${formatRupiah(figures.overMinor)} over` : 'Reached')
              : formatRupiah(figures.gapMinor)}
        />
        <GapTile
          label="≈ Policies still needed"
          value={figures.policiesNeeded === null ? '—'
            : figures.targetMet ? 'None' : plural(figures.policiesNeeded, 'policy', 'policies')}
        />
      </div>
      {figures.actualMinor === null && !figures.targetMet && (
        <p className="mt-3 text-xs text-muted">What is left is worked out once this month’s APE is uploaded.</p>
      )}
      {pace && <PaceNote pace={pace} />}
    </SummaryCard>
  );
}

function GapTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hairline bg-base px-3.5 py-3">
      <span className="mb-0.5 block text-xs text-muted">{label}</span>
      <span className="font-body text-xl font-bold text-navy">{value}</span>
    </div>
  );
}

/**
 * The pace sentence. **A projection, and said as one** — the prototype printed the closings already
 * logged as where the month is heading (F-24). Before the 7th it only counts; once the target is
 * reached it says so and asks for nothing more.
 */
function PaceNote({ pace }: { pace: Pace }) {
  const tone = pace.targetMet || (pace.projected !== null && pace.projected >= pace.closingTarget)
    ? 'good' : pace.projected === null ? 'plain' : 'behind';
  const policies = (n: number) => plural(n, 'policy', 'policies');

  let text: ReactNode;
  if (pace.targetMet) {
    text = 'You’ve already reached this month’s target — nice work. Keep the pace to stay ahead.';
  } else if (pace.projected === null) {
    text = <>You’ve closed <strong>{policies(pace.closingsLogged)}</strong> of <strong>{pace.closingTarget}</strong> this month.</>;
  } else if (tone === 'good') {
    text = <>At your current pace, you’re tracking to close <strong>{policies(pace.projected)}</strong> this month against a target of <strong>{pace.closingTarget}</strong>.</>;
  } else {
    text = (
      <>
        At your current pace, you’re tracking to close <strong>{policies(pace.projected)}</strong> this month against
        a target of <strong>{pace.closingTarget}</strong>. With {plural(pace.weeksLeft, 'week', 'weeks')} left, you’d
        need to close roughly <strong>{pace.neededPerWeek} {pace.neededPerWeek === 1 ? 'policy' : 'policies'}/week</strong> to catch up.
      </>
    );
  }

  return (
    <p
      className={cn(
        'mt-3 flex items-start gap-2 rounded-md border px-3.5 py-3 text-sm leading-relaxed text-navy',
        tone === 'good' && 'border-success/20 bg-success/[0.06]',
        tone === 'behind' && 'border-alert/20 bg-alert/[0.06]',
        tone === 'plain' && 'border-hairline bg-base',
      )}
    >
      <span aria-hidden="true">{tone === 'good' ? '✅' : tone === 'behind' ? '⚠️' : '•'}</span>
      <span>{text}</span>
    </p>
  );
}
