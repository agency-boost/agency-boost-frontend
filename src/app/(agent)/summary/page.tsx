'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Page } from '@/components/page';
import { Card, ErrorBanner } from '@/components/ui/field';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton, SkeletonBar, SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { readActivityRatios, type ActivityRatio, type ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonth, formatShortDay } from '@/lib/format';
import { formatRupiah } from '@/lib/goals';
import { flagLabel } from '@/lib/leads';
import { formatRatioForStatus } from '@/lib/ratio-format';
import {
  readSummary, type ActivityTarget, type FigureSource, type OpenLead, type Pace, type PeriodFigures, type Summary,
  type SummaryActivity,
} from '@/lib/summary';

/**
 * The Personal Summary (P10-T4): your goal against what you produced, this month and this year, and
 * what is left (`Overall.html:3080-3136`, `personal-summary.md`).
 *
 * **Read from what other screens own, and editing none of it** (ADR-0058). The prototype's *produced*
 * figure is an input that writes Goal Settings; here it is shown with where it came from, and the
 * agent's own figure is changed on Goal Settings alone.
 *
 * **What you logged against the plan** (P10-T5): leads contacted, appointments and closings against the
 * cascade on the period's own APE target, a chip per other section, and the activity pulse — the ratio
 * engine's answer for your rung, which the prototype printed as four hardcoded tiles.
 *
 * **The leads that need you** (P10-T6): your own open leads, nearest next action first, flagged as the
 * Leads screen flags them — with the way back to that screen the prototype's card never had.
 *
 * **Later cards arrive with their tasks** — the insight cards (P10-T7). The page shows what is built and
 * nothing standing in for the rest.
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
  // The pulse is the ratio screen's own read (P10-T2, P10-T3), fetched once — it is the last 30 days
  // whichever period is showing, so switching views does not ask again.
  const [pulse, setPulse] = useState<ActivityRatios | null>(null);
  const [pulseError, setPulseError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readSummary()
      .then((next) => { if (live) setSummary(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    readActivityRatios()
      .then((next) => { if (live) setPulse(next); })
      .catch((err) => { if (live) setPulseError(toDisplayError(err)); });
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
            {() => <Cards summary={summary} view={view} pulse={pulse} pulseError={pulseError} />}
          </Segmented>
        )}
      </div>
    </Page>
  );
}

function Cards({
  summary, view, pulse, pulseError,
}: { summary: Summary; view: View; pulse: ActivityRatios | null; pulseError: ApiError | null }) {
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

      <TargetsCard activity={month ? summary.activity.monthly : summary.activity.yearly} month={month} period={period} />
      <PulseCard pulse={pulse} error={pulseError} />
      <LeadsCard leads={summary.leads} />
    </div>
  );
}

function SummaryCard({
  id, title, icon, tag, children,
}: { id: string; title: string; icon: NavIconName; tag?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
      {/* Wraps rather than squeezes: on a phone a long tag drops under the title instead of folding it. */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 id={id} className="flex items-center gap-2 text-md font-bold text-navy">
          <NavIcon name={icon} className="h-[17px] w-[17px] text-navy-soft" />
          {title}
        </h2>
        {tag && <span className="whitespace-nowrap rounded-pill bg-base px-2.5 py-0.5 text-2xs font-semibold text-muted">{tag}</span>}
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

/** The prototype's three chip labels (`Overall.html:3146-3160`), verbatim. */
const TARGET_LABEL: Record<ActivityTarget['key'], string> = {
  leads: 'Leads contacted',
  appointments: 'Appointments',
  closings: 'Closings',
};

/**
 * *Your sales activity targets* (`Overall.html:3139-3182`, P10-T5).
 *
 * The targets are the cascade run on this card's period — this month's fixed APE target, or the year's —
 * so the closings chip and the pace sentence above name one number (ADR-0056). **No target is said, not
 * divided by**: the prototype's bars had no guard, and a zero target printed `NaN%` (F-25).
 */
function TargetsCard({ activity, month, period }: { activity: SummaryActivity; month: boolean; period: string }) {
  return (
    <SummaryCard id="summary-targets" title="Your sales activity targets" icon="flag" tag={month ? 'This month' : 'This year'}>
      <p className="-mt-2 mb-3.5 text-xs text-muted">
        From <Link href="/goals" className="font-semibold text-navy-soft underline">Goal Settings</Link> — appointments
        and closings are your Sales pipeline targets.
      </p>
      <div className="grid gap-2.5 md:grid-cols-3">
        {activity.targets.map((target) => <TargetChip key={target.key} target={target} month={month} />)}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        <strong className="text-navy">{activity.total}</strong> total activities logged {period} across all categories.
        {' '}Day by day on the <Link href="/activity/dashboard" className="font-semibold text-navy underline">Activity Dashboard</Link>.
      </p>
      {activity.sections.length > 0 && (
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {activity.sections.map((section) => (
            <section key={section.code} aria-labelledby={`summary-section-${section.code}`} className="rounded-[10px] border border-hairline bg-base px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-3 border-b border-hairline pb-2">
                <h3 id={`summary-section-${section.code}`} className="text-sm font-semibold text-navy">{section.label} activities</h3>
                <span className="font-body text-lg font-bold text-navy-soft">{section.total}</span>
              </div>
              <ul>
                {section.rows.map((row) => (
                  <li key={row.code} className="flex items-baseline justify-between gap-3 py-0.5 text-xs text-muted">
                    <span>{row.label}</span>
                    <span className="font-body font-bold text-navy">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SummaryCard>
  );
}

function TargetChip({ target, month }: { target: ActivityTarget; month: boolean }) {
  const label = TARGET_LABEL[target.key];
  const pct = target.attainmentPct;
  return (
    <div className="rounded-[10px] border border-hairline bg-base p-3">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <span className="mb-2 block font-body text-lg font-bold text-navy">
        {target.logged}
        {target.target !== null && target.target > 0 && (
          <span className="text-xs font-medium text-muted"> / {target.target}</span>
        )}
      </span>
      {target.target === null ? (
        <span className="block text-xs text-muted">No target yet</span>
      ) : target.target === 0 ? (
        <span className="block text-xs text-muted">Nothing more needed {month ? 'this month' : 'this year'}</span>
      ) : (
        <div
          role="progressbar"
          aria-label={`${label} against target`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct ?? 0)}
          aria-valuetext={`${target.logged} of ${target.target}`}
          className="h-1.5 overflow-hidden rounded bg-navy/[0.08]"
        >
          <div className="h-full rounded bg-navy-soft" style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * The pulse's columns follow its tiles: the prototype's four across (`Overall.html:929`) when there are
 * four, three when there are three or five — an agent's seed, or an office that added a ratio — so a row
 * never ends in a hole wider than a tile. Literal class names, so Tailwind sees every one.
 */
const pulseColumns = (n: number) => (n === 4 || n >= 7 ? 'lg:grid-cols-4' : n === 2 ? '' : n === 1 ? 'sm:grid-cols-1' : 'lg:grid-cols-3');

const PULSE_VALUE: Record<ActivityRatio['status'], string> = {
  success: 'text-success',
  alert: 'text-alert',
  neutral: 'text-navy',
};

/**
 * *Activity pulse* (`Overall.html:3184-3208`, P10-T5): **the ratio engine's answer for your rung** — the
 * prototype's four tiles were markup, 9.1% and 0.0% whatever anybody logged.
 *
 * The rates only. The balance is a track with two named ends, and it lives on the ratio screen with the
 * formulas, which this card links to.
 */
function PulseCard({ pulse, error }: { pulse: ActivityRatios | null; error: ApiError | null }) {
  const rates = pulse?.ratios.filter((r) => r.comparison !== 'band') ?? [];
  const hasBalance = pulse?.ratios.some((r) => r.comparison === 'band') ?? false;
  return (
    <SummaryCard id="summary-pulse" title="Activity pulse" icon="bolt" tag="Last 30 days">
      {error && <ErrorBanner {...error} />}
      {!pulse && !error && (
        <Skeleton label="Working out your ratios…">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-[92px] rounded-[10px]" />)}
          </div>
        </Skeleton>
      )}
      {pulse && (rates.length === 0 ? (
        <p className="text-sm text-navy">Your office has no ratios for your role yet.</p>
      ) : (
        <div className={cn('grid gap-3 sm:grid-cols-2', pulseColumns(rates.length))}>
          {rates.map((ratio) => (
            <div key={ratio.code} className="rounded-[10px] border border-hairline bg-base px-3.5 py-3">
              <span className="mb-1 block text-xs text-muted">{ratio.label}</span>
              <span className={cn('mb-1.5 block font-body text-xl font-bold', PULSE_VALUE[ratio.status])}>
                {formatRatioForStatus(ratio.value, ratio.displayUnit, ratio.benchmark, ratio.status)}
              </span>
              <StatusPill status={ratio.status} />
            </div>
          ))}
        </div>
      ))}
      {pulse && (
        <p className="mt-3 text-xs text-muted">
          {hasBalance ? 'Your selling and recruitment balance, and how each ratio is worked out, are on ' : 'How each ratio is worked out is on '}
          <Link href="/activity/ratio" className="font-semibold text-navy underline">Activity Ratios</Link>.
        </p>
      )}
    </SummaryCard>
  );
}

const LEAD_TYPE: Record<'sales' | 'recruitment', string> = { sales: 'Sales', recruitment: 'Recruitment' };

/**
 * *Leads that need you* (`Overall.html:3210-3217`, `:6151-6218`, P10-T6): your **own** open leads — a
 * leader's downline's are theirs to read on the Leads screen — nearest next action first, undated last.
 *
 * **The flags are the Leads screen's**, from the server's one definition, and *Closes this month* hides
 * none of them (I-103): the prototype showed only the green chip on a lead two weeks late. The nearest
 * ten are listed and the rest counted, and the card leads back to the screen where each is acted on —
 * the prototype's card named what needed attention and gave no way to it.
 */
function LeadsCard({ leads }: { leads: Summary['leads'] }) {
  return (
    <SummaryCard id="summary-leads" title="Leads that need you" icon="pin" tag="Your open leads, nearest date first">
      {leads.total === 0 ? (
        <p className="text-sm text-muted">
          No active leads yet — add some in{' '}
          <Link href="/leads" className="font-semibold text-navy underline">Leads Management</Link>.
        </p>
      ) : (
        <>
          <ul>
            {leads.rows.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {leads.total > leads.rows.length
              ? `The ${leads.rows.length} nearest of your ${leads.total} open leads. `
              : ''}
            <Link href="/leads" className="font-semibold text-navy underline">Leads Management</Link>
            {leads.total > leads.rows.length ? ' has every one.' : ' is where you act on them.'}
          </p>
        </>
      )}
    </SummaryCard>
  );
}

function LeadRow({ lead }: { lead: OpenLead }) {
  return (
    // Side by side from `sm`; on a phone the date goes under the name, which a 240px column would squeeze.
    <li className="flex flex-col gap-1.5 border-b border-hairline py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold text-navy">{lead.name || '(unnamed)'}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {lead.type ? LEAD_TYPE[lead.type] : 'Unassigned'} · {lead.statusLabel ?? 'No status yet'}
          </span>
          {lead.thisMonth && <StatusPill status="success" label="Closes this month" className="whitespace-nowrap" />}
          {lead.flags.map((flag) => (
            <StatusPill key={flag} status="alert" label={flagLabel(flag, lead.overdueDays)} className="whitespace-nowrap" />
          ))}
        </div>
      </div>
      <div className="leading-normal sm:max-w-[240px] sm:shrink-0 sm:pt-px sm:text-right">
        {lead.nextActionDate ? (
          <>
            {/* Navy, not the prototype's amber: small amber text clears no contrast floor (`tokens.md`). */}
            <span className="text-xs font-bold text-navy">{formatShortDay(lead.nextActionDate)}</span>
            {lead.nextActionNote && <span className="text-xs text-navy-soft"> — {lead.nextActionNote}</span>}
          </>
        ) : (
          <span className="text-xs font-semibold text-muted">No date set</span>
        )}
      </div>
    </li>
  );
}
