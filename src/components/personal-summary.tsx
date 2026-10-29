'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChasingCampaigns } from '@/components/campaigns/chasing-card';
import { ComingInPhaseSection } from '@/components/coming-in-phase';
import { SectionChips, SummaryCard } from '@/components/summary-card';
import { Card, ErrorBanner } from '@/components/ui/field';
import { REMOVED_ON_PHONE, TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { TermTip } from '@/components/ui/term-tip';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { kept } from '@/i18n/kept';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignChasingMessages } from '@/i18n/messages/campaign-chasing';
import { voiceOf, type Voice } from '@/i18n/messages/goal-words';
import { summaryMessages } from '@/i18n/messages/summary';
import type { ActivityRatio, ActivityRatios } from '@/lib/activity';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { coachingTabHref, PRONOUN_FORMS, type CoacheeSubject } from '@/lib/coaching';
import { formatMonth, formatNumber, formatPercent, formatRupiahCompact, formatShortDay } from '@/lib/format';
import { producedFrom } from '@/lib/goals';
import { flagLabel } from '@/lib/leads';
import { formatBenchmark, formatRatioForStatus } from '@/lib/ratio-format';
import type {
  ActivityTarget, FigureSource, Insight, OpenLead, Pace, PeriodFigures, Summary, SummaryActivity,
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
 * What differs by subject is said once, in `pageVoice`, and every string either voice writes on a
 * coachee's page uses none of ADR-0084's six words: *office*, *KPM*, *reports to*, *tagged to*,
 * *untagged*, *unassigned*.
 *
 * **Read from what other screens own, and editing none of it** (ADR-0058). The prototype's *produced*
 * figure is an input on both pages (`Overall.html:4021`, contradiction #7); here it is read-only, with
 * a marker beside it saying where it came from and for which month (ADR-0063 §5).
 *
 * **Its words are the catalogue's** (P18.98-T4, field selling; ADR-0179 §4): `i18n/messages/summary.tsx`, in the
 * reader's language (`useLanguage()`), and every figure in the reader's figures' (`useFigureLanguage()`), handed to the
 * message that holds it. A coachee is written in their pronoun's English forms (`PRONOUN_FORMS`) and is *dia* in
 * Indonesian. What the office typed — a tile's and an activity's label, a ratio's name, a lead's name, status and note —
 * is shown as typed.
 */
export type SummaryView = 'month' | 'year';

/** The page's words, in the reader's language. */
type Words = typeof summaryMessages.id;

/**
 * *Monthly* · *Yearly* in English, the catalogue's source — what a page not moved yet hands its switch. A page that has
 * moved draws `useSummaryViews()`, the same two in the reader's language.
 */
export const SUMMARY_VIEWS = [
  { id: 'month', label: summaryMessages.en.views.month },
  { id: 'year', label: summaryMessages.en.views.year },
] as const;

/** The two views, *Monthly* and *Yearly*, in the reader's language (P18.98-T4): `/summary`'s switch. */
export function useSummaryViews() {
  const t = useMessages(summaryMessages);
  return [
    { id: 'month', label: t.views.month },
    { id: 'year', label: t.views.year },
  ] as const;
}

/**
 * Who a sentence is about: the reader, or a coachee in their pronoun (`Voice`, `i18n/messages/goal-words.ts`), and
 * the coachee for their links. One table, so no card can come to say *you* on a coachee's page.
 */
interface PageVoice extends Voice {
  /** The coachee the page is about; `null` on the reader's own. */
  readonly coachee: CoacheeSubject | null;
}

function pageVoice(subject?: CoacheeSubject): PageVoice {
  return { ...voiceOf(subject ? PRONOUN_FORMS[subject.pronoun] : undefined), coachee: subject ?? null };
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

function periodWords(summary: Summary, month: boolean, t: Words, figures: Language): PeriodWords {
  const named = month ? formatMonth(summary.month, figures) : summary.year;
  const current = month ? summary.period.currentMonth : summary.period.currentYear;
  const view = month ? 'month' : 'year';
  return {
    named,
    current,
    tag: current ? t.when.tag[view] : named,
    inline: current ? t.when.inline[view] : t.when.inNamed({ named }),
  };
}

/** Where *Goal Settings* is for this page: the reader's own screen, or the coachee's *Goal Setting* tab. */
const goalHref = (voice: PageVoice) =>
  (voice.coachee ? coachingTabHref(voice.coachee.membershipId, 'goal-setting') : '/goals');

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
  const t = useMessages(summaryMessages);
  // *From the Campaign list*: the campaigns' words (`campaign-chasing.ts`), in the reader's language.
  const chasing = useMessages(campaignChasingMessages);
  const figures = useFigureLanguage();
  const voice = pageVoice(subject);
  const month = view === 'month';
  const numbers = month ? summary.monthly : summary.yearly;
  const when = periodWords(summary, month, t, figures);
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
              ? t.noGoal.notYet({ who: voice, year: summary.year })
              // A year that has ended can no longer be given a goal (P18.8-T11): it is said, and nothing offers it.
              : t.noGoal.didNot({ who: voice, year: summary.year })}
          </p>
          {summary.period.currentYear && (
            <Link href={goalHref(voice)} className={cn('mt-2 inline-block font-semibold text-navy underline', TEXT_TAP)}>{t.noGoal.set({ who: voice })}</Link>
          )}
        </Card>
      ) : summary.yearly.targetMinor === null ? (
        // Saved, but with no APE target to measure against — zero, or inputs that make no plan.
        <Card>
          <p className="text-md text-navy">
            {summary.period.currentYear
              // *APE*'s first appearance on the page when there is no Goal card, so its ⓘ is here (P18.95-T9 AC-3).
              ? t.noTarget.notYet({ who: voice, year: summary.year, tip: <TermTip term="APE" /> })
              : t.noTarget.had({ who: voice, year: summary.year, tip: <TermTip term="APE" /> })}
          </p>
          {summary.period.currentYear && (
            <Link href={goalHref(voice)} className={cn('mt-2 inline-block font-semibold text-navy underline', TEXT_TAP)}>{t.noTarget.open}</Link>
          )}
        </Card>
      ) : (
        <>
          <GoalCard numbers={numbers} month={month} source={numbers.source} voice={voice} when={when} />
          {/*
            * *The gap*, and the pace sentence in it, **for the current period only** (P18.8-T11, ADR-0161 §4):
            * about a month or a year that has ended, *Remaining* and *still needed* would be false.
            */}
          {when.current && <GapCard numbers={numbers} period={period} pace={month ? summary.pace : null} voice={voice} />}
        </>
      )}

      <TargetsCard activity={month ? summary.activity.monthly : summary.activity.yearly} when={when} voice={voice} />
      {pulse ? (
        <PulseCard pulse={pulse.ratios} error={pulse.error} voice={voice} />
      ) : (
        <ComingInPhaseSection
          title={t.pulse.title}
          what={t.pulse.sign({ who: voice })}
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
        title={t.campaigns({ who: voice })}
        icon="bolt"
        tag={voice.self ? chasing.fromList : undefined}
      >
        <ChasingCampaigns forMembershipId={voice.coachee?.membershipId} />
      </SummaryCard>
      <InsightCards insights={summary.insights} voice={voice} />
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
  numbers, month, source, voice, when,
}: { numbers: PeriodFigures; month: boolean; source: FigureSource | null; voice: PageVoice; when: PeriodWords }) {
  const t = useMessages(summaryMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const pct = numbers.attainmentPct;
  // The year was made before this month began: the month has no target left to fill (ADR-0047).
  const madeAlready = numbers.targetMet && numbers.targetMinor === 0;
  // *This month's target*, or a closed period's by name (P18.8-T11).
  const targetName = when.current ? t.goal.target[month ? 'month' : 'year'] : t.goal.namedTarget({ named: when.named });
  return (
    // *APE*'s first appearance on the page, so its ⓘ follows the heading (P18.95-T9 AC-3; UI-028).
    <SummaryCard id="summary-goal" title={t.goal.title} term="APE" icon="target" tag={when.tag}>
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2.5">
        <p className="flex flex-wrap items-baseline gap-1.5">
          {numbers.actualMinor === null ? (
            <strong className="font-body text-2xl font-bold text-muted">{t.goal.notUploaded}</strong>
          ) : (
            <>
              <strong className="font-body text-2xl font-bold text-navy">{formatRupiahCompact(numbers.actualMinor, {}, figures)}</strong>
              {source && (
                <ProducedMarker words={producedFrom(source, month ? 'month' : 'year', voice.coachee?.pronoun, figures, language)} />
              )}
            </>
          )}
          {numbers.targetMinor !== null && !madeAlready && (
            <span className="text-sm text-muted">{t.goal.ofTarget({ sum: formatRupiahCompact(numbers.targetMinor, {}, figures) })}</span>
          )}
        </p>
        {pct !== null && (
          <span className="rounded-pill bg-amber/15 px-3 py-1 text-sm font-bold text-navy">{formatPercent(pct, {}, figures)}</span>
        )}
      </div>
      {madeAlready ? (
        <p className="text-sm text-navy">
          {when.current ? t.goal.madeAlready({ who: voice }) : t.goal.madeBefore({ who: voice, named: when.named })}
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
            aria-valuetext={formatPercent(pct, {}, figures)}
            className="h-3 overflow-hidden rounded-md border border-hairline bg-base"
          >
            <div className="h-full rounded-md bg-gradient-to-r from-amber to-amber-dark" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>{formatRupiahCompact(0, {}, figures)}</span>
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

/** *The gap* (`Overall.html:3117-3136`, `:4037-4052`), and the pace sentence for this month (ADR-0109). */
function GapCard({ numbers, period, pace, voice }: { numbers: PeriodFigures; period: string; pace: Pace | null; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const figures = useFigureLanguage();
  return (
    <SummaryCard id="summary-gap" title={t.gap.title} icon="chart">
      <div className="grid gap-3 sm:grid-cols-2">
        <GapTile
          label={t.gap.remaining({ when: period })}
          value={numbers.gapMinor === null ? '—'
            : numbers.targetMet
              ? (numbers.overMinor ? t.gap.reachedOver({ sum: formatRupiahCompact(numbers.overMinor, {}, figures) }) : t.gap.reached)
              : formatRupiahCompact(numbers.gapMinor, {}, figures)}
        />
        <GapTile
          label={`≈ ${t.gap.policiesNeeded}`}
          value={numbers.policiesNeeded === null ? '—'
            : numbers.targetMet ? t.gap.none : t.gap.policies({ n: numbers.policiesNeeded })}
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
function PaceNote({ pace, voice }: { pace: Pace; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const met = pace.targetMet;

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
          ? t.pace.met({ who: voice })
          : t.pace.behind({
            who: voice,
            strong: (words) => <strong>{words}</strong>,
            closings: pace.closingsLast30Days,
            target: pace.closingTarget,
            weeks: pace.weeksLeft,
            perWeek: pace.neededPerWeek,
          })}
      </span>
    </p>
  );
}

/**
 * The three chips, in the cascade's words (ADR-0160 §4, 2026-10-26) — the prototype reads *Leads contacted*,
 * *Appointments* and *Closings* (`Overall.html:3146-3160`). The same three stages `/goals` names, kept English in both
 * languages (§A.6).
 */
const TARGET_LABEL: Record<ActivityTarget['key'], string> = {
  leads: kept('Set appointment'),
  appointments: kept('Sales meeting'),
  closings: kept('Submission polis'),
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
function TargetsCard({ activity, when, voice }: { activity: SummaryActivity; when: PeriodWords; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const figures = useFigureLanguage();
  return (
    <SummaryCard id="summary-targets" title={t.targets.title({ who: voice })} icon="flag" tag={when.tag}>
      {/* The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 21): from 768px it reads as before. */}
      <p className={cn('-mt-2 mb-3.5 text-xs text-muted', REMOVED_ON_PHONE)}>
        {t.targets.from({
          who: voice,
          link: (words) => <Link href={goalHref(voice)} className="font-semibold text-navy-soft underline">{words}</Link>,
        })}
      </p>
      <div className="grid gap-2.5 md:grid-cols-3">
        {activity.targets.map((target) => <TargetChip key={target.key} target={target} when={when} />)}
      </div>
      {/*
        * **The client's line, at every size** (P18.95-T7 AC-1, grey text row 22; ADR-0167 §7): *5 activities this
        * month*, where it read *"5 total activities logged this month across all categories."* The count is the
        * server's, and the period the card's.
        */}
      <p className="mt-3 text-center text-xs text-muted">
        {t.targets.total({
          strong: (words) => <strong className="text-navy">{words}</strong>,
          count: formatNumber(activity.total, {}, figures),
          n: activity.total,
          when: when.inline,
        })}
      </p>
      <SectionChips sections={activity.sections} idPrefix="summary-section" heading={(label) => t.targets.section({ label })} />
    </SummaryCard>
  );
}

function TargetChip({ target, when }: { target: ActivityTarget; when: PeriodWords }) {
  const t = useMessages(summaryMessages);
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
        <span className="block text-xs text-muted">{t.targets.noTarget}</span>
      ) : target.target === 0 ? (
        <span className="block text-xs text-muted">{t.targets.nothingMore({ when: when.inline })}</span>
      ) : (
        <div
          role="progressbar"
          aria-label={t.targets.against({ label })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct ?? 0)}
          aria-valuetext={t.targets.progress({ logged: target.logged, target: target.target })}
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
function PulseCard({ pulse, error, voice }: { pulse: ActivityRatios | null; error: ApiError | null; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const rates = pulse?.ratios.filter((r) => r.comparison !== 'band') ?? [];
  return (
    <SummaryCard id="summary-pulse" title={t.pulse.title} icon="bolt" tag={t.pulse.tag}>
      {error && <ErrorBanner {...error} />}
      {!pulse && !error && (
        <Skeleton label={t.pulse.working({ who: voice })}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-[92px] rounded-[10px]" />)}
          </div>
        </Skeleton>
      )}
      {pulse && (rates.length === 0 ? (
        <p className="text-sm text-navy">
          {voice.self ? t.pulse.noneOwn : t.pulse.noneTheirs({ who: voice })}
        </p>
      ) : (
        <div className={cn('grid gap-3 sm:grid-cols-2', pulseColumns(rates.length))}>
          {rates.map((ratio) => (
            <div key={ratio.code} className="rounded-[10px] border border-hairline bg-base px-3.5 py-3">
              <span className="mb-1 block text-xs text-muted">{ratio.label}</span>
              <span className={cn('mb-1.5 block font-body text-xl font-bold', PULSE_VALUE[ratio.status])}>
                {formatRatioForStatus(ratio.value, ratio.displayUnit, ratio.benchmark, ratio.status, figures, language)}
              </span>
              <StatusPill status={ratio.status} />
            </div>
          ))}
        </div>
      ))}
    </SummaryCard>
  );
}

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
function LeadsCard({ leads, voice }: { leads: Summary['leads']; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  /*
   * **A leader's empty card says whose leads it counts** (P18.8-T15 AC-4, the client's UI review, UI-002). The card is
   * the reader's own leads only, while Leads Management shows a leader their unit's too, so an AB with 71 there read
   * *No active leads yet* here. A reader with none of their own whose unit holds some — `unitOpen`, the server's count
   * of what Leads Management lists them besides their own — is told where those are; anybody else keeps the
   * prototype's sentence.
   */
  const unitHasSome = voice.self && (leads.unitOpen ?? 0) > 0;
  const leadsLink = (words: string) => <Link href="/leads" className="font-semibold text-navy underline">{words}</Link>;
  return (
    <SummaryCard
      id="summary-leads"
      title={t.leads.title({ who: voice })}
      icon="pin"
      tag={voice.self ? t.leads.tagOwn : t.leads.tagTheirs}
    >
      {leads.total === 0 ? (
        voice.self ? (
          <p className="text-sm text-muted">
            {unitHasSome ? t.leads.unitHasSome({ link: leadsLink }) : t.leads.noneYet({ link: leadsLink })}
          </p>
        ) : (
          // The prototype's own empty line on a coachee's card (`Overall.html:10498`).
          <p className="text-sm text-muted">{t.leads.noneTheirs}</p>
        )
      ) : (
        <ul>
          {leads.rows.map((lead) => <LeadRow key={lead.id} lead={lead} voice={voice} />)}
        </ul>
      )}
    </SummaryCard>
  );
}

function LeadRow({ lead, voice }: { lead: OpenLead; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  // A lead with no type yet is said without one on a coachee's page, whose words carry none of
  // ADR-0084's six; the reader's own keeps the Leads screen's word for it. The two types are the Leads screen's,
  // *Recruit*, not *Recruitment*, since 2026-10-26 (ADR-0161 §2).
  const type = lead.type ? t.leads.types[lead.type] : voice.self ? t.leads.unassigned : null;
  // The stage's name is the office's, as typed.
  const status = lead.statusLabel ?? t.leads.noStatus;
  return (
    // Side by side from `sm`; on a phone the date goes under the name, which a 240px column would squeeze.
    <li className="flex flex-col gap-1.5 border-b border-hairline py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold text-navy">{lead.name || t.leads.unnamed}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {type === null ? status : <>{type} · {status}</>}
          </span>
          {lead.thisMonth && <StatusPill status="success" label={t.leads.closesThisMonth} className="whitespace-nowrap" />}
          {lead.flags.map((flag) => (
            <StatusPill key={flag} status="alert" label={flagLabel(flag, lead.overdueDays, language)} className="whitespace-nowrap" />
          ))}
        </div>
      </div>
      <div className="leading-normal sm:max-w-[240px] sm:shrink-0 sm:pt-px sm:text-right">
        {lead.nextActionDate ? (
          <>
            {/* Navy, not the prototype's amber: small amber text clears no contrast floor (`tokens.md`). */}
            <span className="text-xs font-bold text-navy">{formatShortDay(lead.nextActionDate, {}, figures)}</span>
            {lead.nextActionNote && <span className="text-xs text-navy-soft"> — {lead.nextActionNote}</span>}
          </>
        ) : (
          <span className="text-xs font-semibold text-muted">{t.leads.noDate}</span>
        )}
      </div>
    </li>
  );
}

/** A screen an insight names, as the link to it: its words the sentence's, in the reader's language. */
function screenLink(href: string, words: string) {
  return <Link href={href} className="font-semibold text-navy underline">{words}</Link>;
}

/**
 * The sentence for a card. Every number in it is one the server read, from a registered metric; a day and a ratio are
 * written here, in the figures' language, and handed to the message.
 *
 * About a coachee the sentence is in their pronoun and links nowhere: *Log Activity*, *Leads
 * Management* and *Activity Ratios* are the reader's own screens, and would open the reader's data.
 */
function insightText(card: Insight, voice: PageVoice, t: Words, figures: Language, language: Language): ReactNode {
  const strong = (words: string) => <strong>{words}</strong>;
  /** A screen the sentence names, as a link to it — on the reader's own page only. */
  const linkTo = (href: string) => (words: string) => screenLink(href, words);
  const say = t.insights;
  switch (card.rule) {
    case 'NOTHING_LOGGED': {
      const { lastLoggedOn, windowDays } = card.facts;
      if (lastLoggedOn === null) {
        return voice.self ? say.neverOwn({ link: linkTo('/activity/log') }) : say.neverTheirs({ who: voice });
      }
      const date = formatShortDay(lastLoggedOn, {}, figures);
      return voice.self
        ? say.quietSinceOwn({ windowDays, date, link: linkTo('/activity/log') })
        : say.quietSinceTheirs({ who: voice, windowDays, date });
    }
    case 'BEHIND_PACE':
      return say.behindPace({
        who: voice,
        strong,
        closings: card.facts.closingsLast30Days,
        target: card.facts.closingTarget,
        perWeek: card.facts.neededPerWeek,
        weeksLeft: card.facts.weeksLeft,
      });
    case 'LEAD_OVERDUE':
      return say.leadOverdue({
        who: voice,
        strong,
        name: card.facts.name,
        overdueDays: card.facts.overdueDays,
        others: card.facts.others,
        link: voice.self ? linkTo('/leads') : null,
      });
    case 'LEAD_NEGLECTED':
      return say.leadNeglected({ strong, name: card.facts.name, others: card.facts.others });
    case 'RATIO_BELOW':
      return say.ratioBelow({
        who: voice,
        strong,
        label: card.facts.label,
        value: formatRatioForStatus(card.facts.value, card.facts.displayUnit, card.facts.benchmark, 'alert', figures, language),
        benchmark: formatBenchmark(card.facts.benchmark, card.facts.displayUnit, figures, language),
        link: voice.self ? linkTo('/activity/ratio') : null,
      });
    case 'RATIO_STRENGTH':
      return say.ratioStrength({
        strong,
        label: card.facts.label,
        value: formatRatioForStatus(card.facts.value, card.facts.displayUnit, card.facts.benchmark, 'success', figures, language),
        benchmark: formatBenchmark(card.facts.benchmark, card.facts.displayUnit, figures, language),
      });
  }
}

/**
 * *What to do next* and *How you can improve your performance* (`Overall.html:3233-3262`, P10-T7) —
 * *How she can improve* about a coachee (`:4149`): **named rules over the member's own numbers**
 * (ADR-0060, D-02), **badged as the prototype badges them**.
 *
 * Both cards wear *AI-powered*, verbatim, at the client's request of 2026-10-01 (ADR-0069, amending
 * ADR-0063 §6, which had made it *Rules, not AI*) — the prototype's badge on both cards (`Overall.html:3238`,
 * `:3253`, `:4136`, `:4150`), one message, so the two cannot come to say different things. What the cards are
 * has not changed: every suggestion
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
function InsightCards({ insights, voice }: { insights: Insight[]; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const actions = insights.filter((card) => card.kind === 'action');
  const improve = insights.filter((card) => card.kind === 'improve');
  return (
    <>
      {(actions.length > 0 || improve.length === 0) && (
        <SummaryCard id="summary-next" title={t.insights.next} icon="spark" badge={t.insights.badge} className="border-l-4 border-l-navy-soft">
          {actions.length === 0 ? (
            <p className="text-sm text-navy">
              {voice.self ? t.insights.quietOwn : t.insights.quietTheirs({ who: voice })}
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
          title={voice.self ? t.insights.improveOwn : t.insights.improveTheirs({ who: voice })}
          icon="trend"
          badge={t.insights.badge}
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

function InsightBody({ card, voice }: { card: Insight; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  return <p className="min-w-0">{insightText(card, voice, t, figures, language)}</p>;
}
