import { createContext, useContext, useId, type ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { pctText, toneOf, type Tone } from '@/lib/kpm-overview';

/** The split the read served (`thresholds.statusSplitPct`), for every percentage painted below the page. */
export const SplitContext = createContext<number | null>(null);

/** How a percentage is painted, by the split the API served — never a split of the screen's own. */
export function useTone(): (pct: number | null) => Tone {
  const split = useContext(SplitContext);
  if (split === null) throw new Error('A tone was asked for outside the Overview that read its split.');
  return (pct) => toneOf(pct, split);
}

/**
 * The Overview's shared pieces: a panel with its head, the percentage pill, and a bar.
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-5; the client's UI-143, `kpm-owner-mobile-2026-11-03` 1, `kpm-overview-*-2026-11-03`):*
 * the prototype's five stacked sections (`.section-head`, `KPM_Owner.html:77-83`) become **four tiles, two lists and three
 * small cards**. A list or a small card is a **panel**: a white card, its name a heading at its top — a landmark named by
 * it, as each section was — a long explanation behind its ⓘ, and its one action (*Semua n ›*) on the right of the head.
 */
export function OverviewPanel({
  title,
  tip,
  action,
  className,
  children,
}: {
  title: string;
  /** A long explanation, behind an ⓘ by the title (UI-112's rule, which UI-143's mockups follow). */
  tip?: string;
  /** Right of the head: a list's *Semua n ›*. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-lg border border-card-edge bg-card px-4 pb-3 pt-3', className)}>
      <div className="mb-1.5 flex min-h-8 items-center gap-2">
        {/* The ⓘ beside the heading, not in it: the panel is named by its title alone. */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h2 id={id} className="min-w-0 font-display text-md font-bold text-navy">{title}</h2>
          {tip && <TippedGlyph glyph="ⓘ" name={tip} tip={tip} align="fit" />}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * **A list's *Semua n ›*** (UI-143: *"3 rows each + 'Semua ›'"*; `kpm-overview-desktop` 2: *"Semua 5 ›"*): until Phase
 * 19.3 links it to the full list, it opens the rest of the ranking in place and folds it back (D-coverage, as *view full
 * ranking →* did), saying whether it is open. 44px tall below 1024px.
 */
export function ShowAll({
  open, total, controls, onToggle,
}: {
  open: boolean;
  total: number;
  controls: string;
  onToggle: () => void;
}) {
  const t = useMessages(kpmOverviewMessages);
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="-mr-1 inline-flex shrink-0 items-center rounded-sm px-1 text-base font-semibold text-primary-ink underline-offset-2 hover:underline max-lg:min-h-11 lg:min-h-8"
    >
      {open ? t.showFewer : t.allRows({ n: total })}
    </button>
  );
}

/** `.pct.status-success` / `.status-alert` (`:470-471`), and a muted wash for a rate over nobody. */
const PILL_TONE: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  alert: 'bg-alert/10 text-alert',
  neutral: 'bg-muted/10 text-muted',
};

/** The colour a figure's own text takes when it is not in a pill: the leaderboard's and the units' `%`. */
export const TEXT_TONE: Record<Tone, string> = {
  success: 'text-success',
  alert: 'text-alert',
  neutral: 'text-muted',
};

/** The colour of a bar's fill, by the same split. */
export const FILL_TONE: Record<Tone, string> = {
  success: 'bg-success',
  alert: 'bg-alert',
  neutral: 'bg-muted',
};

/**
 * A percentage the server computed, in the prototype's pill: `.engage-figure .pct` (13px, `:469`) or the
 * coaching figure's smaller one (11.5px, `:495`). The words are the figure, so colour is never the only
 * signal; over nobody it reads *—*, and a screen reader hears why.
 */
export function PctPill({ pct, size = 'md', className }: { pct: number | null; size?: 'md' | 'sm'; className?: string }) {
  const tone = useTone();
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-pill font-bold',
        size === 'md' ? 'px-[9px] py-[3px] text-base' : 'px-[7px] py-0.5 text-xs',
        PILL_TONE[tone(pct)],
        className,
      )}
    >
      <Pct pct={pct} />
    </span>
  );
}

/** *76%*, or *—* with its reason for a screen reader; the figure in the figures' language. */
export function Pct({ pct }: { pct: number | null }) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  if (pct !== null) return <>{pctText(pct, figures)}</>;
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t.noRate}</span>
    </>
  );
}

/**
 * A bar: the picture of a figure printed beside it, so it is hidden from assistive technology rather than
 * read twice. The width is clamped to the track while the printed figure may pass 100%.
 *
 * **Spans, displayed as blocks**, because a unit's row is a button and a button holds phrasing content
 * only: a `div` inside one is invalid markup, and axe says so.
 */
export function Bar({
  pct,
  fill,
  className,
  height = 'card',
}: {
  pct: number;
  fill: string;
  className?: string;
  /** The cards' 7px (`:472`), the leaderboard's and the units' 6px (`:503`, `:555`), production's 10px (`:535`). */
  height?: 'card' | 'thin' | 'wide';
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block overflow-hidden rounded-pill border border-hairline bg-base',
        height === 'thin' ? 'h-1.5' : height === 'wide' ? 'h-2.5' : 'h-[7px]',
        className,
      )}
    >
      <span className={cn('block h-full rounded-pill', fill)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

/** `.engage-card`, `.coaching-card`, `.pipeline-card`, `.production-card`: a 12px card on the hairline. */
export function OverviewCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('min-w-0 rounded-lg border border-card-edge bg-card', className)}>{children}</div>;
}
