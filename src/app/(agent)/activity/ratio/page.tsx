'use client';

import { useEffect, useState } from 'react';
import { ACTIVITY_TITLE, ActivityTabs } from '@/components/activity-tabs';
import { Page } from '@/components/page';
import { Card, ErrorBanner } from '@/components/ui/field';
import { NumberBadge } from '@/components/ui/number-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import type { MessagesOf } from '@/i18n/catalogue';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';
import { uiMessages } from '@/i18n/messages/ui';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readActivityRatios, type ActivityRatio, type ActivityRatios, type RatioTerm } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import { balanceAdvice, balanceSideNames, formatBalanceBand, formatBalanceSplit } from '@/lib/ratio-balance';
import { formatBenchmark, formatRatioForStatus } from '@/lib/ratio-format';

/**
 * Activity Ratios (P10-T2, P10-T3): the office's ratios over your last 30 days
 * (`Overall.html:2776-2782`, `:5197-5357`, `activity-management.md` §2.4).
 *
 * **Every number is the server's**, from the office's own definitions and benchmarks. The prototype
 * computes five hardcoded formulas in the page from `mockData`, so nothing an agent logs reaches it.
 *
 * **A ratio that is not a question about your rung is not here at all** (ADR-0020) — the server leaves
 * it out, so there is nothing to hide and nothing to show as failed. On the seed, an agent sees three.
 *
 * **Nor is one with too little data to read** (P18.95-T5 AC-6; the client's UI review, UI-030, 2026-10-26):
 * a ratio whose denominator is zero over the window — the API's `value: null`, *Not enough data* — is left
 * off this list, where it was a card of *–* and a grey pill. The API still answers it, and a coaching
 * session's Ratios card still shows it. When every ratio is too thin, the page says so in its empty card.
 */
export default function ActivityRatioPage() {
  const t = useMessages(activityMessages);
  const [view, setView] = useState<ActivityRatios | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readActivityRatios()
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  return (
    <Page title={ACTIVITY_TITLE} subtitle={t.ratio.subtitle} subtitleOnPhone={false}>
      <ActivityTabs />
      {error && <ErrorBanner {...error} />}
      {!view && !error && <SkeletonCards count={4} label={t.ratio.working} />}
      {view && <Ratios view={view} />}
    </Page>
  );
}

function Ratios({ view }: { view: ActivityRatios }) {
  const t = useMessages(activityMessages);
  const figures = useFigureLanguage();
  /** The ratios there is data enough to read: `null` is *not enough data* (`ratios.md`), never a zero. */
  const readable = view.ratios.filter((ratio) => ratio.value !== null);
  return (
    <>
      {/*
        * The prototype's note, without its second sentence: *"Benchmarks below are placeholders"* was
        * true of a mock-up. These are the office's own (I-66's wording, as the Owner's screen has it).
        */}
      <p className="mb-5 flex items-center gap-2 text-sm text-muted">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
        <span>
          {t.ratio.calculatedOn({
            days: view.days,
            from: formatShortDay(view.from, {}, figures),
            to: formatShortDay(view.to, { year: true }, figures),
            strong: (words) => <strong className="text-navy">{words}</strong>,
          })}
        </span>
      </p>

      {view.ratios.length === 0 ? (
        <Card>
          <p className="text-md text-navy">{t.ratio.none}</p>
        </Card>
      ) : readable.length === 0 ? (
        <Card>
          <p className="text-md text-navy">{t.ratio.notEnough({ days: view.days })}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {readable.map((ratio) => (ratio.comparison === 'band'
            ? <BalanceCard key={ratio.code} ratio={ratio} />
            : <RateCard key={ratio.code} ratio={ratio} />))}
        </div>
      )}
    </>
  );
}

/** The prototype's left-edge accent, by the section a ratio measures (`Overall.html:237-240`). */
const ACCENT: Record<string, string> = {
  LEADS_GENERATION: 'border-l-success',
  SELLING: 'border-l-amber-dark',
  RECRUITMENT: 'border-l-navy-soft',
};

const VALUE_CLASS: Record<ActivityRatio['status'], string> = {
  success: 'text-success',
  alert: 'text-alert',
  neutral: 'text-navy',
};

/** The module's words, in the reader's language (`messages/activity.tsx`; P18.98-T4). */
type ActivityWords = MessagesOf<typeof activityMessages.en>;

/**
 * A rate against its benchmark: its figure and its benchmark in the reader's figures, a unit's words in the reader's
 * (`ratio-words.ts`, P18.98-T4).
 */
function RateCard({ ratio }: { ratio: ActivityRatio }) {
  const t = useMessages(activityMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const id = `ratio-${ratio.code}`;
  return (
    <article
      aria-labelledby={id}
      className={cn(
        'rounded-lg border border-l-4 border-hairline bg-card p-[18px]',
        ACCENT[ratio.tag?.code ?? ''] ?? 'border-l-hairline',
      )}
    >
      <Head ratio={ratio} id={id} />
      <p className={cn('font-body text-3xl font-bold leading-tight', VALUE_CLASS[ratio.status])}>
        {formatRatioForStatus(ratio.value, ratio.displayUnit, ratio.benchmark, ratio.status, figures, language)}
      </p>
      <p className="mb-2.5 mt-1 text-sm text-muted">
        {t.ratio.benchmark}:{' '}
        <strong className="text-navy">{formatBenchmark(ratio.benchmark, ratio.displayUnit, figures, language)}</strong>
      </p>
      <StatusPill status={ratio.status} />
      <Explain ratio={ratio} />
    </article>
  );
}

/**
 * The balance (`Overall.html:5300-5328`): which way the last 30 days leaned, on a track from one side
 * to the other.
 *
 * **As each side's share of the two** (P13.1-T6). The prototype wrote the lean as `24%` over a
 * `100% / 0% / 100%` tick row, and P10-T2 rewrote it in points; the client read both as ambiguous
 * (2026-10-07). Two selling and three recruiting is *40% Selling · 60% Recruitment*, the marker 60% of
 * the way toward Recruitment's end, and the band the same benchmark read as shares — ±30 points is each
 * side between 35% and 65%. No ticks, and no figure on the marker: the sentence beneath is the reading,
 * and it is what a screen reader hears, the track being a picture of it.
 *
 * **The ends are named by what each side counts** — *Selling* and *Recruitment* on the seed, *Side A* and
 * *Side B* where a side has no one section — so an office that builds its own is not told it leans
 * toward selling.
 *
 * **Off the band, the sentence says what to do** (P18.95-T5 AC-6, the client's request of 2026-10-26):
 * *67,0% Selling · 33,0% Recruitment · Too much selling — aim for 35%–65%*, where it read *Below
 * benchmark*; in the band it still reads *On track*. The band is the ratio's own benchmark (`balanceAdvice`).
 */
function BalanceCard({ ratio }: { ratio: ActivityRatio }) {
  const t = useMessages(activityMessages);
  const states = useMessages(uiMessages).status;
  const language = useLanguage();
  const figures = useFigureLanguage();
  const id = `ratio-${ratio.code}`;
  const { first, second } = balanceSideNames(ratio.sides, language);
  const split = ratio.value === null || ratio.share === null
    ? null
    : formatBalanceSplit(ratio.share, ratio.benchmark, ratio.status, figures);
  const band = formatBalanceBand(ratio.benchmark, figures);
  // Off the band, what to do about it (P18.95-T5 AC-6); in it, today's words.
  const advice = balanceAdvice(ratio.share, ratio.benchmark, ratio.status, ratio.sides, figures, language);
  // The marker sits at the second side's share, from the first side's end — the prototype's `recruitmentPct`.
  const position = ratio.share === null ? null : 100 - ratio.share;

  return (
    <article aria-labelledby={id} className="rounded-lg border border-hairline bg-base p-[18px] md:col-span-2">
      <Head ratio={ratio} id={id} />
      <div className="mt-1.5">
        <div className="mb-2.5 flex justify-between text-sm font-semibold text-muted" aria-hidden="true">
          <span>{t.ratio.more({ side: first })}</span>
          <span>{t.ratio.more({ side: second })}</span>
        </div>
        <div className="relative mx-2 mb-4 h-2 rounded-md bg-gradient-to-r from-amber-dark via-hairline to-navy-soft" aria-hidden="true">
          <span className="absolute -top-1 left-1/2 h-4 w-px -translate-x-1/2 bg-muted" />
          {position !== null && (
            <span
              data-testid="balance-marker"
              className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-navy shadow-sm"
              style={{ left: `${position}%` }}
            />
          )}
        </div>
        <p className="text-center text-sm text-muted">
          {split === null ? t.ratio.notEnoughData : (
            <>
              <strong className="text-navy">{split.first}</strong> {first}
              {' · '}
              <strong className="text-navy">{split.second}</strong> {second}
              {' · '}
              {advice ?? states[ratio.status]}
            </>
          )}
        </p>
        <p className="mt-1 text-center text-xs text-muted">{t.ratio.band({ low: band.low, high: band.high })}</p>
      </div>
      <Explain ratio={ratio} />
    </article>
  );
}

function Head({ ratio, id }: { ratio: ActivityRatio; id: string }) {
  return (
    <div className="mb-2.5">
      {ratio.tag && (
        <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">{ratio.tag.label}</p>
      )}
      <h2 id={id} className="text-md font-bold leading-snug text-navy">{ratio.label}</h2>
    </div>
  );
}

/**
 * *What is this ratio?* — the prototype's hover tooltip (`Overall.html:5341-5348`) as a disclosure.
 *
 * A tooltip that opens on hover cannot be opened on a phone and is reached by keyboard only through an
 * `info-wrap` with a `tabindex`; a `<details>` opens by tap, Enter and Space alike. It shows **the
 * office's formula** as the log screen numbers its rows — so a formula the office changed (ADR-0024) is
 * visibly that office's — each number named beneath, and the platform's sentence for what the ratio
 * measures only where the formula is still the platform's.
 */
function Explain({ ratio }: { ratio: ActivityRatio }) {
  const t = useMessages(activityMessages);
  const terms = [...ratio.numerator, ...ratio.denominator].filter(
    (term, i, all) => all.findIndex((t) => t.code === term.code) === i,
  );
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer text-muted underline-offset-2 hover:text-navy hover:underline">
        {t.ratio.whatIs}
      </summary>
      <div className="mt-2 rounded-md bg-navy/[0.04] p-3">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="sr-only">{sentence(ratio, t)}</span>
          <Side terms={ratio.numerator} />
          <span aria-hidden="true" className="font-semibold text-muted">{ratio.comparison === 'band' ? t.ratio.versus : '÷'}</span>
          <Side terms={ratio.denominator} />
        </p>
        <ul className="mt-2 space-y-0.5 text-xs text-muted">
          {terms.map((term) => (
            <li key={term.code}>
              {term.displayOrder > 0 ? `${term.displayOrder} — ` : ''}{term.label}
            </li>
          ))}
        </ul>
        {ratio.purpose && <p className="mt-2 text-xs italic text-muted">{ratio.purpose}</p>}
        {ratio.divergesFromStandard && (
          <p className="mt-2 text-xs text-muted">{t.ratio.ownFormula}</p>
        )}
      </div>
    </details>
  );
}

function Side({ terms }: { terms: RatioTerm[] }) {
  const wrap = terms.length > 1;
  return (
    <span aria-hidden="true" className="inline-flex flex-wrap items-center gap-1">
      {wrap && <span className="text-muted">(</span>}
      {terms.map((term, i) => (
        <span key={term.code} className="inline-flex items-center gap-1">
          {i > 0 && <span className="font-semibold text-muted">+</span>}
          {term.displayOrder > 0 ? <NumberBadge n={term.displayOrder} /> : <span>{term.code}</span>}
        </span>
      ))}
      {wrap && <span className="text-muted">)</span>}
    </span>
  );
}

/** The formula in words, for a screen reader: `Submission polis divided by …` — the types' names as the office typed them. */
function sentence(ratio: ActivityRatio, t: ActivityWords): string {
  const side = (terms: RatioTerm[]) => t.ratio.sum({ labels: terms.map((term) => term.label) });
  return ratio.comparison === 'band'
    ? t.ratio.against({ a: side(ratio.numerator), b: side(ratio.denominator) })
    : t.ratio.dividedBy({ a: side(ratio.numerator), b: side(ratio.denominator) });
}
