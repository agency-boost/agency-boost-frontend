'use client';

import { useEffect, useId, useState } from 'react';
import { YtdFigure } from '@/components/ytd-cell';
import { DataTable, Row, Cell } from '@/components/ui/data-table';
import { Select } from '@/components/ui/field';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readQuant, type Quant, type QuantMetric } from '@/lib/advanced-analytics-page';
import { formatMonth, formatNumber, formatOfficeDay, formatPercent, formatRupiahCompact, OFFICE_TIME_ZONE } from '@/lib/format';
import { PeerStatusChip, SectionError, SectionLoading } from './shared';

/** A Quant figure as its metric writes it: a share whole, money compact, A2 signed, a ratio to a tenth. */
export function quantText(code: string, value: number, language: Language): string {
  if (code === 'B1' || code === 'B2' || code === 'B3') return formatPercent(value, {}, language);
  if (code === 'D1') return formatRupiahCompact(value, {}, language);
  if (code === 'A2') return `${value > 0 ? '+' : ''}${formatNumber(value, {}, language)}`;
  return formatNumber(value, { maxDecimals: 1 }, language);
}

/** January to the run's last month: *Jan 2026 – Jun 2026*. */
const periodOf = (periodEnd: string, language: Language) => ({
  from: formatMonth(`${periodEnd.slice(0, 4)}-01`, language), to: formatMonth(periodEnd, language),
});

/**
 * ***Analitik kuantitatif*** (P19.5-T3 AC-5 to AC-9; ADR-0215 §5, §6; R3, D4; AA UI-012, UI-014, UI-023; AT-6, AT-7):
 * a semi-annual run's ten metrics, A1 to D1, each with **this KPM's value**, **the median of the company's other KPMs
 * with complete data** and the peer-status chip — or *"Belum cukup KPM pembanding (n dari 3)"* and no chip. A value whose
 * months are not all complete reads *Belum lengkap* (the shared cell) and takes no chip. The run recalculates on every
 * upload until the 15th of the month after it, then is locked; a later upload marks it *"Data diunggah setelah periode
 * dikunci"* and changes nothing. **No other KPM's figure or name is ever on the page** — the server sends none.
 */
export function QuantSection({ platformKpmId }: { platformKpmId?: string }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const language = useFigureLanguage();
  const runId = useId();
  const [periodEnd, setPeriodEnd] = useState<string | undefined>(undefined);
  const [view, setView] = useState<Quant | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    readQuant({ periodEnd }, platformKpmId)
      .then((answer) => { if (live) setView(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [periodEnd, platformKpmId]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const q = t.quant;
  if (view.periodEnd === null) {
    return <p data-section="quant" className="rounded-lg bg-card px-4 py-6 text-center text-md text-muted">{q.noRun}</p>;
  }
  const day = (iso: string) => formatOfficeDay(iso, OFFICE_TIME_ZONE, language);

  const own = (m: QuantMetric) => {
    if (m.value === null) {
      const why = m.reason === 'not_enough_data' ? q.notEnoughData : m.reason === 'no_leader' ? q.noLeader : null;
      return why ? <span className="text-muted">{why}</span> : <span aria-label={t.noData}>—</span>;
    }
    const text = quantText(m.code, m.value, language);
    return m.complete
      ? <span className="font-semibold tabular-nums">{text}</span>
      : <YtdFigure text={text} calculated={false} missingMonths={m.missingMonths} />;
  };

  return (
    <div data-section="quant">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label htmlFor={runId} className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-navy">
          {t.filters.run}
          <Select id={runId} value={view.periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="min-w-[12rem]">
            {view.runs.map((p) => <option key={p} value={p}>{q.period(periodOf(p, language))}</option>)}
          </Select>
        </label>
        <p className="pb-2 text-sm text-muted" data-run-state={view.frozenAt ? 'frozen' : 'live'}>
          {view.frozenAt ? q.frozen({ date: day(view.frozenAt) }) : view.freezesAt ? q.live({ date: day(new Date(new Date(view.freezesAt).getTime() - 1).toISOString()) }) : null}
        </p>
      </div>
      {view.lateWriteAt && (
        <p role="note" data-late-write="" className="mb-3 rounded-md border border-alert/30 bg-alert/5 px-3 py-2 text-sm font-semibold text-alert">{q.late}</p>
      )}
      <p className="mb-2 text-sm text-muted">{q.peersLine}</p>
      <DataTable caption={t.sections.quant} columns={[t.mapa.metric, q.yours, q.median, { label: q.median, visuallyHidden: true }]}>
        {view.metrics.map((m) => (
          <Row key={m.code} data-row={m.code}>
            <Cell className="min-w-[14rem]">
              <span className="mr-2 font-mono text-xs text-muted">{m.code}</span>
              <span className="font-semibold">{q.metrics[m.code as keyof typeof q.metrics] ?? m.metric}</span>
            </Cell>
            <Cell className="whitespace-nowrap">{own(m)}</Cell>
            <Cell className="whitespace-nowrap tabular-nums">
              {m.median === null
                ? <span className="text-sm text-muted">{q.notEnough({ n: m.peers, needed: view.needed })}</span>
                : quantText(m.code, m.median, language)}
            </Cell>
            <Cell className="whitespace-nowrap"><PeerStatusChip status={m.status} /></Cell>
          </Row>
        ))}
      </DataTable>
    </div>
  );
}
