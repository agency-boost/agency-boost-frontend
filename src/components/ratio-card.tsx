'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { readActivityRatios, type ActivityRatio } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { balanceSideNames, formatBalanceSplit } from '@/lib/ratio-balance';
import { formatBenchmark, formatRatioForStatus } from '@/lib/ratio-format';

/**
 * **The ratio card: one component, one format, on every page** (UI V1, UI-053; O-3 *rows*; the owner, 30 Oct: *same as
 * Unit Activities*). Personal Summary, the Coaching Session, Activity › Ratio and the Unit Dashboard's Activities tab.
 *
 * - **A navy card** (the app's navy, O-1), 16px corners, 12px 14px of room. Its header is inside it — *Ratio · 30 hari
 *   terakhir* 14px/700, the section titles' size since the owner's review of 7 November (MOB UI-185) — with `headerRight`
 *   beside it for the Unit Dashboard's *Unit ⌄* picker (MOB UI-184).
 * - **The split bar**: the balance ratio (`comparison: 'band'`) as each side's share — *Selling 58%* on the accent,
 *   *Recruitment 42%* on lavender — the words inside the bar, 12px/600. **Navy words on the accent** (5.9:1) and white on
 *   lavender (4.77:1), not the mockups' white on the accent (2.38:1, under AA): a word sitting on whichever side is under
 *   it takes that side's colour.
 * - **Every other ratio is a row**, every time, in the order the office set: its name as the office named it (never
 *   translated), *Target X* under it, and its value on the right, 22px — green when it meets its benchmark, red when it
 *   does not, judged by the server on the unrounded value; **a whole percentage** (UI-080); *Leads per activity* to two
 *   places; and **–** in lavender with too little data, which a screen reader hears as *Data belum cukup*.
 * - **No pills, dots or verdict words** (UI-053): the colour repeats the comparison the two figures already make.
 * - **`tiles`: from 768px, four equal tiles** (P19.18-T2 AC-3; ADR-0271 §10; the brief of 19 November 2026, part A,
 *   *"ratio card: Selling vs Recruitment bar full width, then the 4 ratios as 4 equal mini tiles (big value on top, ratio
 *   name, 'Target x' underneath)"*; `unit-aktivitas-{tablet,laptop}`): the split bar across the card, then one tile per
 *   ratio in one row — its value on top, 26px, in the same colours, its name, *Target X* under it. **Never the formula.**
 *   One list, laid out by the width alone, so a phone keeps its rows and nothing is drawn twice. The Unit Dashboard's
 *   *Aktivitas* asks for it; every other page keeps the rows, and a card whose rows explain themselves (`explain`) too.
 *
 * **The figures are the server's** (`GET /activity/ratios`, the Ratio page's); this card computes nothing. The Unit
 * Dashboard passes its Unit or Group answer the same way (`ratios`), once its endpoint exists.
 */
export function RatioCard({
  ratios,
  days = 30,
  headerRight,
  loading = false,
  error = null,
  headingLevel = 2,
  explain,
  tiles = false,
  className,
}: {
  /** The ratios as `GET /activity/ratios` answers them (`ActivityRatios.ratios`); `null` while loading. */
  ratios: readonly ActivityRatio[] | null;
  /** The window, in days: *30 hari terakhir*. */
  days?: number;
  /** Right of the header: the Unit Dashboard's *Unit | Group*. */
  headerRight?: ReactNode;
  loading?: boolean;
  error?: ApiError | null;
  /** The header's level in the page's outline: 2 under a page's title, 3 inside a section. */
  headingLevel?: 2 | 3;
  /**
   * **What a ratio is, behind a tap on its row** (UI-106: *explanations behind tapping a row*, Activity › Ratio). Given,
   * each row is a button that opens this under it; absent, the rows are read-only as on every other page.
   */
  explain?: (ratio: ActivityRatio) => ReactNode;
  /** From 768px, the ratios as equal tiles in one row (P19.18-T2 AC-3): the Unit Dashboard's *Aktivitas*. */
  tiles?: boolean;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const balance = ratios?.find((ratio) => ratio.comparison === 'band') ?? null;
  const rows = ratios?.filter((ratio) => ratio.comparison !== 'band') ?? [];
  const titleId = useId();
  // A row that explains itself is a button with a panel under it: those stay rows (Activity › Ratio, UI-106).
  const asTiles = tiles && !explain;

  return (
    <section
      aria-labelledby={titleId}
      data-ratio-card=""
      className={cn('rounded-lg bg-navy px-3.5 py-3 text-white', className)}
    >
      <div className="mb-1 flex min-h-8 items-center gap-2">
        {/* The section titles' one size, 14px / 700 (P19.8-T4 AC-8, MOB UI-185; ADR-0227 §4), white on the navy. */}
        <Heading id={titleId} data-section-title="" className="min-w-0 flex-1 font-body text-md font-bold text-white">{t.ratio.title({ days })}</Heading>
        {headerRight}
      </div>
      {error ? (
        <ErrorBanner {...error} />
      ) : loading || ratios === null ? (
        <Skeleton label={t.ratio.working}>
          <div className="space-y-3 py-2">
            <div className="h-6 rounded-md bg-white/10" />
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-md bg-white/[0.06]" />)}
          </div>
        </Skeleton>
      ) : ratios.length === 0 ? (
        <p className="py-3 text-base text-on-navy-muted">{t.ratio.none}</p>
      ) : (
        <>
          {balance && <SplitBar ratio={balance} />}
          <ul
            data-ratio-tiles={asTiles ? '' : undefined}
            className={cn(asTiles && 'md:grid md:gap-2')}
            // One column a ratio, all equal: a grid only from 768px, so on a phone the template is never read.
            style={asTiles ? { gridTemplateColumns: `repeat(${Math.max(1, rows.length)}, minmax(0, 1fr))` } : undefined}
          >
            {rows.map((ratio) => <RatioRow key={ratio.code} ratio={ratio} explain={explain} tile={asTiles} />)}
          </ul>
        </>
      )}
    </section>
  );
}

/** *Selling vs Recruitment*, then the bar: each side's share, its words inside it. */
function SplitBar({ ratio }: { ratio: ActivityRatio }) {
  const t = useMessages(uiV1Messages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { first, second } = balanceSideNames(ratio.sides, language);
  const share = ratio.value === null ? null : ratio.share;
  const split = share === null ? null : formatBalanceSplit(share, ratio.benchmark, ratio.status, figures);
  const firstWidth = share === null ? 0 : Math.min(100, Math.max(0, share));
  // A word takes the colour of the side it sits on: navy on the accent, white on lavender.
  const leftOnAccent = firstWidth > 0;
  const rightOnAccent = firstWidth >= 100;
  const said = split
    ? t.ratio.split({ first, firstShare: split.first, second, secondShare: split.second })
    : `${first} · ${second}: ${t.ratio.noData}`;

  return (
    <div className="pb-2.5 pt-1.5">
      <p className="mb-1.5 text-base text-white">{ratio.label}</p>
      <div
        role="img"
        aria-label={said}
        data-split-bar=""
        className="relative flex h-6 overflow-hidden rounded-md bg-white/10 text-xs font-semibold"
      >
        {share !== null && (
          <>
            <span className="h-full bg-amber" style={{ flexGrow: firstWidth, flexBasis: 0 }} />
            <span className="h-full bg-lavender" style={{ flexGrow: 100 - firstWidth, flexBasis: 0 }} />
          </>
        )}
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-between px-2">
          <span className={cn('truncate', share === null ? 'text-on-navy-lavender' : leftOnAccent ? 'text-navy' : 'text-white')}>
            {first} {split?.first ?? '–'}
          </span>
          <span className={cn('truncate', share === null ? 'text-on-navy-lavender' : rightOnAccent ? 'text-navy' : 'text-white')}>
            {second} {split?.second ?? '–'}
          </span>
        </span>
      </div>
    </div>
  );
}

const VALUE_TONE: Record<ActivityRatio['status'], string> = {
  success: 'text-on-navy-green',
  alert: 'text-on-navy-red',
  neutral: 'text-white',
};

/**
 * One ratio: its name, *Target X* under it, its value on the right — and, with `explain`, a tap away from what it is. As a
 * **`tile`** from 768px (P19.18-T2 AC-3): the value on top and larger, the name bold, *Target X* under it, on its own lighter
 * navy; the same markup, in the same reading order, on a phone a row.
 */
function RatioRow({
  ratio, explain, tile = false,
}: { ratio: ActivityRatio; explain?: (ratio: ActivityRatio) => ReactNode; tile?: boolean }) {
  const t = useMessages(uiV1Messages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const empty = ratio.value === null;
  const line = (
    <>
      <div className={cn('min-w-0 flex-1', tile && 'md:w-full md:flex-none')}>
        <p className={cn('text-base text-white', tile && 'md:font-semibold md:leading-snug')}>{ratio.label}</p>
        <p className="mt-0.5 text-sm text-on-navy-muted">
          {t.ratio.target({ value: formatBenchmark(ratio.benchmark, ratio.displayUnit, figures, language) })}
        </p>
      </div>
      <p
        data-status={empty ? 'none' : ratio.status}
        className={cn('shrink-0 text-right text-[1.375rem] font-semibold tabular-nums leading-tight',
          tile && 'md:text-left md:text-[1.625rem] md:font-bold',
          empty ? 'text-on-navy-lavender' : VALUE_TONE[ratio.status])}
      >
        {empty ? (
          <>
            <span aria-hidden="true">–</span>
            <span className="sr-only">{t.ratio.noData}</span>
          </>
        ) : formatRatioForStatus(ratio.value, ratio.displayUnit, ratio.benchmark, ratio.status, figures, language)}
      </p>
    </>
  );
  if (!explain) {
    return (
      <li
        data-ratio={ratio.code}
        className={cn(
          'flex items-center gap-3 border-t border-on-navy-line py-2.5',
          // The tile, from 768px: the value above the words (the list's order reversed on screen, never in the DOM).
          tile && 'md:flex-col-reverse md:items-start md:justify-end md:gap-1 md:rounded-[12px] md:border-t-0 md:bg-white/[0.06] md:px-3.5 md:py-3',
        )}
      >
        {line}
      </li>
    );
  }
  return (
    <li data-ratio={ratio.code} className="border-t border-on-navy-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((was) => !was)}
        className="flex min-h-11 w-full items-center gap-3 py-2.5 text-left hover:bg-white/[0.04]"
      >
        {line}
      </button>
      {open && <div id={panelId} className="pb-3 text-sm text-on-navy-muted">{explain(ratio)}</div>}
    </li>
  );
}

/**
 * **The card wired to the Ratio page's own data** — `GET /activity/ratios`, the reader's last 30 days, or with
 * `membershipId` a coachee's (answered only for somebody the reader coaches, audited; `readActivityRatios`). For
 * `/activity/ratio`, `/summary` and the Coaching Session. The Unit Dashboard's Unit | Group card passes its own
 * `ratios` to `RatioCard` instead.
 */
export function PersonalRatioCard({
  membershipId,
  headerRight,
  headingLevel,
  explain,
  className,
}: {
  membershipId?: string;
  headerRight?: ReactNode;
  headingLevel?: 2 | 3;
  /** What a ratio is, behind a tap on its row (`RatioCard`'s): Activity › Ratio's (UI-106). */
  explain?: (ratio: ActivityRatio) => ReactNode;
  className?: string;
}) {
  const [ratios, setRatios] = useState<ActivityRatio[] | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setRatios(null);
    setError(null);
    readActivityRatios(membershipId)
      .then((view) => {
        if (!live) return;
        setRatios(view.ratios);
        setDays(view.days);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [membershipId]);

  return (
    <RatioCard
      ratios={ratios}
      days={days}
      error={error}
      headerRight={headerRight}
      headingLevel={headingLevel}
      explain={explain}
      className={className}
    />
  );
}
