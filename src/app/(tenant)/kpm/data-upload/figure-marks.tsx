'use client';

import type { Language } from '@/i18n/language';
import { formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import type { MetricCell, MonthRow, UploadUnit } from '@/lib/production';

/**
 * **A figure as Data upload writes it** (P19.21-T1 AC-3): money as **exact rupiah**, *Rp 2.135.400* — never rounded to
 * *jt* here (`DATA-DEFINITIONS.md`, *APE, FYP*) — a percentage with the places the file gave, a count as a count. In the
 * figures' language, which the caller passes (`useFigureLanguage()`).
 */
export function formatFigure(unit: UploadUnit, value: number, figures: Language): string {
  if (unit === 'rp_million') return formatRupiah(value, figures);
  if (unit === 'percent') return formatPercent(value, { lossless: true }, figures);
  return formatNumber(value, { maxDecimals: 4 }, figures);
}

/** The unit a correction's field names after the column: *APE (Rp)*, *Persistensi (%)*; a count names none. */
export const unitWord = (unit: UploadUnit): string | null => (unit === 'rp_million' ? 'Rp' : unit === 'percent' ? '%' : null);

/**
 * **What a person types, in the unit the figure is stored in** — money in sen. Money is whole rupiah, so every mark in it
 * (`.` `,` a space, *Rp*) is grouping and is dropped: *1.612.000* is Rp 1.612.000. A percentage or a count takes a decimal
 * comma or point. `null` for an empty field — the way a figure is cleared — and `undefined` for one that is not a number.
 */
export function parseFigure(unit: UploadUnit, typed: string): number | null | undefined {
  const text = typed.trim();
  if (text === '') return null;
  if (unit === 'rp_million') {
    const digits = text.replace(/^rp\s*/i, '').replace(/[.,\s]/g, '');
    if (!/^-?\d+$/.test(digits)) return undefined;
    return Number(digits) * 100;
  }
  const normal = text.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return undefined;
  return Number(normal);
}

/** A stored figure as the field shows it to be changed: money as whole rupiah, grouped as the reader groups them. */
export function typedFigure(unit: UploadUnit, value: number | null, figures: Language): string {
  if (value === null) return '';
  if (unit === 'rp_million') return formatNumber(Math.round(value / 100), {}, figures);
  return formatNumber(value, { maxDecimals: 4 }, figures);
}

/** Nothing written for any column: the carrier has not reported this person (*Belum dilaporkan*). */
export const unreported = (row: Pick<MonthRow, 'values'>) => Object.values(row.values).every((c) => c.value === null);

/** A figure somebody corrected by hand, this month's or an uploaded year to date's (*Dikoreksi*). */
export const corrected = (row: Pick<MonthRow, 'values' | 'ytd'>) =>
  [...Object.values(row.values), ...Object.values(row.ytd)].some((c: MetricCell) => c.provenance === 'corrected');
