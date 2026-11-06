import { Children, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * **The tablet and laptop system's columns** (P19.1-T1 AC-2, AC-3, ADR-0196; UI-113: *tablet is a stretched phone*,
 * UI-114: *multi-column layouts break between 1024 and ~1300px*). Built once here and used by the pages, as
 * `shared-2026-11-02.css` asks (UI-112): the phone's own cards and rows, laid out in more columns — never a component
 * of the wider sizes' own.
 *
 * **Markup only**: no hook and no `'use client'`, so a screen of either kind can draw them. **A phone is unchanged**
 * (< 768px, out of every 2 November ticket's scope): each helper's columns start at 768px, and below it the children lie
 * as they would with no wrapper at all.
 */

/**
 * **Two columns from 768px, filled top to bottom** (UI-113: Activity's five groups, `activity-tablet-desktop`): the
 * children in reading order down the first column and then the second, each kept whole — a card is never split across
 * the two — and the columns balanced by height, so neither ends far below the other. The order a screen reader reads is
 * the order an eye reads, column by column.
 *
 * Each child is wrapped once, so the gap under it is padding — a margin at a column's top or foot is cut by the browser,
 * and the two columns' first cards would not line up. Below 768px the wrappers carry nothing.
 */
export function ColumnFlow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-column-flow="" className={cn('md:columns-2 md:gap-3', className)}>
      {Children.map(children, (child) => (child === null || child === undefined || child === false
        ? null
        : <div className="md:break-inside-avoid md:pb-3">{child}</div>))}
    </div>
  );
}

/**
 * **As many columns as keep their minimum width, and one below it** (UI-114: *a column layout only switches on when
 * every column keeps its minimum width; below that it stacks* — its own suggestion, `repeat(auto-fit, minmax(…, 1fr))`).
 * `min` is a column's narrowest in px: at 1024px beside the 64px rail a 360px column fits twice, at 768px a 384px one
 * does not. A phone (< 768px) is one column: `minColumns` starts the grid at 768px, and below it the children stack as
 * blocks with the gap between them.
 *
 * Use it for a row of cards or tiles that must never squeeze a label onto three lines or a value onto two; a layout the
 * mockups fix — two columns, so many pixels — says so with its own classes.
 */
export function FitColumns({
  min,
  children,
  className,
}: {
  /** A column's minimum width, in px. */
  min: number;
  children: ReactNode;
  className?: string;
}) {
  const style = { '--fit-column-min': `${min}px` } as CSSProperties;
  return (
    <div
      data-fit-columns=""
      style={style}
      className={cn(
        'flex flex-col gap-3 md:grid md:grid-cols-[repeat(auto-fit,minmax(min(100%,var(--fit-column-min)),1fr))] md:items-start',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * **A row that pairs a label with its value is at most 480px wide** (UI-113: on a tablet the Ratio card's values sat
 * ~700px from their labels). On the row, or on the card that holds such rows; from 768px only, a phone being narrower.
 */
export const PAIRED_ROW = 'md:max-w-[480px]';
