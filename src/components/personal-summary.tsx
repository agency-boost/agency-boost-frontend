'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChasingCampaigns } from '@/components/campaigns/chasing-card';
import { ComingInPhaseSection } from '@/components/coming-in-phase';
import { Card, ErrorBanner } from '@/components/ui/field';
import { TEXT_TAP } from '@/components/ui/phone';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import type { ActivityRatio, ActivityRatios } from '@/lib/activity';
import type { ApiError } from '@/lib/api-client';
import { PROTOTYPE_COPY as CAMPAIGN_COPY } from '@/lib/campaigns';
import { cn } from '@/lib/cn';
import { capitalized, coachingTabHref, PRONOUN_FORMS, type CoacheeSubject } from '@/lib/coaching';
import { formatMonth, formatPercent, formatRupiahCompact, formatShortDay } from '@/lib/format';
import { producedFrom } from '@/lib/goals';
import { flagLabel } from '@/lib/leads';
import { formatBenchmark, formatRatioForStatus } from '@/lib/ratio-format';
import type {
  ActivityTarget, FigureSource, Insight, OpenLead, Pace, PeriodFigures, SectionChip, Summary, SummaryActivity,
} from '@/lib/summary';

/**
 * The Personal Summary's cards (P10-T4 to P10-T7), drawn for whoever the page is about.
 *
 * **Two pages draw them** (P11-T7 AC-4, AC-9). `/summary` is the reader's own, in the second person,
 * with its links to the screens each figure comes from. A coaching tab's *Personal Summary* is the
 * same cards about a coachee (`Overall.html:3998-4162`, *"exact copy of the agent's own screen"*), in
 * that person's pronoun — *Her sales activity targets*, *Leads that need her*, *How she can improve* —
 * with the prototype's coaching words where it has its own (*All active leads, nearest date first*,
 * *No active leads.*). On a coachee's page a link to the reader's own screens would land on the wrong
 * person's data, so the *Goal Settings* links open that person's *Goal Setting* tab, and the rest are
 * dropped, as the prototype's coaching copy has them (its one link is `href="#"`, `:4061`).
 *
 * What differs by subject is said once, in `voiceOf`, and every string either voice writes on a
 * coachee's page uses none of ADR-0084's six words: *office*, *KPM*, *reports to*, *tagged to*,
 * *untagged*, *unassigned*.
 *
 * **Read from what other screens own, and editing none of it** (ADR-0058). The prototype's *produced*
 * figure is an input on both pages (`Overall.html:4021`, contradiction #7); here it is read-only, with
 * a marker beside it saying where it came from and for which month (ADR-0063 §5).
 */
export type SummaryView = 'month' | 'year';

export const SUMMARY_VIEWS = [
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
] as const;

/**
 * Who a sentence is about: the reader, or a coachee in their pronoun. One table, so no card can come to
 * say *you* on a coachee's page.
 */
interface Voice {
  /** The reader's own page. */
  self: boolean;
  subject: CoacheeSubject | null;
  /** you · she · he · they */
  pronoun: string;
  /** you · her · him · them */
  object: string;
  /** your · her · his · their */
  possessive: string;
  /** *have* · *has* · *has* · *have*: *you haven’t*, *she hasn’t*. */
  have: string;
  /** *you’re* · *she’s* · *they’re* */
  isShort: string;
  /** *you’ve* · *she’s* · *they’ve* */
  hasShort: string;
  /** What a present-tense verb ends in: *you log*, *she logs*. */
  s: string;
}

const YOU: Voice = {
  self: true, subject: null, pronoun: 'you', object: 'you', possessive: 'your', have: 'have', isShort: 'you’re', hasShort: 'you’ve', s: '',
};

function voiceOf(subject?: CoacheeSubject): Voice {
  if (!subject) return YOU;
  const forms = PRONOUN_FORMS[subject.pronoun];
  return {
    self: false,
    subject,
    pronoun: forms.subject,
    object: forms.object,
    possessive: forms.possessive,
    have: forms.have,
    isShort: forms.isShort,
    hasShort: forms.hasShort,
    s: forms.s,
  };
}

/**
 * **How the page names its period** (P18.8-T11, ADR-0161 §4). The current one in the prototype's words — *This
 * month* on a card's tag, *this month* in a sentence — and a closed one by its name, *August 2026* and *in August
 * 2026*, since *this month* about August would be false.
 */
interface PeriodWords {
  /** The month or the year the page is about, by name: *Sep 2026*, *2026*. */
  named: string;
  /** The month or year is the office's current one. */
  current: boolean;
  /** A card's tag: *This month* · *This year* · *August 2026* · *2025*. */
  tag: string;
  /** In a sentence: *this month* · *this year* · *in August 2026* · *in 2025*. */
  inline: string;
}

function periodWords(summary: Summary, month: boolean): PeriodWords {
  const named = month ? formatMonth(summary.month) : summary.year;
  const current = month ? summary.period.currentMonth : summary.period.currentYear;
  return {
    named,
    current,
    tag: current ? (month ? 'This month' : 'This year') : named,
    inline: current ? (month ? 'this month' : 'this year') : `in ${named}`,
  };
}

/** Where *Goal Settings* is for this page: the reader's own screen, or the coachee's *Goal Setting* tab. */
const goalHref = (voice: Voice) =>
  (voice.subject ? coachingTabHref(voice.subject.membershipId, 'goal-setting') : '/goals');

export function SummaryCards({
  summary, view, pulse, subject,
}: {
  summary: Summary;
  view: SummaryView;
  /**
   * The *Activity pulse*'s own read and its failure: the reader's `GET /activity/ratios`, or a
   * coachee's `GET /activity/ratios?for=` on their rung (P11-T8). **Absent where no read serves it**,
   * and the card's slot is then a sign rather than a card left out.
   */
  pulse?: { ratios: ActivityRatios | null; error: ApiError | null };
  /** The coachee the page is about; absent on the reader's own `/summary`. */
  subject?: CoacheeSubject;
}) {
  const voice = voiceOf(subject);
  const month = view === 'month';
  const figures = month ? summary.monthly : summary.yearly;
  const when = periodWords(summary, month);
  const period = when.inline;

  return (
    <div className="grid gap-3">
      {/*
        * What the view is about, where the prototype prints *"Week of Aug 24 – Aug 30"* — a label for a
        * weekly digest this page is not; the figures here are the calendar month and year (ADR-0056).
        * *Amended P18.8-T11:* on the screen the month or year select stands here and names it; on paper, this.
        */}
      <p className="hidden text-sm text-muted print:block">
        {when.named}
      </p>

      {!summary.goal.set ? (
        <Card>
          <p className="text-md text-navy">
            {summary.period.currentYear
              ? <>{capitalized(voice.pronoun)} {voice.have}n’t set a goal for {summary.year} yet, so there is nothing to measure against.</>
              // A year that has ended can no longer be given a goal (P18.8-T11): it is said, and nothing offers it.
              : <>{capitalized(voice.pronoun)} didn’t set a goal for {summary.year}, so there is nothing to measure against.</>}
          </p>
          {summary.period.currentYear && (
            <Link href={goalHref(voice)} className={cn('mt-2 inline-block font-semibold text-navy underline', TEXT_TAP)}>Set {voice.possessive} goal</Link>
          )}
        </Card>
      ) : summary.yearly.targetMinor === null ? (
        // Saved, but with no APE target to measure against — zero, or inputs that make no plan.
        <Card>
          <p className="text-md text-navy">
            {summary.period.currentYear
              ? <>{capitalized(voice.possessive)} goal for {summary.year} has no APE target to measure against yet.</>
              : <>{capitalized(voice.possessive)} goal for {summary.year} had no APE target to measure against.</>}
          </p>
          {summary.period.currentYear && (
            <Link href={goalHref(voice)} className={cn('mt-2 inline-block font-semibold text-navy underline', TEXT_TAP)}>Open Goal Settings</Link>
          )}
        </Card>
      ) : (
        <>
          <GoalCard figures={figures} month={month} source={figures.source} voice={voice} when={when} />
          {/*
            * *The gap*, and the pace sentence in it, **for the current period only** (P18.8-T11, ADR-0161 §4):
            * about a month or a year that has ended, *Remaining* and *still needed* would be false.
            */}
          {when.current && <GapCard figures={figures} period={period} pace={month ? summary.pace : null} voice={voice} />}
        </>
      )}

      <TargetsCard activity={month ? summary.activity.monthly : summary.activity.yearly} when={when} voice={voice} />
      {pulse ? (
        <PulseCard pulse={pulse.ratios} error={pulse.error} voice={voice} />
      ) : (
        <ComingInPhaseSection
          title="Activity pulse"
          what={`${capitalized(voice.possessive)} selling and recruitment ratios over the last 30 days, each against its benchmark.`}
          icon="bolt"
          headingClassName="text-md"
          className="px-[22px] py-[18px] print:hidden"
        />
      )}
      <LeadsCard leads={summary.leads} voice={voice} />
      {/*
        * *Campaigns you're chasing* (`Overall.html:3225-3232`, P18.5-T7 AC-6), replacing the sign it was
        * (parity D-11, ADR-0059): the bolt and *From the Campaign list*, a row per chase with *View →*. On
        * paper with the rest, as the prototype prints it.
        *
        * **On a coachee's page**, *Campaigns she's chasing* in their pronoun (`:4121-4130`, P18.5-T9 AC-1): the
        * bolt and no tag, as drawn, and 🚀 chips by title — the same chases, from the same read.
        */}
      <SummaryCard
        id="summary-campaigns"
        title={`Campaigns ${voice.isShort.replace('’', "'")} chasing`}
        icon="bolt"
        tag={voice.self ? CAMPAIGN_COPY.fromList : undefined}
      >
        <ChasingCampaigns forMembershipId={voice.subject?.membershipId} />
      </SummaryCard>
      <InsightCards insights={summary.insights} voice={voice} />
    </div>
  );
}

/**
 * The Summary's card: a titled `<section>` named by its heading, an icon, and a tag or a badge on the
 * right. The coaching session's cards are the same card (G-18), with no icon — the prototype's
 * session cards have none (`Overall.html:4186-4315`) — and, where the prototype puts one, a control or
 * a note on the right in place of the tag (`aside`).
 */
export function SummaryCard({
  id, title, icon, tag, badge, aside, className, children,
}: {
  id: string;
  /** The heading. A node where the prototype puts a link beside the words (*Activity → view full dashboard*). */
  title: ReactNode;
  icon?: NavIconName;
  tag?: ReactNode;
  badge?: string;
  /** On the right of the heading: the session's *+* buttons and the Goal card's hint. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('rounded-lg border border-hairline bg-card px-[22px] py-[18px] print:break-inside-avoid', className)}>
      {/* Wraps rather than squeezes: on a phone a long tag drops under the title instead of folding it. */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 id={id} className="flex items-center gap-2 text-md font-bold text-navy">
          {icon && <NavIcon name={icon} className="h-[17px] w-[17px] text-navy-soft" />}
          {title}
        </h2>
        {tag && <span className="whitespace-nowrap rounded-pill bg-base px-2.5 py-0.5 text-2xs font-semibold text-muted">{tag}</span>}
        {badge && (
          <span className="whitespace-nowrap rounded-pill bg-navy px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-white">{badge}</span>
        )}
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The section chips under the three targets: **the office's summary tiles**, grouped by the server
 * (ADR-0064) — on the seed, the prototype's *Recruitment* and *Development* (`Overall.html:3164-3183`,
 * `:4240-4252`). The Summary's targets card and the coaching session's Activity card draw them with
 * this one component, so the two can never group or word them differently (I-140); `heading` is the
 * one thing that differs, *Recruitment activities* on the Summary and *Recruitment* in the session,
 * each its prototype's words.
 */
export function SectionChips({
  sections, idPrefix, heading = (label) => `${label} activities`,
}: {
  sections: readonly SectionChip[];
  /** Ids for each chip's heading, unique on the page. */
  idPrefix: string;
  heading?: (label: string) => string;
}) {
  if (sections.length === 0) return null;
  return (
    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
      {sections.map((section) => (
        <section key={section.code} aria-labelledby={`${idPrefix}-${section.code}`} className="rounded-[10px] border border-hairline bg-base px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-hairline pb-2">
            <h3 id={`${idPrefix}-${section.code}`} className="text-sm font-semibold text-navy">{heading(section.label)}</h3>
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
  );
}

/**
 * *Goal vs. actual (APE)* (`Overall.html:3094-3115`, `:4014-4031`), read-only (ADR-0058).
 *
 * **Where the figure came from is a marker, not a sentence** (ADR-0063 §5): a glyph beside it whose
 * name and tooltip say whose figure it is and for which month — the upload, its correction, or the
 * member's own. Before this month's file there is no figure to mark: *Not uploaded yet* says so.
 */
function GoalCard({
  figures, month, source, voice, when,
}: { figures: PeriodFigures; month: boolean; source: FigureSource | null; voice: Voice; when: PeriodWords }) {
  const pct = figures.attainmentPct;
  // The year was made before this month began: the month has no target left to fill (ADR-0047).
  const madeAlready = figures.targetMet && figures.targetMinor === 0;
  // *This month's target*, or a closed period's by name (P18.8-T11).
  const targetName = when.current ? (month ? 'This month’s target' : 'This year’s target') : `${when.named}’s target`;
  return (
    <SummaryCard id="summary-goal" title="Goal vs. actual (APE)" icon="target" tag={when.tag}>
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2.5">
        <p className="flex flex-wrap items-baseline gap-1.5">
          {figures.actualMinor === null ? (
            <strong className="font-body text-2xl font-bold text-muted">Not uploaded yet</strong>
          ) : (
            <>
              <strong className="font-body text-2xl font-bold text-navy">{formatRupiahCompact(figures.actualMinor)}</strong>
              {source && (
                <ProducedMarker words={producedFrom(source, month ? 'month' : 'year', voice.subject?.pronoun)} />
              )}
            </>
          )}
          {figures.targetMinor !== null && !madeAlready && (
            <span className="text-sm text-muted">of {formatRupiahCompact(figures.targetMinor)} target</span>
          )}
        </p>
        {pct !== null && (
          <span className="rounded-pill bg-amber/15 px-3 py-1 text-sm font-bold text-navy">{formatPercent(pct)}</span>
        )}
      </div>
      {madeAlready ? (
        <p className="text-sm text-navy">
          {when.current
            ? <>{capitalized(voice.possessive)} year’s target was made before this month began — this month needs nothing more.</>
            : <>{capitalized(voice.possessive)} year’s target was made before {when.named} began — that month needed nothing more.</>}
        </p>
      ) : pct !== null && (
        // Only a measured figure gets a bar: an empty track under *Not uploaded yet* reads as zero.
        <>
          <div
            role="progressbar"
            aria-label={targetName}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, pct)}
            aria-valuetext={formatPercent(pct)}
            className="h-3 overflow-hidden rounded-md border border-hairline bg-base"
          >
            <div className="h-full rounded-md bg-gradient-to-r from-amber to-amber-dark" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>Rp 0</span>
            <span>{targetName}</span>
          </div>
        </>
      )}
    </SummaryCard>
  );
}

/** The provenance marker (ADR-0063 §5): `ⓘ`, its words on hover, focus and tap — the leads table's glyph. */
function ProducedMarker({ words }: { words: string }) {
  return <TippedGlyph glyph="ⓘ" name={words} tip={words} align="fit" className="self-center" />;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** *The gap* (`Overall.html:3117-3136`, `:4037-4052`), and the pace sentence for this month (ADR-0109). */
function GapCard({ figures, period, pace, voice }: { figures: PeriodFigures; period: string; pace: Pace | null; voice: Voice }) {
  return (
    <SummaryCard id="summary-gap" title="The gap" icon="chart">
      <div className="grid gap-3 sm:grid-cols-2">
        <GapTile
          label={`Remaining ${period}`}
          value={figures.gapMinor === null ? '—'
            : figures.targetMet
              ? (figures.overMinor ? `Reached — ${formatRupiahCompact(figures.overMinor)} over` : 'Reached')
              : formatRupiahCompact(figures.gapMinor)}
        />
        <GapTile
          label="≈ Policies still needed"
          value={figures.policiesNeeded === null ? '—'
            : figures.targetMet ? 'None' : plural(figures.policiesNeeded, 'policy', 'policies')}
        />
      </div>
      {pace && <PaceNote pace={pace} voice={voice} />}
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
 * The pace sentence, **the prototype's, verbatim** (ADR-0109; `Overall.html:3132-3135`, `:6340-6347`): on
 * its danger box with ⚠️ (`.pace-note`, `:1143`) until this month's APE target — or the year's — is
 * reached, and on its green box with ✅ (`.pace-note.on-track`, `:1144`) from then on. Every day of the
 * month, with no grey first week.
 *
 * The numbers are the server's: *N* the closings of the last 30 days, *M* the closings chip's target, *W*
 * the office's weeks left (the prototype's *2 weeks*, F-24), *K* the APE gap in policies over *W*. One of
 * anything is singular, as the prototype's own *1 policy* (`:4045`) is. About a coachee it is the
 * prototype's coaching sentence, *"At her current pace, she's tracking to close …"* (`:4050-4051`).
 */
function PaceNote({ pace, voice }: { pace: Pace; voice: Voice }) {
  const met = pace.targetMet;
  const policies = (n: number) => plural(n, 'policy', 'policies');

  return (
    <p
      className={cn(
        'mt-3 flex items-start gap-2 rounded-md border px-3.5 py-3 text-sm leading-relaxed text-navy',
        met ? 'border-success/20 bg-success/[0.06]' : 'border-alert/20 bg-alert/[0.06]',
      )}
    >
      <span aria-hidden="true">{met ? '✅' : '⚠️'}</span>
      <span>
        {met
          ? `${capitalized(voice.hasShort)} already reached this month’s target — nice work. Keep the pace to stay ahead.`
          : (
            <>
              At {voice.possessive} current pace, {voice.isShort} tracking to close <strong>{policies(pace.closingsLast30Days)}</strong> this
              month against a target of <strong>{pace.closingTarget}</strong>. With {plural(pace.weeksLeft, 'week', 'weeks')} left,{' '}
              {voice.pronoun}’d need to close roughly <strong>{pace.neededPerWeek} {pace.neededPerWeek === 1 ? 'policy' : 'policies'}/week</strong> to
              catch up.
            </>
          )}
      </span>
    </p>
  );
}

/**
 * The three chips, in the cascade's words (ADR-0160 §4, 2026-10-26) — the prototype reads *Leads contacted*,
 * *Appointments* and *Closings* (`Overall.html:3146-3160`). The same three stages `/goals` names.
 */
const TARGET_LABEL: Record<ActivityTarget['key'], string> = {
  leads: 'Set appointment',
  appointments: 'Sales meeting',
  closings: 'Submission polis',
};

/**
 * *Your sales activity targets* (`Overall.html:3139-3182`, P10-T5); *Her sales activity targets* about
 * a coachee (`:4058-4079`).
 *
 * The targets are the cascade run on this card's period — this month's fixed APE target, or the year's —
 * so the closings chip and the pace sentence above name one number (ADR-0056). **No target is said, not
 * divided by**: the prototype's bars had no guard, and a zero target printed `NaN%` (F-25).
 *
 * **The section chips are the office's summary tiles** (ADR-0064, P10.1-T6): the server groups the
 * sections that share a tile into one chip under the tile's label, and leaves out a tile holding a
 * cascade type. On the seed that is the prototype's two, *Recruitment activities* and *Development
 * activities* (`Overall.html:3164-3183`). The screen draws the chips as they come and regroups nothing.
 */
function TargetsCard({ activity, when, voice }: { activity: SummaryActivity; when: PeriodWords; voice: Voice }) {
  return (
    <SummaryCard id="summary-targets" title={`${capitalized(voice.possessive)} sales activity targets`} icon="flag" tag={when.tag}>
      <p className="-mt-2 mb-3.5 text-xs text-muted">
        From <Link href={goalHref(voice)} className="font-semibold text-navy-soft underline">Goal Settings</Link> — appointments
        and closings are {voice.possessive} {voice.self ? 'Sales' : 'sales'} pipeline targets.
      </p>
      <div className="grid gap-2.5 md:grid-cols-3">
        {activity.targets.map((target) => <TargetChip key={target.key} target={target} when={when} />)}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        <strong className="text-navy">{activity.total}</strong> total activities logged {when.inline} across all categories.
      </p>
      <SectionChips sections={activity.sections} idPrefix="summary-section" />
    </SummaryCard>
  );
}

function TargetChip({ target, when }: { target: ActivityTarget; when: PeriodWords }) {
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
        <span className="block text-xs text-muted">Nothing more needed {when.inline}</span>
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
 * *Activity pulse* (`Overall.html:3184-3208`, P10-T5): **the ratio engine's answer for the member's
 * rung** — the prototype's four tiles were markup, 9.1% and 0.0% whatever anybody logged.
 *
 * The rates only. The balance is a track with two named ends, and it lives on the ratio screen with the
 * formulas.
 */
function PulseCard({ pulse, error, voice }: { pulse: ActivityRatios | null; error: ApiError | null; voice: Voice }) {
  const rates = pulse?.ratios.filter((r) => r.comparison !== 'band') ?? [];
  return (
    <SummaryCard id="summary-pulse" title="Activity pulse" icon="bolt" tag="Last 30 days">
      {error && <ErrorBanner {...error} />}
      {!pulse && !error && (
        <Skeleton label={`Working out ${voice.possessive} ratios…`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-[92px] rounded-[10px]" />)}
          </div>
        </Skeleton>
      )}
      {pulse && (rates.length === 0 ? (
        <p className="text-sm text-navy">
          {voice.self ? 'Your office has no ratios for your role yet.' : `There are no ratios for ${voice.possessive} role yet.`}
        </p>
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
    </SummaryCard>
  );
}

/** The Leads screen's words for a lead's type: *Recruit*, not *Recruitment*, since 2026-10-26 (ADR-0161 §2). */
const LEAD_TYPE: Record<'sales' | 'recruitment', string> = { sales: 'Sales', recruitment: 'Recruit' };

/**
 * *Leads that need you* (`Overall.html:3210-3217`, `:6151-6218`, P10-T6), and *Leads that need her*
 * about a coachee (`:4115-4116`, *All active leads, nearest date first*): the member's **own** open
 * leads, nearest next action first, undated last.
 *
 * **The flags are the Leads screen's**, from the server's one definition, and *Closes this month* hides
 * none of them (I-103): the prototype showed only the green chip on a lead two weeks late. The nearest
 * ten are listed. The footer that counted the rest and linked to the Leads screen went with the other
 * footnotes (P10.1-T6); whether the card lists every open lead, as the prototype does, is a payload
 * change on the client's sign-off list.
 */
function LeadsCard({ leads, voice }: { leads: Summary['leads']; voice: Voice }) {
  /*
   * **A leader's empty card says whose leads it counts** (P18.8-T15 AC-4, the client's UI review, UI-002). The card is
   * the reader's own leads only, while Leads Management shows a leader their unit's too, so an AB with 71 there read
   * *No active leads yet* here. A reader with none of their own whose unit holds some — `unitOpen`, the server's count
   * of what Leads Management lists them besides their own — is told where those are; anybody else keeps the
   * prototype's sentence.
   */
  const unitHasSome = voice.self && (leads.unitOpen ?? 0) > 0;
  const leadsLink = <Link href="/leads" className="font-semibold text-navy underline">Leads Management</Link>;
  return (
    <SummaryCard
      id="summary-leads"
      title={`Leads that need ${voice.object}`}
      icon="pin"
      tag={voice.self ? 'Your open leads, nearest date first' : 'All active leads, nearest date first'}
    >
      {leads.total === 0 ? (
        voice.self ? (
          <p className="text-sm text-muted">
            {unitHasSome
              ? <>No open leads of your own — your unit’s are in {leadsLink}.</>
              : <>No active leads yet — add some in {leadsLink}.</>}
          </p>
        ) : (
          // The prototype's own empty line on a coachee's card (`Overall.html:10498`).
          <p className="text-sm text-muted">No active leads.</p>
        )
      ) : (
        <ul>
          {leads.rows.map((lead) => <LeadRow key={lead.id} lead={lead} voice={voice} />)}
        </ul>
      )}
    </SummaryCard>
  );
}

function LeadRow({ lead, voice }: { lead: OpenLead; voice: Voice }) {
  // A lead with no type yet is said without one on a coachee's page, whose words carry none of
  // ADR-0084's six; the reader's own keeps the Leads screen's word for it.
  const type = lead.type ? LEAD_TYPE[lead.type] : voice.self ? 'Unassigned' : null;
  const status = lead.statusLabel ?? 'No status yet';
  return (
    // Side by side from `sm`; on a phone the date goes under the name, which a 240px column would squeeze.
    <li className="flex flex-col gap-1.5 border-b border-hairline py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold text-navy">{lead.name || '(unnamed)'}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {type === null ? status : <>{type} · {status}</>}
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

const days = (n: number) => plural(n, 'day', 'days');
const link = (href: string, text: string) => <Link href={href} className="font-semibold text-navy underline">{text}</Link>;

/**
 * The sentence for a card. Every number in it is one the server read, from a registered metric.
 *
 * About a coachee the sentence is in their pronoun and links nowhere: *Log Activity*, *Leads
 * Management* and *Activity Ratios* are the reader's own screens, and would open the reader's data.
 */
function insightText(card: Insight, voice: Voice): ReactNode {
  const You = capitalized(voice.pronoun);
  switch (card.rule) {
    case 'NOTHING_LOGGED':
      if (!voice.self) {
        return card.facts.lastLoggedOn === null
          ? <>{You} {voice.have}n’t logged any activity yet — a few minutes each day is what every number on this page is made of.</>
          : <>Nothing logged in the last {days(card.facts.windowDays)} — {voice.possessive} last entry was {formatShortDay(card.facts.lastLoggedOn)}. Every number on this page is made of what {voice.pronoun} log{voice.s}.</>;
      }
      return card.facts.lastLoggedOn === null
        ? <>You haven’t logged any activity yet — a few minutes in {link('/activity/log', 'Log Activity')} each day is what every number on this page is made of.</>
        : <>Nothing logged in the last {days(card.facts.windowDays)} — your last entry was {formatShortDay(card.facts.lastLoggedOn)}. Every number on this page is made of what you log in {link('/activity/log', 'Log Activity')}.</>;
    case 'BEHIND_PACE':
      return (
        <>
          {capitalized(voice.isShort)} behind pace — at this rate {voice.pronoun}’ll close <strong>{card.facts.closingsLast30Days}</strong> of <strong>{card.facts.closingTarget}</strong> this
          month.{' '}
          {card.facts.weeksLeft === 1
            ? <>About <strong>{plural(card.facts.neededPerWeek, 'policy', 'policies')}</strong> in the week left would catch up.</>
            : <>About <strong>{plural(card.facts.neededPerWeek, 'policy', 'policies')} a week</strong> for the {card.facts.weeksLeft} weeks left would catch up.</>}
        </>
      );
    case 'LEAD_OVERDUE':
      return (
        <>
          <strong>{card.facts.name}</strong>’s next action is {days(card.facts.overdueDays)} overdue — reschedule it or set a new date this week
          {voice.self ? <> in {link('/leads', 'Leads Management')}.</> : '.'}
          {card.facts.others > 0 && <> {plural(card.facts.others, `more of ${voice.possessive} leads is`, `more of ${voice.possessive} leads are`)} overdue too.</>}
        </>
      );
    case 'LEAD_NEGLECTED':
      return (
        <>
          <strong>{card.facts.name}</strong> has no next action and no remarks — follow up and log what happened so this lead doesn’t stall.
          {card.facts.others > 0 && <> {plural(card.facts.others, 'more lead has', 'more leads have')} neither.</>}
        </>
      );
    case 'RATIO_BELOW':
      return (
        <>
          <strong>{card.facts.label}</strong> is {formatRatioForStatus(card.facts.value, card.facts.displayUnit, card.facts.benchmark, 'alert')} over
          the last 30 days, below its benchmark of {formatBenchmark(card.facts.benchmark, card.facts.displayUnit)} — that step is where {voice.possessive} activity
          is not yet converting.{voice.self && <> {link('/activity/ratio', 'Activity Ratios')} shows what it counts.</>}
        </>
      );
    case 'RATIO_STRENGTH':
      return (
        <>
          <strong>{card.facts.label}</strong> is a genuine strength —{' '}
          {formatRatioForStatus(card.facts.value, card.facts.displayUnit, card.facts.benchmark, 'success')} over the last 30 days, well above its
          benchmark of {formatBenchmark(card.facts.benchmark, card.facts.displayUnit)}.
        </>
      );
  }
}

/**
 * The prototype's badge on both cards, verbatim (`Overall.html:3238`, `:3253`, `:4136`, `:4150`). One
 * constant, so the two cards cannot come to say different things.
 */
const INSIGHT_BADGE = 'AI-powered';

/**
 * *What to do next* and *How you can improve your performance* (`Overall.html:3233-3262`, P10-T7) —
 * *How she can improve* about a coachee (`:4149`): **named rules over the member's own numbers**
 * (ADR-0060, D-02), **badged as the prototype badges them**.
 *
 * Both cards wear *AI-powered*, verbatim, at the client's request of 2026-10-01 (ADR-0069, amending
 * ADR-0063 §6, which had made it *Rules, not AI*). What the cards are has not changed: every suggestion
 * is one of ADR-0060's fixed rules, worked out on read, and nothing is generated or learned. The manual
 * says so, which is where ADR-0062 §2 puts an explanation. **The prototype's footnotes stay out** —
 * *Generated automatically*, *will get sharper the more weeks you log*, *Pattern-based coaching*: they
 * claim a system that learns from your weeks, and these rules give the same suggestions for the same
 * numbers however long you log. No item names its rule on screen (ADR-0063 §6): `insights[].rule`
 * stays in the payload, for the tests and for coaching.
 *
 * **The badge is a solid navy pill**, not the prototype's gradients: `#4A6FE0` is in no token, and white
 * on the improvement card's `--amber-dark` end (`Overall.html:1009-1011`) fails the contrast floor. The
 * cards keep the product's own navy and amber edges. The server picks at most four in a fixed priority;
 * a card with nothing in it is not drawn, and when no rule fired the page says so rather than going quiet.
 */
function InsightCards({ insights, voice }: { insights: Insight[]; voice: Voice }) {
  const actions = insights.filter((card) => card.kind === 'action');
  const improve = insights.filter((card) => card.kind === 'improve');
  return (
    <>
      {(actions.length > 0 || improve.length === 0) && (
        <SummaryCard id="summary-next" title="What to do next" icon="spark" badge={INSIGHT_BADGE} className="border-l-4 border-l-navy-soft">
          {actions.length === 0 ? (
            <p className="text-sm text-navy">
              {voice.self
                ? 'Nothing in your numbers asks for anything right now — keep logging, and this is where it will show.'
                : `Nothing in ${voice.possessive} numbers asks for anything right now.`}
            </p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {actions.map((card, i) => (
                <li key={card.rule} className="flex items-start gap-2.5 text-sm leading-normal text-navy">
                  <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-2xs font-bold text-white">{i + 1}</span>
                  <InsightBody card={card} voice={voice} />
                </li>
              ))}
            </ol>
          )}
        </SummaryCard>
      )}
      {improve.length > 0 && (
        <SummaryCard
          id="summary-improve"
          title={voice.self ? 'How you can improve your performance' : `How ${voice.pronoun} can improve`}
          icon="trend"
          badge={INSIGHT_BADGE}
          className="border-l-4 border-l-amber"
        >
          <ul className="flex flex-col gap-3">
            {improve.map((card) => (
              <li key={card.rule} className="flex items-start gap-2.5 text-sm leading-normal text-navy">
                <span aria-hidden="true" className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-amber" />
                <InsightBody card={card} voice={voice} />
              </li>
            ))}
          </ul>
        </SummaryCard>
      )}
    </>
  );
}

function InsightBody({ card, voice }: { card: Insight; voice: Voice }) {
  return <p className="min-w-0">{insightText(card, voice)}</p>;
}
