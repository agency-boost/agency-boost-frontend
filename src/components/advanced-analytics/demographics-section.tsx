'use client';

import { useEffect, useId, useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { Select } from '@/components/ui/field';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readDemographics, type AbOption, type Demographics, type DimensionCount } from '@/lib/advanced-analytics-page';
import { formatMonth, formatNumber } from '@/lib/format';
import { NoData, SectionError, SectionLoading } from './shared';

/** The twelve months up to `month`, newest first — the month filter's choices. */
export function monthsUpTo(month: string, count = 12): string[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const index = y * 12 + (m - 1) - i;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

/**
 * **The AB filter and, where a section takes one, the month** — two native selects, as KPM Analytics' *Lihat untuk*:
 * every AB of the office, then *Seluruh KPM*; the months up to this one.
 */
export function SectionFilters({
  abs, ab, onAb, months, month, onMonth, extra,
}: {
  abs: readonly AbOption[];
  ab: string | undefined;
  onAb: (id: string | undefined) => void;
  months?: readonly { value: string; label: string }[];
  month?: string;
  onMonth?: (value: string | undefined) => void;
  extra?: React.ReactNode;
}) {
  const t = useMessages(advancedAnalyticsPageMessages).filters;
  const abId = useId();
  const monthId = useId();
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      {months && onMonth && (
        <label htmlFor={monthId} className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-navy">
          {t.month}
          <Select id={monthId} value={month ?? ''} onChange={(e) => onMonth(e.target.value || undefined)} className="min-w-[10rem]">
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </label>
      )}
      <label htmlFor={abId} className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-navy">
        {t.ab}
        <Select id={abId} value={ab ?? ''} onChange={(e) => onAb(e.target.value || undefined)} className="min-w-[12rem]">
          <option value="">{t.allAbs}</option>
          {abs.map((a) => <option key={a.membershipId} value={a.membershipId}>{a.name}</option>)}
        </Select>
      </label>
      {extra}
    </div>
  );
}

/**
 * ***Demografi KPM*** (P19.5-T3 AC-2; ADR-0215 §3; OWN UI-024, OWN R6, OWN Cases 6 and 9): manpower at the month's end,
 * and five dimensions — role by the company's ladder, *Penuh waktu · Paruh waktu*, gender, the age bands and the tenure
 * bands from the template — each a list of counts that **sums to manpower**, *Belum diisi* among them. **Built without
 * the KPM-side mockup** (OD-268), in the app's card and row idiom; a bar shows each share.
 */
export function DemographicsSection({ platformKpmId, canUpload }: { platformKpmId?: string; canUpload: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const language = useFigureLanguage();
  const [query, setQuery] = useState<{ month?: string; ab?: string }>({});
  const [view, setView] = useState<Demographics | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  /** This month, as the server first answered it: the month filter's newest choice. */
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    readDemographics(query, platformKpmId)
      .then((answer) => {
        if (!live) return;
        setView(answer);
        setCurrent((c) => c ?? answer.month);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [query, platformKpmId]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const d = t.demographics;
  const months = monthsUpTo(current ?? view.month).map((m) => ({ value: m, label: formatMonth(m, language) }));

  const label = (dimension: keyof Pick<Demographics, 'role' | 'workStatus' | 'gender' | 'ageBand' | 'tenureBand'>, row: DimensionCount): string => {
    if (row.key === 'unset') return d.unset;
    if (dimension === 'role') return row.label ?? row.key;
    if (dimension === 'workStatus') return row.key === 'full_time' ? d.full_time : d.part_time;
    if (dimension === 'gender') return row.key === 'male' ? d.male : d.female;
    if (dimension === 'ageBand') {
      if (row.key === 'gen_z') return d.gen_z({ from: row.from ?? 0, to: row.to ?? 0 });
      if (row.key === 'gen_y') return d.gen_y({ from: row.from ?? 0, to: row.to ?? 0 });
      return d.gen_x({ from: row.from ?? 0 });
    }
    if (row.from === null || row.from === undefined) return d.tenureBelow({ to: row.to ?? 0 });
    if (row.to === null || row.to === undefined) return d.tenureAbove({ from: row.from });
    return d.tenureBetween({ from: row.from, to: row.to });
  };

  const dimensions = ['role', 'workStatus', 'gender', 'ageBand', 'tenureBand'] as const;
  return (
    <div data-section="demographics">
      <SectionFilters
        abs={view.abs}
        ab={query.ab}
        onAb={(ab) => setQuery((q) => ({ ...q, ab }))}
        months={months}
        month={query.month ?? view.month}
        onMonth={(month) => setQuery((q) => ({ ...q, month }))}
      />
      <SectionCard
        title={d.manpower}
        meta={<span className="font-display text-2xl font-bold tabular-nums text-navy">{formatNumber(view.manpower, {}, language)}</span>}
        className="mb-4"
      >
        <p className="px-4 py-2 text-sm text-muted">{d.manpowerLine({ n: view.manpower })}</p>
        {view.manpower === 0 && <NoData canUpload={canUpload} />}
      </SectionCard>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dimensions.map((dimension) => (
          <SectionCard key={dimension} title={d[dimension]}>
            <ul data-dimension={dimension} className="divide-y divide-hairline">
              {view[dimension].map((row) => {
                // The bar is drawn to the share; the figure written is the server's count.
                const width = view.manpower === 0 ? 0 : (row.count / view.manpower) * 100;
                return (
                  <li key={row.key} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3 text-md">
                      <span className="min-w-0 text-navy">{label(dimension, row)}</span>
                      <span className="shrink-0 tabular-nums font-semibold text-navy">{formatNumber(row.count, {}, language)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-hairline" aria-hidden="true">
                      <div className="h-full rounded-pill bg-secondary" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
