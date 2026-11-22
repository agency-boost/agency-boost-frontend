'use client';

import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { formatMonthName, formatRupiahCompact } from '@/lib/format';
import type { OverviewProduction } from '@/lib/kpm-overview';
import { SectionHeading } from './usage-section';

/**
 * **6 · Produksi 6 bulan** (P19.19-T3 AC-1; the brief's §5, moved from KPM Analytics): a navy bar per month, its *"Rp x
 * Jt"* on top; **a month without an upload reads *"–"* over a grey stub** — never a zero — and the line under the chart
 * names them, *"Agu: belum diunggah · Nov: belum diunggah"*. The bars scale to the tallest month. A list for a screen
 * reader: each month and its figure.
 */
export function ProductionChart({ production }: { production: OverviewProduction }) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const top = Math.max(0, ...production.months.map((m) => m.apeMinor ?? 0));
  const missing = production.months.filter((m) => m.apeMinor === null).map((m) => formatMonthName(m.month, figures));
  return (
    <section aria-labelledby="overview-production" data-section="production">
      <SectionHeading id="overview-production">{t.productionTitle}</SectionHeading>
      <div className="rounded-lg bg-card px-3.5 pb-3 pt-4">
        <ol className="grid h-44 grid-cols-6 items-end gap-2">
          {production.months.map((m) => {
            const value = m.apeMinor === null ? '–' : formatRupiahCompact(m.apeMinor, {}, figures);
            const height = m.apeMinor === null || top === 0 ? 0 : Math.max(2, Math.round((m.apeMinor / top) * 100));
            const name = formatMonthName(m.month, figures);
            return (
              <li key={m.month} data-chart-month={m.month} aria-label={t.chartName({ month: name, value: m.apeMinor === null ? t.notUploaded : value })} className="flex h-full flex-col items-center justify-end">
                <span aria-hidden="true" className="mb-1 whitespace-nowrap text-xs font-bold text-ink">{value}</span>
                <span aria-hidden="true" className="flex h-[7.5rem] w-full max-w-12 items-end">
                  {m.apeMinor === null
                    ? <span data-stub="" className="block h-1 w-full rounded-sm bg-divider" />
                    : <span className="block w-full rounded-t-md bg-secondary" style={{ height: `${height}%` }} />}
                </span>
                <span aria-hidden="true" className="mt-1 text-sm text-muted">{name}</span>
              </li>
            );
          })}
        </ol>
        {missing.length > 0 && <p className="mt-2 text-sm text-muted">{missing.map((m) => t.notUploadedMonths({ months: m })).join(' · ')}</p>}
      </div>
    </section>
  );
}
