import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * **Where every floating bar stands**, below 1024px: 12px from either side, and 12px above the tab bar where the field
 * shell draws one (`--tab-bar-space`, which already counts the home indicator) — above the home indicator where it does
 * not. Over the page it floats above, under the tab bar (`z-40`), every sheet and dialog (`z-50`) and the toast (`z-[60]`).
 */
const PLACE = 'fixed inset-x-3 bottom-[max(calc(var(--tab-bar-space)+0.75rem),calc(env(safe-area-inset-bottom)+0.75rem))] '
  + 'z-[9] flex flex-col gap-2';

/**
 * **The pill** (UI-015, the Goal Setting save the owner chose as the model): white, round-ended, the modal's shadow, 16px
 * of room before its words and 6px round its button, so a 44px button makes it 56px tall.
 */
export const FLOATING_BAR_PILL = 'flex items-center gap-3 rounded-pill bg-card py-1.5 pl-4 pr-1.5 shadow-modal';

/** **What the bar has to say above its pill** — a refusal, a failure — in a card of its own, the pill unmoved under it. */
const NOTE = 'flex flex-col gap-2 rounded-lg bg-card px-4 py-3 shadow-modal';

/** **The pill's button**: the accent, 44px, round-ended, its words navy and bold (I-542). */
export const FLOATING_BAR_BUTTON = 'min-h-11 shrink-0 rounded-pill bg-amber px-5 text-md font-bold text-navy '
  + 'hover:bg-amber-dark disabled:cursor-not-allowed disabled:opacity-40';

/**
 * **The room a page leaves under its last line while a floating bar stands over its foot** (below 1024px): 96px, more
 * than the pill's 56px and its 12px, so nothing a reader has to see ends behind it. One class for every such page.
 */
export const FLOATING_BAR_ROOM = 'max-lg:pb-24';

/** **From 1024px**: the bar goes (the page has its own place for the same controls), or stands in the page as a card. */
const WIDE = {
  hidden: { bar: 'lg:hidden', note: '', pill: '' },
  card: {
    bar: 'lg:static lg:z-auto lg:gap-0 lg:rounded-lg lg:border lg:border-card-edge lg:bg-card lg:p-3.5',
    note: 'lg:mb-2 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none',
    pill: 'lg:flex-wrap lg:gap-y-2.5 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none',
  },
} as const;

/**
 * **The floating bar — one form for every bar held over a phone's or a tablet's page** (UI V1; the product owner's
 * staging review, 2026-10-31: *"semua floating tambahan itu bisa buat modelan kayak goal setting gini"*). Goal Setting's
 * save pill, Activity's save on a phone and the coaching session's *Finalkan* all stand here, in the same pill, rather
 * than in a full-width square strip with a rule above it.
 *
 * - **Its children are the pill's content**: what the bar says on the left (`min-w-0 flex-1`), its button or buttons
 *   on the right (`FLOATING_BAR_BUTTON` for the accent one).
 * - **`note`**, when there is something to say above it, is a card of its own over the pill. The pill keeps its place
 *   in the tree whether a note is there or not, so a button pressed never loses the focus to a note appearing.
 * - **`wide`**: from 1024px the bar is `hidden` (the default) or a `card` standing where the page puts it.
 *
 * `data-floating-bar` marks it, and lifts the shell's toast above it (`toast.tsx`). A page that draws one leaves
 * `FLOATING_BAR_ROOM` under its last line. Any other attribute (a `data-*` of the page's own) lands on the bar.
 */
export function FloatingBar({
  note,
  wide = 'hidden',
  className,
  pillClassName,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** A card above the pill: a refusal, a failure. Nothing, and nothing is drawn. */
  note?: ReactNode;
  wide?: keyof typeof WIDE;
  /** Added to the pill, after its own classes. */
  pillClassName?: string;
  children: ReactNode;
}) {
  const at = WIDE[wide];
  return (
    <div {...rest} data-floating-bar="" className={cn(PLACE, at.bar, className)}>
      {note ? <div data-floating-bar-note="" className={cn(NOTE, at.note)}>{note}</div> : null}
      <div data-floating-bar-pill="" className={cn(FLOATING_BAR_PILL, at.pill, pillClassName)}>
        {children}
      </div>
    </div>
  );
}
