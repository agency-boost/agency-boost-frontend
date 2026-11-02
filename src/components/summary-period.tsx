'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { SummaryView } from '@/components/personal-summary';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { summaryMessages } from '@/i18n/messages/summary';
import { cn } from '@/lib/cn';
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
 *   views of now, the pill is for looking back.
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

  /** A month or a year from the pill's sheet; the current one is no period at all. */
  const choose = (value: string, period: Summary['period']) => {
    if (view === 'month') go(value === period.thisMonth ? {} : { month: value });
    else go(value === period.thisMonth.slice(0, 4) ? {} : { year: value });
  };

  return { asked, view, chooseView, choose, key: periodSearch(asked) };
}

/**
 * **The page's one control row** (UI V1, UI-051): *Bulanan | Tahunan*, the month — or year — pill, and whatever the page
 * puts at its end (`/summary`'s 44px download button below 1024px). Under the title on every width; on a phone and a
 * tablet it is the only thing between the title and the goal card, so the card starts within the first 130px.
 *
 * - **The switch is two toggle buttons**, `aria-pressed` saying which is on, in a white pill with the chosen one navy
 *   (the mockup's): they change what the page shows, and control no panel of their own — the Unit Dashboard's period
 *   switch says the same. 44px tall below 1024px (UI-010).
 * - **The pill names the period on the page** and opens its sheet (`SummaryPeriodSheet`); no native select (UI-051).
 *   `frame` is the last Summary read, so the pill stays, and in reach of the keyboard, while the next period is read;
 *   `asked` says which is chosen meanwhile.
 *
 * Off the paper (`print:hidden`): on paper the period prints as a line instead (`SummaryCards`).
 */
export function SummaryPeriodBar({
  views, view, onView, frame, asked, onChoose, trailing,
}: {
  views: readonly { id: string; label: string }[];
  view: SummaryView;
  onView: (view: SummaryView) => void;
  frame: Summary;
  asked: SummaryPeriodQuery;
  onChoose: (value: string) => void;
  /** At the row's end, pushed right: `/summary`'s download button below 1024px. */
  trailing?: ReactNode;
}) {
  const t = useMessages(summaryMessages);
  return (
    <div data-summary-controls="" className="mb-4 flex items-center gap-1.5 print:hidden max-lg:mb-3">
      {/* Below 1024px the chosen one fills the white track's 44px, so the row is no taller than its targets (UI-010). */}
      <div role="group" aria-label={t.period} className="flex shrink-0 rounded-pill bg-card lg:p-[3px]">
        {views.map((option) => {
          const on = option.id === view;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onView(option.id as SummaryView)}
              className={cn(
                'whitespace-nowrap rounded-pill px-3 py-2 text-base font-semibold transition-colors max-lg:min-h-11 lg:px-3.5',
                on ? 'bg-navy text-white' : 'text-navy hover:bg-hover-row',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <SummaryPeriodPill view={view} frame={frame} asked={asked} onChoose={onChoose} />
      {trailing && <div className="ml-auto shrink-0">{trailing}</div>}
    </div>
  );
}

/**
 * **The month pill under *Monthly*, the year pill under *Yearly*** (P18.8-T11 AC-2; UI V1, UI-051): *Okt 2026 ⌄*, opening
 * a sheet of the office's months from its first to this one — or its years — newest first, the one on the page ticked.
 * A bottom sheet on a phone and a tablet, a centred modal on a desktop (`ResponsiveSheet`). Choosing closes it.
 *
 * Its name is the catalogue's (*Bulan* · *Tahun*) before the period it shows, so the words on it are in its name; each
 * month is written in the reader's figures' language (`useFigureLanguage()`): *Aug 2026*, *Agu 2026*.
 */
function SummaryPeriodPill({
  view, frame, asked, onChoose,
}: {
  view: SummaryView;
  frame: Summary;
  asked: SummaryPeriodQuery;
  onChoose: (value: string) => void;
}) {
  const t = useMessages(summaryMessages);
  const figures = useFigureLanguage();
  const [open, setOpen] = useState(false);
  const month = view === 'month';
  const name = month ? t.month : t.year;
  const options = month ? monthsOf(frame.period) : yearsOf(frame.period);
  const value = month ? (asked.month ?? frame.period.thisMonth) : (asked.year ?? frame.period.thisMonth.slice(0, 4));
  const label = (option: string) => (month ? formatMonth(option, figures) : option);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-1 rounded-pill bg-card px-3 py-2 text-base font-semibold text-navy hover:bg-hover-row max-lg:min-h-11"
      >
        <span className="sr-only">{name}: </span>
        <span className="truncate">{label(value)}</span>
        <LineIcon name="chevronDown" className="h-4 w-4" />
      </button>
      <ResponsiveSheet open={open} title={name} onClose={() => setOpen(false)}>
        <ul aria-label={name} className="-mx-1 pb-2">
          {options.map((option) => {
            const on = option === value;
            return (
              <li key={option}>
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false);
                    if (!on) onChoose(option);
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center justify-between gap-3 rounded-row px-3 text-left text-md text-navy hover:bg-hover-row',
                    on && 'font-bold',
                  )}
                >
                  {label(option)}
                  {on && <LineIcon name="check" className="h-5 w-5 text-navy" />}
                </button>
              </li>
            );
          })}
        </ul>
      </ResponsiveSheet>
    </>
  );
}
