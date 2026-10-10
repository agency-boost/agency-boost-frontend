import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { OWN_COPY, pctText, toneOf, type Tone } from '@/lib/kpm-overview';

/** The split the read served (`thresholds.statusSplitPct`), for every percentage painted below the page. */
export const SplitContext = createContext<number | null>(null);

/** How a percentage is painted, by the split the API served — never a split of the screen's own. */
export function useTone(): (pct: number | null) => Tone {
  const split = useContext(SplitContext);
  if (split === null) throw new Error('A tone was asked for outside the Overview that read its split.');
  return (pct) => toneOf(pct, split);
}

/**
 * The Overview's shared pieces: a section with its head, the percentage pill, and a bar.
 *
 * `.section-head` (`KPM_Owner.html:77-83`): the heading at 16px bold navy, its sub-line beside it in muted
 * 12.5px, stacked under it on a phone. Each section is a landmark named by its heading, so a screen
 * reader's list of regions reads the prototype's five heads in order.
 */
export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-[34px] min-w-0 first-of-type:mt-0">
      <div className="mb-3.5 flex flex-col items-start gap-[3px] md:flex-row md:items-baseline md:justify-between">
        <h2 id={id} className="font-display text-lg font-bold text-navy">{title}</h2>
        {sub && <span className="text-base text-muted">{sub}</span>}
      </div>
      {children}
    </section>
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

/** *76%*, or *—* with its reason for a screen reader. */
export function Pct({ pct }: { pct: number | null }) {
  if (pct !== null) return <>{pctText(pct)}</>;
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{OWN_COPY.noRate}</span>
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
  return <div className={cn('min-w-0 rounded-lg border border-hairline bg-card', className)}>{children}</div>;
}
