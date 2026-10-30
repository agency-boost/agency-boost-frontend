import type { ReactNode } from 'react';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { TermTip } from '@/components/ui/term-tip';
import { cn } from '@/lib/cn';
import type { SectionChip } from '@/lib/summary';
import type { TermKey } from '@/lib/terms';

/*
 * **The card the Summary and every coaching screen draw, on its own** (P18.98-T4, the bundle, 2026-10-29). `SummaryCard`
 * and `SectionChips` lived in `personal-summary.tsx`, so a coaching screen that drew one card loaded the whole Summary
 * with it — its cards, its catalogue in both languages and the campaigns' chasing card, about 17 kB — and three coaching
 * routes went past their 200 kB budget. Here they take only what they draw, and no words of their own:
 * `summary-card.spec.ts` keeps a coaching screen from importing the Summary for a card again.
 */

/**
 * The Summary's card: a titled `<section>` named by its heading, an icon, and a tag or a badge on the
 * right. The coaching session's cards are the same card (G-18), with no icon — the prototype's
 * session cards have none (`Overall.html:4186-4315`) — and, where the prototype puts one, a control or
 * a note on the right in place of the tag (`aside`).
 */
export function SummaryCard({
  id, title, term, icon, tag, badge, aside, className, children,
}: {
  id: string;
  /** The heading. A node where the prototype puts a link beside the words (*Activity → view full dashboard*). */
  title: ReactNode;
  /** A term the heading uses, whose ⓘ follows it (P18.95-T9 AC-3) — beside the heading, so its name stays the title. */
  term?: TermKey;
  icon?: NavIconName;
  tag?: ReactNode;
  badge?: string;
  /** On the right of the heading: the session's *+* buttons and the Goal card's hint. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const heading = (
    <h2 id={id} className="flex items-center gap-2 text-md font-bold text-navy">
      {icon && <NavIcon name={icon} className="h-[17px] w-[17px] text-navy-soft" />}
      {title}
    </h2>
  );
  return (
    <section aria-labelledby={id} className={cn('rounded-lg border border-card-edge bg-card px-[22px] py-[18px] print:break-inside-avoid', className)}>
      {/* Wraps rather than squeezes: on a phone a long tag drops under the title instead of folding it. */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        {term ? (
          <span className="flex items-center gap-1">
            {heading}
            <TermTip term={term} />
          </span>
        ) : heading}
        {tag && <span className="whitespace-nowrap rounded-pill bg-base px-2.5 py-0.5 text-2xs font-semibold text-muted">{tag}</span>}
        {badge && (
          <span className="whitespace-nowrap rounded-pill bg-navy px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-white">{badge}</span>
        )}
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The section chips under the three targets: **the office's summary tiles**, grouped by the server
 * (ADR-0064) — on the seed, the prototype's *Recruitment* and *Development* (`Overall.html:3164-3183`,
 * `:4240-4252`). The Summary's targets card and the coaching session's Activity card draw them with
 * this one component, so the two can never group or word them differently (I-140); `heading` is the
 * one thing that differs, *Recruitment activities* on the Summary and *Recruitment* in the session,
 * each its prototype's words, and each caller's own: the Summary's comes from its catalogue, in the reader's language
 * (*Aktivitas Recruitment*). The tile's label is the office's, as typed.
 */
export function SectionChips({
  sections, idPrefix, heading,
}: {
  sections: readonly SectionChip[];
  /** Ids for each chip's heading, unique on the page. */
  idPrefix: string;
  heading: (label: string) => string;
}) {
  if (sections.length === 0) return null;
  return (
    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
      {sections.map((section) => (
        <section key={section.code} aria-labelledby={`${idPrefix}-${section.code}`} className="rounded-[10px] border border-hairline bg-base px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-hairline pb-2">
            <h3 id={`${idPrefix}-${section.code}`} className="text-sm font-semibold text-navy">{heading(section.label)}</h3>
            <span className="font-body text-lg font-bold text-navy-soft">{section.total}</span>
          </div>
          <ul>
            {section.rows.map((row) => (
              <li key={row.code} className="flex items-baseline justify-between gap-3 py-0.5 text-xs text-muted">
                <span>{row.label}</span>
                <span className="font-body font-bold text-navy">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
