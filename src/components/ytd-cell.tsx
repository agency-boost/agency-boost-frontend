'use client';

import type { ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { cn } from '@/lib/cn';
import { formatMonthName } from '@/lib/format';

/**
 * **The months a year to date lacks, as a sentence names them** (R4; AA UI-012): *Mar 2026*, *Jan, Feb 2026* — each
 * year's months by their short names, then the year; years apart with *;*. In the figures' language, as every month on
 * Data upload is written (`monthLabel`).
 */
export function missingMonthsWords(months: readonly string[], figures: Language): string {
  const byYear = new Map<string, string[]>();
  for (const month of [...months].sort()) {
    const year = month.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), formatMonthName(month, figures)]);
  }
  return [...byYear].map(([year, names]) => `${names.join(', ')} ${year}`).join('; ');
}

/** The cell's sentence with the months alone — *Mar*, *Jan, Feb* — as the mockup's tooltip writes it within one year. */
function monthsAlone(months: readonly string[], figures: Language): string {
  const years = new Set(months.map((m) => m.slice(0, 4)));
  return years.size === 1 ? [...months].sort().map((m) => formatMonthName(m, figures)).join(', ') : missingMonthsWords(months, figures);
}

/**
 * **The shared *Belum lengkap* year-to-date cell** (P19.5-T2 AC-7; R4, AA UI-012; the template mockup's `td.calc` and
 * `td.inc`) — one component, so Data upload and the KPM's *Advanced analytics* page (P19.5-T3: MAPA's *YTD*) draw a year
 * to date the same way:
 *
 * - **calculated** (`ytd: 'sum'`, complete): the sum of the months, greyed — it is worked out, never typed or uploaded;
 * - **Belum lengkap**: a month from January to this one is missing or below `completePct` — the partial sum on the amber
 *   tint, in italics, its tooltip and its screen-reader words *"Belum lengkap · Mar belum diunggah"*;
 * - **uploaded** (`ytd: 'upload'`): the carrier's figure, as any figure is drawn.
 *
 * `text` is the figure as its column writes it (money in full, a percentage, a count), or `null` for nothing held — a
 * dash, said as *nothing reported*. `mark` is what follows it — a correction's ✎. Colour is never the only cue: the
 * words are on the cell.
 */
export function YtdFigure({
  text, calculated, missingMonths, mark, className,
}: {
  text: string | null;
  calculated: boolean;
  missingMonths: readonly string[];
  mark?: ReactNode;
  className?: string;
}) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  const incomplete = missingMonths.length > 0;
  const note = incomplete ? t.ytdIncomplete({ months: monthsAlone(missingMonths, figures) }) : null;
  return (
    <span
      data-ytd={incomplete ? 'incomplete' : calculated ? 'calculated' : 'uploaded'}
      title={note ?? (calculated ? t.ytdCalculated : undefined)}
      className={cn(
        'relative inline-block rounded-sm px-1',
        incomplete ? 'bg-pill-amber italic text-pill-amber-ink' : calculated ? 'bg-hover-row text-muted' : 'text-navy',
        className,
      )}
    >
      {text === null
        ? <span aria-label={incomplete ? undefined : t.nothingReported}>—</span>
        : <span>{text}</span>}
      {mark}
      {note && <span className="sr-only">{`, ${note}`}</span>}
    </span>
  );
}
