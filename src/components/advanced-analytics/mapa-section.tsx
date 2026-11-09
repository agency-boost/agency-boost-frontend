'use client';

import { useEffect, useId, useState } from 'react';
import { YtdFigure } from '@/components/ytd-cell';
import { Select, TextInput } from '@/components/ui/field';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { advancedAnalyticsPageMessages } from '@/i18n/messages/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readMapa, saveMapaTarget, type Mapa, type MapaCell, type MapaRow } from '@/lib/advanced-analytics-page';
import { cellText, rowName } from '@/lib/leader-meeting-tabs';
import { formatMonthName, formatNumber, toMajor, toMinor } from '@/lib/format';
import { NoData, SectionError, SectionLoading } from './shared';

/** Rupiah in a *miliar*: what an *APE* target is typed in — the row's own unit, *APE (Rp M)*, as the forum types it. */
const RUPIAH_PER_MILIAR = 1_000_000_000;

/** A MAPA cell as the forum writes it: a figure in its row's unit, *pending data*, or *—*; nothing for a month to come. */
function mapaText(row: MapaRow, cell: MapaCell, language: Language, pending: string): string {
  if (cell.kind === 'figure') return cellText({ key: row.row, unit: row.unit }, { kind: 'figure', value: cell.value, leavesOut: [] }, language);
  if (cell.kind === 'pending') return pending;
  if (cell.kind === 'none' || cell.kind === 'not_uploaded') return '—';
  return '';
}

/**
 * A target as typed, for its row: an APE target in *miliar* — a point or a comma, up to three places — a count whole;
 * `null` for an empty field, `undefined` for text that is neither.
 */
export function targetFromTyped(row: MapaRow['row'], typed: string): number | null | undefined {
  const text = typed.trim();
  if (text === '') return null;
  if (row === 'ape') {
    if (!/^\d+([.,]\d{1,3})?$/.test(text)) return undefined;
    return toMinor(Math.round(Number(text.replace(',', '.')) * RUPIAH_PER_MILIAR));
  }
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

/** A stored target as its field shows it: APE in *miliar*, in the reader's figures. */
export function targetToTyped(row: MapaRow['row'], value: number | null, language: Language): string {
  if (value === null) return '';
  return row === 'ape' ? formatNumber(toMajor(value) / RUPIAH_PER_MILIAR, { maxDecimals: 3 }, language) : String(value);
}

/** One month's target: a field for the Owner and the Admins, saved on leaving it; *TBD* for anybody else. */
function TargetField({ row, month, value, label, onSaved }: {
  row: MapaRow; month: string; value: number | null; label: string; onSaved: (value: number | null) => void;
}) {
  const t = useMessages(advancedAnalyticsPageMessages).mapa;
  const language = useFigureLanguage();
  const [typed, setTyped] = useState(targetToTyped(row.row, value, language));
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setTyped(targetToTyped(row.row, value, language)); }, [row.row, value, language]);
  const save = async () => {
    const next = targetFromTyped(row.row, typed);
    if (next === undefined) { setInvalid(true); return; }
    setInvalid(false);
    if (next === value) return;
    setSaving(true);
    try {
      await saveMapaTarget(month, row.row, next);
      onSaved(next);
    } catch {
      setInvalid(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <TextInput
      inputMode="decimal"
      density="cell"
      aria-label={label}
      title={invalid ? t.targetInvalid : undefined}
      invalid={invalid}
      disabled={saving}
      value={typed}
      placeholder={t.tbd}
      onChange={(e) => setTyped(e.target.value)}
      onBlur={() => { void save(); }}
      className="w-20 text-right"
    />
  );
}

/**
 * ***MAPA driver*** (P19.5-T3 AC-4, AC-5; ADR-0215 §7; spec §2 *KPMs still own*): **the forum's nine rows, month by
 * month** for a year — through the forum's own scorecard, so nothing is computed a second way — each month with the same
 * month last year under it and **the KPM's typed target** (*TBD* until filled; the forum's five rows take one). The year
 * columns are the shared *Belum lengkap* cell: with a month not complete, *"Belum lengkap · Mar belum diunggah"* (AA
 * UI-012, AT-6). On *FLC*, an ⓘ where the upload's recruitment differs from the members who joined that month (D2).
 * **Built without the KPM-side mockup** (OD-268): one table, scrolled inside its own box.
 */
export function MapaSection({ platformKpmId, canUpload }: { platformKpmId?: string; canUpload: boolean }) {
  const t = useMessages(advancedAnalyticsPageMessages);
  const language = useFigureLanguage();
  const yearId = useId();
  const [year, setYear] = useState<string | undefined>(undefined);
  const [thisYear, setThisYear] = useState<string | null>(null);
  const [view, setView] = useState<Mapa | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    readMapa({ year }, platformKpmId)
      .then((answer) => {
        if (!live) return;
        setView(answer);
        setThisYear((y) => y ?? answer.year);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [year, platformKpmId]);

  if (error) return <SectionError error={error} />;
  if (!view) return <SectionLoading />;
  const m = t.mapa;
  const lastYear = String(Number(view.year) - 1);
  const years = Array.from({ length: 3 }, (_, i) => String(Number(thisYear ?? view.year) - i));
  const empty = view.rows.every((row) => row.months.every((c) => c.value.kind !== 'figure'));
  const write = view.canWrite && platformKpmId === undefined;

  const setTarget = (rowKey: MapaRow['row'], month: string, value: number | null) => setView((v) => v && ({
    ...v,
    rows: v.rows.map((r) => (r.row !== rowKey ? r : { ...r, months: r.months.map((c) => (c.month === month ? { ...c, target: value } : c)) })),
  }));

  return (
    <div data-section="mapa">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label htmlFor={yearId} className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-navy">
          {t.filters.year}
          <Select id={yearId} value={view.year} onChange={(e) => setYear(e.target.value)} className="min-w-[7rem]">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-card-edge bg-card">
        <table className="relative w-full border-collapse text-left text-sm">
          <caption className="sr-only">{t.sections.mapa}</caption>
          <thead className="bg-base text-2xs font-semibold uppercase text-muted">
            <tr>
              <th scope="col" className="sticky left-0 z-[1] min-w-[11rem] bg-base px-3 py-2">{m.metric}</th>
              {view.rows[0]?.months.map((c) => (
                <th key={c.month} scope="col" className="min-w-[6.5rem] px-2 py-2 text-right">{formatMonthName(c.month, language)}</th>
              ))}
              <th scope="col" className="min-w-[7rem] px-2 py-2 text-right">{m.ytd({ year: view.year })}</th>
              <th scope="col" className="min-w-[7rem] px-2 py-2 text-right">{m.ytd({ year: lastYear })}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => {
              const name = rowName(row.row, language);
              return (
                <tr key={row.row} data-row={row.row} className="border-b border-hairline align-top last:border-b-0">
                  <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-2 font-semibold text-navy">{name}</th>
                  {row.months.map((c) => (
                    <td key={c.month} className="px-2 py-2 text-right tabular-nums">
                      {!row.monthly ? (
                        <span className="sr-only">{m.notTracked}</span>
                      ) : c.value.kind === 'future' ? null : (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="flex items-center gap-1 font-semibold text-navy">
                            {mapaText(row, c.value, language, m.pending)}
                            {c.joined !== undefined && (
                              <TippedGlyph glyph="ⓘ" name={m.joined({ n: c.joined })} tip={m.joined({ n: c.joined })} />
                            )}
                          </span>
                          <span className="text-2xs text-muted">
                            <span className="sr-only">{`${m.lastYear}: `}</span>
                            {mapaText(row, c.lastYear, language, m.pending)}
                          </span>
                          {row.targetable && (write
                            ? (
                              <TargetField
                                row={row}
                                month={c.month}
                                value={c.target}
                                label={m.targetFor({ row: name, month: formatMonthName(c.month, language) })}
                                onSaved={(value) => setTarget(row.row, c.month, value)}
                              />
                            )
                            : (
                              <span className="text-2xs text-muted">
                                <span className="sr-only">{`${m.target}: `}</span>
                                {c.target === null ? m.tbd : cellText({ key: row.row, unit: row.unit }, { kind: 'figure', value: c.target, leavesOut: [] }, language)}
                              </span>
                            ))}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">
                    <YtdFigure
                      text={row.ytd.kind === 'figure' || row.ytd.kind === 'pending' ? mapaText(row, row.ytd, language, m.pending) : null}
                      calculated
                      missingMonths={row.row === 'manpower' ? [] : view.ytdMissingMonths}
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <YtdFigure
                      text={row.ytdLastYear.kind === 'figure' || row.ytdLastYear.kind === 'pending' ? mapaText(row, row.ytdLastYear, language, m.pending) : null}
                      calculated
                      missingMonths={row.row === 'manpower' ? [] : view.ytdLastYearMissingMonths}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {empty && <NoData canUpload={canUpload} />}
      </div>
    </div>
  );
}
