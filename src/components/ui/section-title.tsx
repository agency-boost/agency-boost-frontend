import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SECTION_TITLE } from './header-control';

/**
 * **A section's title: 14px, 700, in ink, on every page** (P19.8-T1 AC-3; R6, D-38; ADR-0227 §4; MOB UI-185). Home's
 * *Aksi hari ini* is the reference; *Laporan aktivitas tim*, *Aktivitas 7 hari terakhir*, the Unit Dashboard's *Roster
 * tim Anda* (16px / 600 until P19.8-T4) and the ratio card's *Ratio · 30 hari terakhir* take it.
 *
 * A heading, `h2` unless a page's outline needs another level. **No margin of its own**: where it sits is its section's.
 * On a card filled with the secondary colour the caller passes the contrast text (`className="text-secondary-contrast"`),
 * which wins over the ink.
 *
 * The class alone is `SECTION_TITLE` (`header-control.ts`), for a title drawn inside a control — a summary, a
 * disclosure's button — where a heading element would not be allowed.
 */
export function SectionTitle({
  as: Tag = 'h2',
  id,
  className,
  children,
}: {
  as?: 'h2' | 'h3' | 'h4';
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} data-section-title="" className={cn(SECTION_TITLE, className)}>
      {children}
    </Tag>
  );
}

/**
 * **The title's row**: the title on the left, and on its right what the section's design puts there — *Semua ›*, a
 * count, a picker — on one line, 32px tall at least, 8px above the section's content (Home's `SectionHeading`, the
 * reference).
 */
export function SectionHead({
  id,
  title,
  as,
  className,
  children,
}: {
  /** The heading's id, for the section's `aria-labelledby`. */
  id?: string;
  title: ReactNode;
  as?: 'h2' | 'h3' | 'h4';
  className?: string;
  /** Right of the title. */
  children?: ReactNode;
}) {
  return (
    <div className={cn('mb-2 flex min-h-8 items-center justify-between gap-2', className)}>
      <SectionTitle id={id} as={as}>{title}</SectionTitle>
      {children}
    </div>
  );
}
