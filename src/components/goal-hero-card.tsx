'use client';

import type { ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

/** One half of the card's foot: *Sisa bulan ini* · *Rp 65,7 jt*. */
export interface GoalHeroFact {
  label: ReactNode;
  value: ReactNode;
}

/**
 * **The goal hero card** (UI V1, UI-054 — Personal Summary's *Target vs. realisasi (APE)*): one orange card, 16px
 * corners — the title and a **% badge**; the achieved figure large (*Rp 29 jt*) and the target beside it (*dari target
 * Rp 94,7 jt*); the bar; and a **foot split in two** by a thin divider (*Sisa bulan ini* | *Polis yang dibutuhkan*),
 * 12px labels over 20px/700 values. No *Kurang 4 polis · 1 minggu lagi* line, no week count (UI-054).
 *
 * - **Navy words on the accent** (5.9:1) rather than the mockup's white (2.38:1, under AA at every size); the bar is
 *   navy on a light track for the same reason. Registered in `prototype-parity.md`.
 * - **`percent`** is the server's whole percentage (UI-080), written in the badge and drawn as the bar (capped at the
 *   full width); `null` — no target — draws *–* and an empty bar.
 * - **`aside`** holds Boost celebrating when the goal is hit (UI-102: *goal ≥ 100% on /summary*), the page's to decide.
 *
 * The date header above the card (*30 Okt 2026 · sisa 1 hari bulan ini*) is the page's, outside the card (UI-054).
 */
export function GoalHeroCard({
  title,
  percent,
  achieved,
  target,
  facts,
  aside,
  className,
}: {
  /** *Target vs. realisasi (APE)*. */
  title: ReactNode;
  percent: number | null;
  /** *Rp 29 jt*. */
  achieved: ReactNode;
  /** *dari target Rp 94,7 jt*. */
  target?: ReactNode;
  /** The foot: two facts, side by side. */
  facts?: readonly [GoalHeroFact, GoalHeroFact];
  aside?: ReactNode;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const figures = useFigureLanguage();
  const shown = percent === null ? '–' : formatPercent(percent, {}, figures);
  const width = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <section data-goal-hero="" className={cn('rounded-lg bg-amber p-3.5 text-navy', className)}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-base font-semibold">{title}</p>
        <span className="shrink-0 rounded-pill bg-card px-2 py-0.5 text-sm font-bold text-amber-ink">{shown}</span>
      </div>
      <div className="flex items-end gap-3">
        <p className="mb-2 mt-1 min-w-0 flex-1">
          <span className="text-[1.875rem] font-extrabold leading-tight tabular-nums">{achieved}</span>
          {target !== undefined && <> <span className="text-base">{target}</span></>}
        </p>
        {aside}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={t.goal.progress({ value: shown })}
        aria-label={t.goal.progress({ value: shown })}
        className="h-2 overflow-hidden rounded-sm bg-card/50"
      >
        <div className="h-full rounded-sm bg-navy" style={{ width: `${width}%` }} />
      </div>
      {facts && (
        <dl className="mt-3 grid grid-cols-2 border-t border-navy/20 pt-2.5">
          {facts.map((fact, i) => (
            <div key={i} className={cn(i === 1 && 'border-l border-navy/20 pl-3')}>
              <dt className="text-sm">{fact.label}</dt>
              <dd className="text-2xl font-bold tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
