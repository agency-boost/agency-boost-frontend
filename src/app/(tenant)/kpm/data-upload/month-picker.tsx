'use client';

import { FilterChips } from '@/components/ui/list-rows';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { cn } from '@/lib/cn';
import { formatMonth, formatMonthName } from '@/lib/format';
import type { MonthStatus } from '@/lib/production';

/** Every `YYYY` from the history's first year to the office's current one. */
export function yearsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y += 1) out.push(String(y));
  return out;
}

/** The months of `year` offered: January to December, never past the office's current month. */
export function monthsOf(year: string, current: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= current);
}

/**
 * **Pilih bulan** (P19.21-T1 AC-1; frames 1–3): no month dropdown — a year switch from the required history's first year
 * (*2024*, ADR-0274 §3) to this one, and that year's months as chips: **green ✓ uploaded, red missing, the selected one
 * navy**. Any month can be opened, older ones included, never one after this month. Under them, how many of the year's
 * months are missing, and the colours' meaning, in one line.
 *
 * A chip says its state in words too (`aria-label`), so the colour is never the only cue (WCAG 1.4.1).
 */
export function MonthPicker({
  year, month, current, historyFrom, months, onYear, onMonth,
}: {
  year: string;
  month: string;
  /** The office's current month, `YYYY-MM`. */
  current: string;
  /** The required history's first month (`config.historyFrom`). */
  historyFrom: string;
  /** The month grid the month read answers (`MonthView.months`). */
  months: readonly MonthStatus[];
  onYear: (year: string) => void;
  onMonth: (month: string) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  const status = new Map(months.map((m) => [m.month, m.status]));
  const shown = monthsOf(year, current);
  const uploaded = (m: string) => (status.get(m) ?? 'missing') !== 'missing';
  const missing = shown.filter((m) => m >= historyFrom && !uploaded(m)).length;

  return (
    <section data-month-picker="" className="rounded-lg bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 text-md font-bold text-navy">{t.pickMonth}</h2>
        <FilterChips
          label={t.yearsLabel}
          chips={yearsBetween(historyFrom, current).map((y) => ({ key: y, label: y }))}
          active={year}
          onSelect={onYear}
          className="rounded-pill border border-line bg-card p-0.5"
        />
      </div>
      <div
        role="group"
        aria-label={t.monthsOf({ year })}
        className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12"
      >
        {shown.map((m) => {
          const selected = m === month;
          const done = uploaded(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              aria-label={`${formatMonth(m, figures)}, ${done ? t.monthUploaded : t.monthMissing}`}
              data-month={m}
              data-uploaded={done ? '' : undefined}
              onClick={() => onMonth(m)}
              className={cn(
                'flex min-h-11 items-center justify-center gap-1 rounded-md text-base font-semibold lg:min-h-9',
                selected
                  ? 'bg-secondary text-secondary-contrast ring-2 ring-secondary ring-offset-2 ring-offset-card'
                  : done ? 'bg-pill-green text-pill-green-ink' : 'bg-pill-red text-pill-red-ink',
              )}
            >
              {done && <LineIcon name="check" className="h-3.5 w-3.5 shrink-0" />}
              {formatMonthName(m, figures)}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted">
        {t.missingLine({ count: missing, year, since: formatMonth(historyFrom, figures) })}
      </p>
    </section>
  );
}
