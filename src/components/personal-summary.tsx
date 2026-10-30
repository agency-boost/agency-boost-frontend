'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Boost } from '@/components/boost';
import { ChasingCampaigns } from '@/components/campaigns/chasing-card';
import { ComingInPhaseSection } from '@/components/coming-in-phase';
import { GoalHeroCard } from '@/components/goal-hero-card';
import { RatioCard } from '@/components/ratio-card';
import { LineIcon } from '@/components/ui/line-icon';
import { TEXT_TAP } from '@/components/ui/phone';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { StatusPill } from '@/components/ui/status-pill';
import { TermTip } from '@/components/ui/term-tip';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { kept } from '@/i18n/kept';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignChasingMessages } from '@/i18n/messages/campaign-chasing';
import { voiceOf, type Voice } from '@/i18n/messages/goal-words';
import { summaryMessages } from '@/i18n/messages/summary';
import type { ActivityRatios } from '@/lib/activity';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { coachingTabHref, PRONOUN_FORMS, type CoacheeSubject } from '@/lib/coaching';
import { formatCalendarDay, formatMonth, formatNumber, formatRupiahCompact, formatShortDay } from '@/lib/format';
import { producedFrom } from '@/lib/goals';
import { flagLabel } from '@/lib/leads';
import { formatBenchmark, formatRatioForStatus } from '@/lib/ratio-format';
import {
  daysLeftIn,
  type ActivityTarget, type FigureSource, type Insight, type OpenLead, type PeriodFigures, type SectionChip, type Summary,
  type SummaryActivity,
} from '@/lib/summary';
import { useMediaQuery } from '@/lib/use-media-query';

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
 *
 * **UI V1 (2026-10-30; UI-050 – UI-057, P18.99-T7)** — the report and its `summary-mobile` and `summary-desktop` mockups
 * are the design. One section pattern (the heading outside a borderless white card); the date header and the goal card
 * with the gap inside it (UI-054); one *Target aktivitas* card (UI-050); the shared ratio card, as rows (UI-053); the
 * leads card left out on a phone while it is empty (UI-055); two columns from 1024px (UI-056); line icons, no emoji
 * (UI-057).
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
   * The ratio card's own read and its failure: the reader's `GET /activity/ratios`, or a coachee's
   * `GET /activity/ratios?for=` on their rung (P11-T8). **Absent where no read serves it**, and the card's slot is
   * then a sign rather than a card left out.
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
  const actions = summary.insights.filter((card) => card.kind === 'action');
  const improve = summary.insights.filter((card) => card.kind === 'improve');

  return (
    /*
     * **One column below 1024px, two from it** (UI-050, UI-056): on a desktop the goal and the activity targets on the
     * left (~60%), the ratios, the campaigns, the next steps and the leads on the right (~40%). The order in the
     * document is the phone's, so a keyboard and a screen reader meet the sections as a phone shows them. Not centred:
     * the cards' edge is the title's (UI-056).
     */
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-5">
      {/*
        * What the view is about, on paper: on the screen the period pill names it (P18.8-T11).
        */}
      <p className="hidden text-sm text-muted print:block lg:col-span-2">
        {when.named}
      </p>

      <div className="grid min-w-0 gap-4">
        {!summary.goal.set ? (
          <PlainCard>
            <p className="text-md text-navy">
              {summary.period.currentYear
                ? t.noGoal.notYet({ who: voice, year: summary.year })
                // A year that has ended can no longer be given a goal (P18.8-T11): it is said, and nothing offers it.
                : t.noGoal.didNot({ who: voice, year: summary.year })}
            </p>
            {summary.period.currentYear && (
              <Link href={goalHref(voice)} className={cn('mt-2 inline-block font-semibold text-navy underline', TEXT_TAP)}>{t.noGoal.set({ who: voice })}</Link>
            )}
          </PlainCard>
        ) : summary.yearly.targetMinor === null ? (
          // Saved, but with no APE target to measure against — zero, or inputs that make no plan.
          <PlainCard>
            <p className="text-md text-navy">
              {summary.period.currentYear
                // *APE*'s first appearance on the page when there is no goal card, so its ⓘ is here (P18.95-T9 AC-3).
                ? t.noTarget.notYet({ who: voice, year: summary.year, tip: <TermTip term="APE" /> })
                : t.noTarget.had({ who: voice, year: summary.year, tip: <TermTip term="APE" /> })}
            </p>
            {summary.period.currentYear && (
              <Link href={goalHref(voice)} className={cn('mt-2 inline-block font-semibold text-navy underline', TEXT_TAP)}>{t.noTarget.open}</Link>
            )}
          </PlainCard>
        ) : (
          <GoalSection summary={summary} numbers={numbers} month={month} voice={voice} when={when} />
        )}

        <TargetsSection activity={month ? summary.activity.monthly : summary.activity.yearly} when={when} voice={voice} />
      </div>

      <div className="grid min-w-0 gap-4">
        {pulse ? (
          /*
           * **The shared ratio card, as rows** (UI-053, O-3): its header inside it — *Ratio · 30 hari terakhir* — the
           * split bar and every ratio, the same figures as Activity › Ratio (the same read). No heading outside it.
           */
          <RatioCard
            ratios={pulse.ratios?.ratios ?? null}
            days={pulse.ratios?.days ?? 30}
            error={pulse.error}
            className="print:break-inside-avoid"
          />
        ) : (
          <ComingInPhaseSection
            title={t.pulse.title}
            what={t.pulse.sign({ who: voice })}
            icon="bolt"
            headingClassName="text-md"
            className="px-[22px] py-[18px] print:hidden"
          />
        )}

        {/*
          * *Campaign yang Anda kejar* (P18.5-T7 AC-6; UI-006): the chases from the Campaign list that have not ended, each
          * opening its dialog in place; *Dari Campaign list* on a desktop only (Appendix A). About a coachee, in their
          * pronoun, as chips by title (P18.5-T9 AC-1).
          */}
        <Section
          id="summary-campaigns"
          title={t.campaigns({ who: voice })}
          meta={voice.self ? <span className="max-lg:hidden">{chasing.fromList}</span> : undefined}
        >
          <div className={cn(CARD, 'px-3.5 py-1.5')}>
            <ChasingCampaigns forMembershipId={voice.coachee?.membershipId} />
          </div>
        </Section>

        <InsightSections actions={actions} improve={improve} voice={voice} />
        <LeadsSection leads={summary.leads} voice={voice} />
      </div>
    </div>
  );
}

/** A white card, borderless on the V1 surface (UI-008): 16px corners. */
const CARD = 'rounded-lg border border-card-edge bg-card';

function PlainCard({ children }: { children: ReactNode }) {
  return <div className={cn(CARD, 'px-[22px] py-[18px] print:break-inside-avoid')}>{children}</div>;
}

/**
 * **The one section pattern** (UI-050): the heading outside the card, 14px/700, with an optional ⓘ beside it and an
 * optional meta on the right; the card below it. A `<section>` named by its heading.
 */
function Section({
  id, title, info, meta, className, children,
}: {
  id: string;
  title: ReactNode;
  /** Beside the heading, outside it, so the heading's name stays its words. */
  info?: ReactNode;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 print:break-inside-avoid', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-1">
          <h2 id={id} className="font-body text-md font-bold text-navy">{title}</h2>
          {info}
        </span>
        {meta && <span className="text-xs text-muted">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * **The date header and the goal card** (UI-054, UI-050).
 *
 * - **The date header**, outside and above the card in the headings' style: a calendar line icon and the day the APE is
 *   valid for — the office's latest upload for the period (`uploadedOn`), or the period's name while there is none —
 *   and on the right the days left in the current month or year after today, *sisa 1 hari bulan ini*, or that today is
 *   the last. A closed period: the date only.
 * - **The goal card** (`GoalHeroCard`): *Target vs. realisasi (APE)* and its % badge, the APE produced and the target,
 *   the bar, and — for the current period — the gap inside it: *Sisa bulan ini* | *Polis yang dibutuhkan ± 4 polis*. No
 *   separate *Selisih* card and no pace box: the behind-pace message is the *Langkah berikutnya* card's, once (UI-054).
 * - **Boost celebrating** beside the figure when the goal is reached (UI-102: goal ≥ 100%).
 *
 * **Where the figure came from is a marker, not a sentence** (ADR-0063 §5): the ⓘ beside it says whose figure it is and
 * for which month. Read-only (ADR-0058).
 */
function GoalSection({
  summary, numbers, month, voice, when,
}: { summary: Summary; numbers: PeriodFigures & { source: FigureSource | null }; month: boolean; voice: PageVoice; when: PeriodWords }) {
  const t = useMessages(summaryMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const pct = numbers.attainmentPct;
  // The year was made before this month began: the month has no target left to fill (ADR-0047).
  const madeAlready = numbers.targetMet && numbers.targetMinor === 0;
  const money = (minor: number) => formatRupiahCompact(minor, {}, figures);
  const source = numbers.source;

  // *The gap*, inside the card, **for the current period only** (P18.8-T11, ADR-0161 §4): about a closed one it is false.
  const facts = when.current && numbers.targetMinor !== null ? [
    {
      label: t.gap.remaining({ when: when.inline }),
      value: numbers.gapMinor === null ? '—'
        : numbers.targetMet
          ? (numbers.overMinor ? t.gap.reachedOver({ sum: money(numbers.overMinor) }) : t.gap.reached)
          : money(numbers.gapMinor),
    },
    {
      label: t.gap.policiesNeeded,
      value: numbers.policiesNeeded === null ? '—'
        : numbers.targetMet ? t.gap.none : t.gap.about({ n: numbers.policiesNeeded }),
    },
  ] as const : undefined;

  // *APE*'s first appearance on the page, so its ⓘ follows the heading (P18.95-T9 AC-3; UI-028).
  const apeTip = <TermTip term="APE" className="ml-0.5" />;

  return (
    <section aria-labelledby="summary-goal" data-summary-goal="" className="min-w-0 print:break-inside-avoid">
      <DateHeader summary={summary} month={month} when={when} />
      <GoalHeroCard
        // The words and a glyph on the accent are navy: the shared card's rule (5.9:1).
        className="[&_button]:text-navy [&_button:hover]:bg-navy/10"
        title={(
          <>
            <span role="heading" aria-level={2} id="summary-goal">{t.goal.title}</span>
            {apeTip}
          </>
        )}
        percent={pct}
        achieved={numbers.actualMinor === null ? (
          <span className="text-2xl font-bold">{t.goal.notUploaded}</span>
        ) : (
          <>
            {money(numbers.actualMinor)}
            {source && (
              <ProducedMarker words={producedFrom(source, month ? 'month' : 'year', voice.coachee?.pronoun, figures, language)} />
            )}
          </>
        )}
        target={madeAlready
          ? <span className="block text-base">{when.current ? t.goal.madeAlready({ who: voice }) : t.goal.madeBefore({ who: voice, named: when.named })}</span>
          : numbers.targetMinor !== null ? t.goal.ofTarget({ sum: money(numbers.targetMinor) }) : undefined}
        facts={facts}
        aside={pct !== null && pct >= 100 ? <Boost pose="celebrating" size={96} /> : undefined}
      />
    </section>
  );
}

/** The provenance marker (ADR-0063 §5): an ⓘ line icon, its words on hover, focus and tap. */
function ProducedMarker({ words }: { words: string }) {
  return (
    <TippedGlyph
      glyph={<LineIcon name="info" className="h-4 w-4" />}
      name={words}
      tip={words}
      align="fit"
      className="ml-1 align-middle [&_button]:font-normal"
    />
  );
}

/** *30 Okt 2026* · *sisa 1 hari bulan ini* (UI-054): above the goal card, outside it. */
function DateHeader({ summary, month, when }: { summary: Summary; month: boolean; when: PeriodWords }) {
  const t = useMessages(summaryMessages);
  const figures = useFigureLanguage();
  const span = month ? 'month' : 'year';
  const uploaded = month ? summary.uploadedOn?.month : summary.uploadedOn?.year;
  const left = when.current ? daysLeftIn(summary.today, span) : null;
  return (
    <div data-date-header="" className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="flex items-center gap-1.5 text-md font-bold text-navy">
        <LineIcon name="calendar" className="h-4 w-4" />
        {uploaded ? formatCalendarDay(uploaded, figures) : when.named}
      </p>
      {left !== null && (
        <p className="text-xs text-muted">{left === 0 ? t.dateHeader.lastDay[span] : t.dateHeader.daysLeft[span]({ n: left })}</p>
      )}
    </div>
  );
}

/**
 * The three columns, in the cascade's words (ADR-0160 §4, 2026-10-26) — the same three stages `/goals` names, kept
 * English in both languages (§A.6; UI-006).
 */
const TARGET_LABEL: Record<ActivityTarget['key'], string> = {
  leads: kept('Set appointment'),
  appointments: kept('Sales meeting'),
  closings: kept('Submission polis'),
};

/**
 * ***Target aktivitas penjualan Anda*** (UI-050, UI-056; P10-T5): **one white card**.
 *
 * - **Top**: three columns split by a 1px line — *Set appointment · Sales meeting · Submission polis* — each its 12px
 *   label (it may wrap), *1 / 40* (22px/700 and 12px grey) and a 6px bar, the numbers in line however the labels wrap.
 *   The targets are the cascade run on the period's APE target (ADR-0056); **no target is said, not divided by** (F-25).
 * - **Below a divider, the office's summary tiles** (ADR-0064): on a phone one split row, *Aktivitas Recruitment 1 ›* |
 *   *Aktivitas Development 2 ›*, each opening its list in a sheet; from 768px the lists side by side, every row shown
 *   (UI-056; Appendix A: the activity names *behind a tap* on a phone only).
 * - **The heading's meta is the total** — *6 aktivitas bulan ini*, the sum of the rows beneath it (UI-052 (c)) — and its
 *   ⓘ says **where the policies come from**: *Submission polis* is what was logged, APE the office's upload (UI-052 (a)).
 *   On a tablet the ⓘ also holds *Dari Goal Settings — …*, which a desktop shows as a line and a phone leaves out
 *   (Appendix A).
 */
function TargetsSection({ activity, when, voice }: { activity: SummaryActivity; when: PeriodWords; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const figures = useFigureLanguage();
  const tablet = useMediaQuery('tablet');
  const [open, setOpen] = useState<string | null>(null);
  const tip = tablet ? `${t.targets.fromTip({ who: voice })} ${t.targets.source({ who: voice })}` : t.targets.source({ who: voice });
  const opened = activity.sections.find((section) => section.code === open) ?? null;
  return (
    <Section
      id="summary-targets"
      title={t.targets.title({ who: voice })}
      info={<TippedGlyph glyph={<LineIcon name="info" className="h-4 w-4" />} name={tip} tip={tip} align="fit" />}
      meta={(
        <span data-activity-total="">
          {t.targets.total({
            strong: (words) => <strong className="font-bold text-navy">{words}</strong>,
            count: formatNumber(activity.total, {}, figures),
            n: activity.total,
            when: when.inline,
          })}
        </span>
      )}
    >
      <div className={cn(CARD, 'overflow-hidden')}>
        {/* Appendix A: shown on a desktop, behind the ⓘ on a tablet, removed on a phone. */}
        <p className="px-3.5 pt-3 text-xs text-muted max-lg:hidden">
          {t.targets.from({
            who: voice,
            link: (words) => <Link href={goalHref(voice)} className="font-semibold text-navy-soft underline">{words}</Link>,
          })}
        </p>
        <div className="grid grid-cols-3 px-0.5 py-3 lg:px-1 lg:py-3.5">
          {activity.targets.map((target) => <TargetColumn key={target.key} target={target} when={when} />)}
        </div>
        {activity.sections.length > 0 && (
          <>
            <div data-breakdown="phone" className="grid grid-cols-2 border-t border-divider md:hidden">
              {activity.sections.map((section) => (
                <button
                  key={section.code}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setOpen(section.code)}
                  className="flex min-h-12 min-w-0 items-center justify-between gap-1.5 px-3 text-left hover:bg-hover-row [&:nth-child(even)]:border-l [&:nth-child(even)]:border-divider [&:nth-child(n+3)]:border-t [&:nth-child(n+3)]:border-divider"
                >
                  <span className="min-w-0 text-xs text-muted">{t.targets.section({ label: section.label })}</span>
                  <span className="flex shrink-0 items-center gap-0.5 text-xl font-bold text-navy">
                    {formatNumber(section.total, {}, figures)}
                    <LineIcon name="chevronRight" className="h-4 w-4 text-signal-grey" />
                  </span>
                </button>
              ))}
            </div>
            <div data-breakdown="wide" className="grid border-t border-divider max-md:hidden md:grid-cols-2">
              {activity.sections.map((section) => (
                <div
                  key={section.code}
                  className="min-w-0 px-3.5 py-3 text-base [&:nth-child(even)]:border-l [&:nth-child(even)]:border-divider [&:nth-child(n+3)]:border-t [&:nth-child(n+3)]:border-divider"
                >
                  <h3 className="mb-1.5 flex items-baseline justify-between gap-3 font-bold text-navy">
                    <span>{t.targets.section({ label: section.label })}</span>
                    <span>{formatNumber(section.total, {}, figures)}</span>
                  </h3>
                  <BreakdownRows rows={section.rows} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {opened && (
        <ResponsiveSheet open title={t.targets.section({ label: opened.label })} onClose={() => setOpen(null)}>
          <BreakdownRows rows={opened.rows} />
        </ResponsiveSheet>
      )}
    </Section>
  );
}

/** A summary tile's rows: each activity as the office named it, and its count. */
function BreakdownRows({ rows }: { rows: SectionChip['rows'] }) {
  const figures = useFigureLanguage();
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.code} className="flex items-baseline justify-between gap-3 py-0.5 text-base text-navy">
          <span className="min-w-0">{row.label}</span>
          <span className="font-semibold tabular-nums">{formatNumber(row.count, {}, figures)}</span>
        </li>
      ))}
    </ul>
  );
}

/** One of the three columns: its label, *1 / 40* and its bar — or why there is no bar. */
function TargetColumn({ target, when }: { target: ActivityTarget; when: PeriodWords }) {
  const t = useMessages(summaryMessages);
  const figures = useFigureLanguage();
  const label = TARGET_LABEL[target.key];
  const pct = target.attainmentPct;
  return (
    <div data-target={target.key} className="flex min-w-0 flex-col justify-between gap-1.5 px-2.5 [&+&]:border-l [&+&]:border-divider">
      <span className="text-xs text-muted">{label}</span>
      <div>
        <p className="text-[1.375rem] font-bold leading-tight tabular-nums text-navy">
          {formatNumber(target.logged, {}, figures)}
          {target.target !== null && target.target > 0 && (
            <span className="text-xs font-normal text-muted"> / {formatNumber(target.target, {}, figures)}</span>
          )}
        </p>
        {target.target === null ? (
          <span className="mt-1 block text-xs text-muted">{t.targets.noTarget}</span>
        ) : target.target === 0 ? (
          <span className="mt-1 block text-xs text-muted">{t.targets.nothingMore({ when: when.inline })}</span>
        ) : (
          <div
            role="progressbar"
            aria-label={t.targets.against({ label })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, pct ?? 0)}
            aria-valuetext={t.targets.progress({ logged: target.logged, target: target.target })}
            className="mt-1.5 h-1.5 overflow-hidden rounded bg-navy/10"
          >
            <div className="h-full rounded bg-navy" style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * *Leads that need you* (`Overall.html:3210-3217`, `:6151-6218`, P10-T6), and *Leads that need her*
 * about a coachee (`:4115-4116`, *All active leads, nearest date first*): the member's **own** open
 * leads, nearest next action first, undated last.
 *
 * **The flags are the Leads screen's**, from the server's one definition, and *Closes this month* hides
 * none of them (I-103). The nearest ten are listed.
 *
 * **UI V1** (UI-050, UI-055, UI-056): the heading outside the card, last on the page — on a desktop the right column's
 * last section; its tag, *Leads terbuka Anda, tanggal terdekat lebih dulu*, on a desktop only (Appendix A). **On a
 * phone it is not drawn while there is no open lead** (UI-055); from 768px the empty card says so, as before.
 */
function LeadsSection({ leads, voice }: { leads: Summary['leads']; voice: PageVoice }) {
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
  const empty = leads.total === 0;
  return (
    <Section
      id="summary-leads"
      title={t.leads.title({ who: voice })}
      meta={<span className="max-lg:hidden">{voice.self ? t.leads.tagOwn : t.leads.tagTheirs}</span>}
      className={cn(empty && 'max-md:hidden')}
    >
      <div className={cn(CARD, 'px-3.5', empty ? 'py-3' : 'py-1')}>
        {empty ? (
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
      </div>
    </Section>
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
 * Both wear *AI-powered* — *Berbasis AI* — at the client's request of 2026-10-01 (ADR-0069, amending ADR-0063 §6). What
 * the cards are has not changed: every suggestion is one of ADR-0060's fixed rules, worked out on read, and nothing is
 * generated or learned. The manual says so. No item names its rule on screen (ADR-0063 §6): `insights[].rule` stays in
 * the payload, for the tests and for coaching.
 *
 * **UI V1** (UI-050, UI-054): each a section with its heading outside the card and the badge — a solid navy pill, in
 * sentence case — on the right; the behind-pace message is said here and nowhere else on the page (UI-054). The server
 * picks at most four in a fixed priority; a card with nothing in it is not drawn, and when no rule fired the page says
 * so rather than going quiet.
 */
function InsightSections({ actions, improve, voice }: { actions: Insight[]; improve: Insight[]; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const badge = (
    <span className="whitespace-nowrap rounded-pill bg-navy px-2 py-0.5 text-xs font-semibold text-white">{t.insights.badge}</span>
  );
  return (
    <>
      {(actions.length > 0 || improve.length === 0) && (
        <Section id="summary-next" title={t.insights.next} meta={badge}>
          <div className={cn(CARD, 'px-3.5 py-3')}>
            {actions.length === 0 ? (
              <p className="text-base text-navy">
                {voice.self ? t.insights.quietOwn : t.insights.quietTheirs({ who: voice })}
              </p>
            ) : actions.length === 1 ? (
              <InsightBody card={actions[0]} voice={voice} />
            ) : (
              <ol className="flex flex-col gap-2.5">
                {actions.map((card, i) => (
                  <li key={card.rule} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-2xs font-bold text-white">{i + 1}</span>
                    <InsightBody card={card} voice={voice} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Section>
      )}
      {improve.length > 0 && (
        <Section
          id="summary-improve"
          title={voice.self ? t.insights.improveOwn : t.insights.improveTheirs({ who: voice })}
          meta={badge}
        >
          <ul className={cn(CARD, 'flex flex-col gap-3 px-3.5 py-3')}>
            {improve.map((card) => (
              <li key={card.rule}>
                <InsightBody card={card} voice={voice} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function InsightBody({ card, voice }: { card: Insight; voice: PageVoice }) {
  const t = useMessages(summaryMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  return <p className="min-w-0 text-base leading-normal text-navy">{insightText(card, voice, t, figures, language)}</p>;
}
