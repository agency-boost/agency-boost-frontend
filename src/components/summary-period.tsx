'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { SummaryView } from '@/components/personal-summary';
import { Select } from '@/components/ui/field';
import { formatMonth } from '@/lib/format';
import {
  monthsOf, periodSearch, yearsOf, type Summary, type SummaryPeriodQuery,
} from '@/lib/summary';

/**
 * **Which period a Summary page shows, kept in its address** (P18.8-T11, ADR-0161 §4) — `/summary` and a coachee's
 * *Personal Summary* tab alike, so a refresh, a link or Back keeps it.
 *
 * - **The view follows the address**: `?year=` opens on *Yearly*, `?month=` on *Monthly*, neither on *Monthly*.
 * - **Choosing a month or a year** replaces the address — `?month=2026-08`, `?year=2025` — and the current one
 *   clears it, so this month's page is the plain address it always was.
 * - **Switching between *Monthly* and *Yearly*** goes back to the current month or year: the switch is the two
 *   views of now, the selects are for looking back.
 *
 * Replaced rather than pushed, as the catalog's filters are: Back leaves the page rather than stepping through
 * every month looked at.
 */
export function useSummaryPeriod(address: SummaryPeriodQuery) {
  const router = useRouter();
  const pathname = usePathname();
  const [asked, setAsked] = useState<SummaryPeriodQuery>(address);
  const [view, setView] = useState<SummaryView>(address.year ? 'year' : 'month');

  // The address moving under the page — Back, a link — moves the page with it.
  useEffect(() => {
    setAsked(address.month ? { month: address.month } : address.year ? { year: address.year } : {});
    if (address.year) setView('year');
    else if (address.month) setView('month');
  }, [address.month, address.year]);

  const go = (next: SummaryPeriodQuery) => {
    setAsked(next);
    router.replace(`${pathname}${periodSearch(next)}`, { scroll: false });
  };

  /** *Monthly* or *Yearly*: that view of now. */
  const chooseView = (next: SummaryView) => {
    setView(next);
    if (asked.month || asked.year) go({});
  };

  /** A month or a year from the select; the current one is no period at all. */
  const choose = (value: string, period: Summary['period']) => {
    if (view === 'month') go(value === period.thisMonth ? {} : { month: value });
    else go(value === period.thisMonth.slice(0, 4) ? {} : { year: value });
  };

  return { asked, view, chooseView, choose, key: periodSearch(asked) };
}

/**
 * **The month select under *Monthly*, the year select under *Yearly*** (P18.8-T11 AC-2): the office's months from
 * its first to this one, or its years, newest first, the one on the page chosen. It stands where the page names
 * its period, and on paper that name prints instead (`SummaryCards`).
 *
 * `frame` is the last Summary read, so the choices stay on the screen, and in reach of the keyboard, while the
 * next period is read; `asked` says which is chosen meanwhile. Named by `aria-label` (ADR-0062, the smallest
 * footprint): the prototype prints its period as a line, with no label beside it.
 */
export function SummaryPeriodSelect({
  view, frame, asked, onChoose,
}: {
  view: SummaryView;
  frame: Summary;
  asked: SummaryPeriodQuery;
  onChoose: (value: string) => void;
}) {
  const month = view === 'month';
  const options = month ? monthsOf(frame.period) : yearsOf(frame.period);
  const value = month ? (asked.month ?? frame.period.thisMonth) : (asked.year ?? frame.period.thisMonth.slice(0, 4));
  return (
    <Select
      aria-label={month ? 'Month' : 'Year'}
      value={value}
      onChange={(e) => onChoose(e.target.value)}
      className="mb-3 min-w-44 print:hidden"
    >
      {options.map((option) => (
        <option key={option} value={option}>{month ? formatMonth(option) : option}</option>
      ))}
    </Select>
  );
}
