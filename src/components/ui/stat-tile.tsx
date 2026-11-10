'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { LineIcon } from './line-icon';

/** One chip under a tile's number: *4 langsung*, *Unit 1/4* — its figure bold, as the mockup draws it. */
export interface StatChip {
  key: string;
  label: ReactNode;
}

/**
 * **The stat tile** (UI V1, UI-003 — the Unit Dashboard's four, and Home's, UI-100): a white tile of ~90px with no
 * border — a 12px label (13px on a phone, P19.8-T1 AC-4, MOB UI-168), its chips 12px, **one number** of 26px with its unit small and grey beside it, and one row of small chips
 * (*Unit* first, then *AAB*). Optional, each where a tile in the report has it:
 *
 * - **`badge`**, a corner figure (*54%*, *Produksi Group*) with **`bar`**, the share under the number, and **`sub`**, the
 *   line under the bar (*dari Rp 612,3 Jt*);
 * - **`ring`**, a 38px ring with its percentage inside (*Active Agent Oktober*, *Coaching 7 hari*);
 * - **`href`** makes **the whole tile the target**, with a small grey › top right (Home, D-09).
 *
 * The number stays on one line at 1024 and 1280 (UI-003): it never wraps, and its unit is what shrinks first. A chip
 * whose count is 0 is the caller's to leave out (UI-100). Every figure is the caller's, written with the shared
 * formatters; the ring's is the server's whole percentage.
 */
export function StatTile({
  label,
  value,
  unit,
  chips,
  badge,
  bar,
  sub,
  ring,
  href,
  fill = false,
  className,
}: {
  label: ReactNode;
  /** The number — or, on Home's *Aktivitas saya* with nothing today, the *+ Log* pill in its place. */
  value: ReactNode;
  /** Beside the number, small and grey: *agent*, *jt*, *dari 12*. */
  unit?: ReactNode;
  chips?: readonly StatChip[];
  /** Top right, a figure on a soft pill: *54%*. */
  badge?: ReactNode;
  /** A share, 0–100, drawn as a bar under the number. */
  bar?: number | null;
  /** The line under the bar: *dari Rp 612,3 Jt*. */
  sub?: ReactNode;
  /** A ring of 38px with its whole percentage inside; `null` draws the empty ring and *–*. */
  ring?: { percent: number | null };
  href?: string;
  /**
   * **The value takes the number row's free width** (P19.8-T2 AC-4; MOB UI-166: Home's *+ Log* across the tile, the
   * mockup's `.log{display:flex;justify-content:center}`): the value's box grows (`min-w-0 flex-1`), so a block child in
   * it — the *+ Log* pill — can be `w-full`. Off by default, and a tile without it is drawn as before.
   */
  fill?: boolean;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const figures = useFigureLanguage();
  const body = (
    <>
      <div className="flex items-start gap-2">
        {/* 13px on a phone (P19.8-T1 AC-4; MOB UI-168: *tile labels 13px*), 12px from 768px as before. */}
        <p data-stat-label="" className="min-w-0 flex-1 text-sm leading-snug text-muted max-md:text-base">{label}</p>
        {badge !== undefined && (
          <span className="shrink-0 rounded-pill bg-secondary/[0.08] px-2 text-sm font-semibold text-navy">{badge}</span>
        )}
        {href !== undefined && <LineIcon name="chevronRight" className="-mr-1 h-4 w-4 text-signal-grey" />}
      </div>
      <div className="mt-0.5 flex min-h-[2.375rem] items-center gap-1.5">
        <span className={cn('whitespace-nowrap text-[1.625rem] font-semibold leading-none tabular-nums text-ink', fill && 'min-w-0 flex-1')}>{value}</span>
        {unit !== undefined && <span className="min-w-0 truncate text-base text-signal-grey">{unit}</span>}
        {ring && (
          <span className="ml-auto shrink-0">
            <Ring percent={ring.percent} label={ring.percent === null ? '–' : formatPercent(ring.percent, {}, figures)} said={t.tile.ring} />
          </span>
        )}
      </div>
      {bar !== undefined && bar !== null && (
        <div className="mb-1 mt-0.5 h-1.5 overflow-hidden rounded-sm bg-base" aria-hidden="true">
          <div className="h-full rounded-sm bg-secondary" style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
      {sub !== undefined && <p className="text-sm text-signal-grey">{sub}</p>}
      {chips && chips.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li key={chip.key} className="rounded-pill bg-hover-row px-2 py-0.5 text-sm text-muted [&_b]:font-semibold [&_b]:text-ink">
              {chip.label}
            </li>
          ))}
        </ul>
      )}
    </>
  );
  const box = cn('block rounded-lg bg-card px-3 py-2.5', className);
  return href !== undefined
    ? <Link href={href} data-stat-tile="" className={cn(box, 'lg:hover:bg-hover-row')}>{body}</Link>
    : <div data-stat-tile="" className={box}>{body}</div>;
}

/** The ring: the share in the accent over a grey track, its figure inside. */
function Ring({ percent, label, said }: { percent: number | null; label: string; said: (v: { value: string }) => string }) {
  const r = 14;
  const length = 2 * Math.PI * r;
  const filled = percent === null ? 0 : (Math.min(100, Math.max(0, percent)) / 100) * length;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" role="img" aria-label={said({ value: label })}>
      <circle cx="19" cy="19" r={r} fill="none" strokeWidth="4" className="stroke-base" />
      {filled > 0 && (
        <circle
          cx="19" cy="19" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${filled} ${length}`} transform="rotate(-90 19 19)" className="stroke-primary"
        />
      )}
      <text x="19" y="23" textAnchor="middle" className="fill-ink text-[0.75rem] font-semibold">{label}</text>
    </svg>
  );
}
