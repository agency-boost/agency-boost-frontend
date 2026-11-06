'use client';

import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { cn } from '@/lib/cn';
import { formatMonth, formatRupiahCompact } from '@/lib/format';
import { shortMonth, type MonthlyProduction } from '@/lib/kpm-analytics';

/**
 * ***Monthly production*** (UI-091, UI-109; P19.3-T3 AC-7; `kpm-mobile` 2, `kpm-desktop-2026-10-30` 1): six bars **ending
 * with the current month**, each that month's office APE from the upload, at every size.
 *
 * - **One bar colour, the current month in the accent** (`bg-amber`, a token) — where the prototype painted the months
 *   by age in four colours with no stated meaning.
 * - **A month with no upload is a hatched bar and *–***, never a zero bar: a zero would read as a month nobody sold.
 * - **No footnote** (D-35: the owner removed it). **It fits 375px without scrolling sideways**: six columns that share
 *   the card's width, each sum without its currency mark (*462 jt*), the mark being the section's.
 * - **A list for a screen reader**: each month by name and its sum, or *not uploaded*. The bars are hidden from it.
 */
export function MonthlyProductionChart({ monthly, labelledBy }: { monthly: readonly MonthlyProduction[]; labelledBy: string }) {
  const t = useMessages(kpmAnalyticsMessages);
  const figures = useFigureLanguage();
  const top = Math.max(0, ...monthly.map((m) => m.apeMinor ?? 0));
  const last = monthly.length - 1;
  const columns = { gridTemplateColumns: `repeat(${Math.max(1, monthly.length)}, minmax(0, 1fr))` };
  return (
    <div className="rounded-lg bg-card p-3 lg:p-4" data-monthly-chart="">
      <ul aria-labelledby={labelledBy} className="grid h-[120px] items-end" style={columns}>
        {monthly.map((m, i) => {
          const none = m.apeMinor === null;
          // In px under the value's line: the tallest month 88px, a month with no upload a 20px hatched stub.
          const height = none ? 20 : top > 0 ? Math.max(4, Math.round(((m.apeMinor ?? 0) / top) * 88)) : 4;
          const value = none ? '–' : formatRupiahCompact(m.apeMinor!, {}, figures).replace(/^(Rp|IDR)\s/, '');
          return (
            <li key={m.month} className="flex h-full min-w-0 flex-col items-center justify-end">
              <span className="sr-only">{formatMonth(m.month, figures)}: {none ? t.v1.noData : formatRupiahCompact(m.apeMinor!, {}, figures)}</span>
              <span aria-hidden="true" className={cn('whitespace-nowrap text-xs font-semibold tabular-nums', none ? 'text-signal-grey' : 'text-pill-grey-ink')}>{value}</span>
              <span
                aria-hidden="true"
                data-bar={none ? 'none' : i === last ? 'current' : 'month'}
                className={cn(
                  'mt-1 block w-7 rounded-b-[3px] rounded-t-[6px] lg:w-10',
                  none
                    ? 'border border-dashed border-signal-grey bg-[repeating-linear-gradient(45deg,var(--color-base)_0_4px,var(--color-card)_4px_8px)]'
                    : i === last ? 'bg-primary' : 'bg-line',
                )}
                style={{ height: `${height}px` }}
              />
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="mt-1.5 grid border-t border-divider pt-1.5 text-center text-xs text-muted" style={columns}>
        {monthly.map((m) => <span key={m.month}>{shortMonth(m.month, figures)}</span>)}
      </div>
    </div>
  );
}
