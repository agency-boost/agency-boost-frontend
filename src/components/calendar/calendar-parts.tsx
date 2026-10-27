'use client';

import type { ReactNode } from 'react';
import { ENTRY_TYPES, TYPE_LABEL, type EntryType } from '@/lib/calendar';
import { cn } from '@/lib/cn';

/**
 * The calendar's small shared pieces: the type colours, the avatar and the legend
 * (`Calendar_Section.html:90-93`, `:136-143`, `:168-172`, `:219-224`, `:309-315`).
 *
 * **Every colour is a token** (H-19). The prototype's `--teal` is now `teal` in `globals.css`, and each
 * pair that failed contrast takes one that passes: today's number is amber-ink, the *Coaching* badge's
 * words are navy, a trip's words are teal-ink. `a11y.spec.tsx` pins each pair.
 */

/** An entry block's tint and its 3px left border (`:139-143`). Words on it are navy. */
export const ENTRY_TONE: Record<EntryType, string> = {
  meeting: 'border-navy-soft bg-navy-soft/[0.12]',
  coaching: 'border-amber-dark bg-amber/[0.18]',
  client: 'border-alert bg-alert/10',
  task: 'border-success bg-success/10',
  travel: 'border-teal bg-teal/[0.12]',
};

/** The legend's swatch (`:310-314`). */
export const TYPE_SWATCH: Record<EntryType, string> = {
  meeting: 'bg-navy-soft',
  coaching: 'bg-amber-dark',
  client: 'bg-alert',
  task: 'bg-success',
  travel: 'bg-teal',
};

/**
 * The detail's badge (`:219-224`). *Coaching* is navy on its tint where the prototype's amber-dark is
 * 2.61:1, and *Travel* teal-ink where its teal is 4.20:1 (H-19).
 */
export const BADGE_TONE: Record<EntryType, string> = {
  meeting: 'bg-navy-soft/[0.14] text-navy-soft',
  coaching: 'bg-amber/[0.18] text-navy',
  client: 'bg-alert/[0.12] text-alert',
  task: 'bg-success/[0.12] text-success',
  travel: 'bg-teal/[0.14] text-teal-ink',
};

/** A month line's left border (`:170-172`), and Travel's, which the prototype's month never drew. */
export const MONTH_BORDER: Record<EntryType, string> = {
  meeting: 'border-navy-soft',
  coaching: 'border-amber-dark',
  client: 'border-alert',
  task: 'border-success',
  travel: 'border-teal',
};

const AVATAR_SIZE = {
  /** The pane head's (`:103`). */
  md: 'h-[26px] w-[26px] text-2xs',
  /** A chip's, a popover row's, the invite note's (`:69`, `:83`, `:196`, `:229`). */
  sm: 'h-5 w-5 text-2xs',
} as const;

/**
 * Initials in a circle. **Decoration**: the name beside it says who, so it is hidden from assistive
 * technology. The reader's own is amber with **navy** initials, as the sidebar's chip is: the
 * prototype's white on amber is 2.23:1 (I-88).
 */
export function Avatar({
  initials,
  me = false,
  size = 'sm',
  className,
}: {
  initials: string;
  me?: boolean;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        AVATAR_SIZE[size],
        me ? 'bg-amber text-navy' : 'bg-navy-soft text-white',
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Who a pane is: the reader, or a member compared beside them (`:320-324`, `:974-979`). */
export interface PaneHead {
  name: string;
  initials: string;
  role: string;
  me: boolean;
}

/**
 * A pane's head (`:320-324`, `:974-979`): the avatar, the name, the rung, and a compared pane's
 * *"Drag to block"* pill. **One head for every view** — the week's pane, and since P18.95-T8 AC-2 a
 * month and an agenda drawn beside somebody compared — so a person reads the same in all three.
 */
export function PaneHeadBar({ head, pill }: { head: PaneHead; pill?: ReactNode }) {
  return (
    <div className="flex items-center gap-[9px] border-b border-hairline bg-base px-3.5 py-[11px]">
      <Avatar initials={head.initials} me={head.me} size="md" />
      <div className="min-w-0">
        <p className="truncate text-md font-bold text-navy">{head.name}</p>
        <p className="truncate text-xs text-muted">{head.role}</p>
      </div>
      {pill}
    </div>
  );
}

/** The five swatches, in the legend's order (`:309-315`). */
export function TypeLegend() {
  return (
    <ul className="mb-4 flex flex-wrap gap-4 text-sm text-muted">
      {ENTRY_TYPES.map((type) => (
        <li key={type} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', TYPE_SWATCH[type])} />
          {TYPE_LABEL[type]}
        </li>
      ))}
    </ul>
  );
}

/** A chip — the compare bar's, the invite field's, the detail's (`:68-72`, `:200-204`, `:229`). */
export const CHIP = 'inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-base py-1 pl-1 pr-2.5 text-sm font-semibold text-navy';

/** The detail dialog's and the entry dialog's small uppercase labels (`:226`, `:181`). */
export const DETAIL_LABEL = 'mb-1 block text-xs font-bold uppercase tracking-[0.04em] text-muted';
