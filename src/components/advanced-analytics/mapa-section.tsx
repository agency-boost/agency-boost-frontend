'use client';

import { Fragment, useEffect, useId, useState } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  monthsBetween, readMapa, type Mapa, type MapaGroup, type MapaHeadline, type MapaRow, type MapaUnit,
} from '@/lib/advanced-analytics-page';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatMonth, formatMonthName, formatNumber, formatPercent, formatRupiahCompact, toMajor } from '@/lib/format';
import { BlockTitle, ChangeText, MonthPicker, NoData, ProgressBar, SectionError, SectionLoading, TabControls } from './shared';

/** Rupiah in a *juta*: what the table's money rows are written in — *APE (Rp jt)*, *Nilai rata-rata polis (Rp jt)*. */
const RUPIAH_PER_JUTA = 1_000_000;

/** A MAPA figure as its row writes it: money in *jt*, a count whole or to a tenth, a share whole, a ratio to a tenth. */
export function mapaFigure(row: Pick<MapaRow, 'key' | 'unit'>, value: number | null, language: Language): string {
  if (value === null) return '–';
  const unit: MapaUnit = row.unit;
  if (unit === 'idr_minor') return formatNumber(toMajor(value) / RUPIAH_PER_JUTA, { maxDecimals: row.key === 'ape' ? 0 : 1 }, language);
  if (unit === 'percentage') return formatPercent(value, {}, language);
  return formatNumber(value, { maxDecimals: 1 }, language);
}

/** A month as a column head names it: *Okt '26*. */
const monthHead = (month: string, language: Language) => `${formatMonthName(month, language)} '${month.slice(2, 4)}`;

/** The month a month before, `YYYY-MM`. */
const monthBefore = (month: string, by: number) => {
  const i = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 - by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};

const GROUP_ORDER: MapaGroup[] = ['ape', 'manpower', 'activation', 'productivity', 'case_size'];

/**
 * ***MAPA driver*** (P19.22-T3; ADR-0275 §3; the approved `advanced-analytics-*` frames 5–9): the month picker and
 * *Diperbarui {day} · data sampai {Bul}*; the orange **Bulan ini vs target** — APE, Active Agent, Rekrut, each a bar
 * coloured by its progress; then **one table**: APE alone, then **M** Manpower (*Manpower*, *Rekrut*), **A** Activation
 * (*Active Agent*, *% agent baru aktif dalam 3 bulan*), **P** Productivity (*Polis terbit*, *Polis per Active Agent*),
 * **A** Average case size (*Nilai rata-rata polis*). Columns: *YTD last year · YTD this year · change*, then *Bulan sama
 * tahun lalu ⌄* (or *Bulan lalu*) *· Bulan ini · change*, then *Target bulanan*, read-only — the AB groups' targets and
 * Goal Setting ÷ 12, never typed here. A percentage changes in *poin*. **On a phone the table scrolls sideways inside its
 * card**, the metric column fixed; APE's tile spans the width, Active Agent and Rekrut side by side.
 *
 * **The forum shows it as it is** (P19.22-T8, ADR-0276): `components/leader-forum/forum-screen.tsx` imports this, with
 * the same data, controls and taps. `canUpload` only adds *Unggah data* to the empty state.
 */
export function MapaSection({ platformKpmId, canUpload = false }: { platformKpmId?: string; canUpload?: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const m = t.mapa;
  const language = useFigureLanguage();
  const monthId = useId();
  const compareId = useId();
  const tableId = useId();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [compare, setCompare] = useState<'sameMonth' | 'lastMonth'>('sameMonth');
  const [view, setView] = useState<Mapa | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    readMapa({ month }, platformKpmId)
      .then((answer) => { if (live) setView(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [month, platformKpmId]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const year = view.month.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  const versus = compare === 'sameMonth' ? monthBefore(view.month, 12) : monthBefore(view.month, 1);
  const empty = view.rows.every((r) => r.thisMonth === null && r.ytd === null);
  const note = view.asOf && view.dataThrough
    ? m.updated({ date: formatCalendarDay(view.asOf, language), month: formatMonth(view.dataThrough, language) })
    : view.dataThrough ? m.dataThrough({ month: formatMonth(view.dataThrough, language) }) : undefined;

  const tile = (label: string, head: MapaHeadline, money: boolean, className?: string) => {
    const value = head.value === null ? '–' : money ? formatRupiahCompact(head.value, {}, language) : formatNumber(head.value, {}, language);
    const target = head.target === null ? null : money ? formatRupiahCompact(head.target, {}, language) : formatNumber(head.target, {}, language);
    return (
      <div className={cn('rounded-row bg-card p-3', className)} data-headline={label}>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-2xl font-extrabold tabular-nums text-navy">{value}</p>
        <p className="mb-1.5 text-sm text-muted">
          {target === null ? m.noTarget : m.target({ value: target, pct: head.pct === null ? '–' : formatPercent(head.pct, {}, language) })}
        </p>
        <ProgressBar pct={head.pct} tone={head.tone} />
      </div>
    );
  };

  return (
    <div data-section="mapa">
      <TabControls note={note}>
        <MonthPicker
          id={monthId}
          label={t.filters.month}
          months={monthsBetween(view.earliestMonth, view.currentMonth)}
          value={view.month}
          onChange={setMonth}
          format={(x) => formatMonth(x, language)}
        />
      </TabControls>

      <section aria-labelledby={`${monthId}-headline`} className="mb-5 rounded-card bg-primary p-4">
        <h2 id={`${monthId}-headline`} className="mb-3 font-bold text-navy">{m.headline}</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {tile(m.headlines.ape, view.headline.ape, true, 'col-span-2 md:col-span-1')}
          {tile(m.headlines.activeAgent, view.headline.activeAgent, false)}
          {tile(m.headlines.rekrut, view.headline.rekrut, false)}
        </div>
      </section>

      <section aria-labelledby={tableId}>
        <BlockTitle id={tableId}>{m.table}</BlockTitle>
        <div className="overflow-x-auto rounded-card bg-card">
          <table className="relative w-full min-w-[44rem] border-collapse text-left text-sm">
            <caption className="sr-only">{m.table}</caption>
            <thead className="text-xs font-semibold text-muted">
              <tr className="border-b border-divider align-bottom">
                <th scope="col" className="sticky left-0 z-[1] min-w-[12rem] bg-card px-3 py-2">{m.metric}</th>
                <th scope="col" className="px-2 py-2 text-right">{m.ytd({ year: lastYear })}</th>
                <th scope="col" className="px-2 py-2 text-right">{m.ytd({ year })}</th>
                <th scope="col" className="px-2 py-2 text-right"><span className="sr-only">{m.change}</span></th>
                <th scope="col" className="px-2 py-2 text-right">
                  <label htmlFor={compareId} className="sr-only">{m.compareWith}</label>
                  <select
                    id={compareId}
                    value={compare}
                    onChange={(e) => setCompare(e.target.value as typeof compare)}
                    className="mb-1 rounded-pill border border-hairline bg-card px-2 py-0.5 text-xs font-semibold text-navy"
                  >
                    <option value="sameMonth">{m.sameMonth}</option>
                    <option value="lastMonth">{m.lastMonth}</option>
                  </select>
                  <span className="block">{monthHead(versus, language)}</span>
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  <span className="block">{m.thisMonth}</span>
                  <span className="block">{monthHead(view.month, language)}</span>
                </th>
                <th scope="col" className="px-2 py-2 text-right"><span className="sr-only">{m.change}</span></th>
                <th scope="col" className="px-3 py-2 text-right">{m.monthlyTarget}</th>
              </tr>
            </thead>
            <tbody>
              {GROUP_ORDER.map((group) => {
                const rows = view.rows.filter((r) => r.group === group);
                if (rows.length === 0) return null;
                return (
                  <Fragment key={group}>
                    <tr className="border-b border-divider bg-base">
                      <th scope="colgroup" colSpan={8} className="sticky left-0 bg-base px-3 py-1.5 text-xs font-bold uppercase text-muted">
                        {m.groups[group]}
                      </th>
                    </tr>
                    {rows.map((row) => {
                      const before = compare === 'sameMonth' ? row.sameMonthLastYear : row.lastMonth;
                      const change = compare === 'sameMonth' ? row.changeVsSameMonth : row.changeVsLastMonth;
                      return (
                        <tr key={row.key} data-row={row.key} className="border-b border-divider last:border-b-0">
                          <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-2 font-bold text-ink">{m.rows[row.key]}</th>
                          <td className="px-2 py-2 text-right tabular-nums text-ink">{mapaFigure(row, row.ytdLastYear, language)}</td>
                          <td className="px-2 py-2 text-right font-bold tabular-nums text-ink">{mapaFigure(row, row.ytd, language)}</td>
                          <td className="px-2 py-2 text-right"><ChangeText change={row.ytdChange} /></td>
                          <td className="px-2 py-2 text-right tabular-nums text-ink">{mapaFigure(row, before, language)}</td>
                          <td className="px-2 py-2 text-right font-bold tabular-nums text-ink">{mapaFigure(row, row.thisMonth, language)}</td>
                          <td className="px-2 py-2 text-right"><ChangeText change={change} /></td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted">{mapaFigure(row, row.target, language)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {empty && <NoData canUpload={canUpload && platformKpmId === undefined} />}
        </div>
      </section>
    </div>
  );
}
