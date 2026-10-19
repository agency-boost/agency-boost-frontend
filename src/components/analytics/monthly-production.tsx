'use client';

import { cn } from '@/lib/cn';
import { formatMonth } from '@/lib/format';
import { chartBars, shortMonth, type MonthlyProduction } from '@/lib/kpm-analytics';

/**
 * *Monthly production* (`KPM_Owner.html:1253-1258`, `renderMonthlyChart` `:3425-3445`): six bars, the last
 * six months before this one, each the office's APE from its file.
 *
 * **Each value is in text**, above its bar, so the bars are a picture of figures the reader can already
 * read — the bars themselves are hidden from a screen reader, and each month is one item of a list named
 * by the section's heading. **A month with no file is a labelled gap** — *Not uploaded yet* over an empty
 * dashed outline where its bar would stand — never a zero bar (contradiction 19): a zero would read as a
 * month nobody sold anything.
 *
 * The prototype's colours, by age: the three oldest on the hairline grey, the next two amber, the latest
 * amber-dark (`:3431-3432`). Six full rupiah figures do not fit across a phone, so the chart keeps a width
 * that does and scrolls inside its card, never the page; the box is `relative` so the screen-reader months
 * are clipped by it.
 */
export function MonthlyProductionChart({ monthly, labelledBy }: { monthly: readonly MonthlyProduction[]; labelledBy: string }) {
  const bars = chartBars(monthly);
  return (
    <div className="rounded-lg border border-hairline bg-card">
      <div className="relative overflow-x-auto p-5">
        <ul aria-labelledby={labelledBy} className="flex min-w-[620px] items-end gap-3.5">
          {bars.map((bar, i) => (
            <li key={bar.month} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={cn('whitespace-nowrap text-2xs', bar.height === null ? 'italic text-muted' : 'font-semibold text-navy')}>
                <span className="sr-only">{formatMonth(bar.month)}: </span>
                {bar.value}
              </span>
              <span aria-hidden="true" className="flex h-[100px] w-full items-end">
                {bar.height === null ? (
                  // The gap: an outline where the bar would stand, empty.
                  <span className="h-full w-full rounded-t-[6px] border border-dashed border-hairline" />
                ) : (
                  <span
                    className={cn('w-full rounded-t-[6px]', i < 3 ? 'bg-hairline' : i < bars.length - 1 ? 'bg-amber' : 'bg-amber-dark')}
                    style={{ height: `${bar.height}%` }}
                  />
                )}
              </span>
              <span aria-hidden="true" className="text-xs text-muted">{shortMonth(bar.month)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
