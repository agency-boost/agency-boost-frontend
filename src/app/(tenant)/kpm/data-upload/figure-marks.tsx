'use client';

import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import type { Language } from '@/i18n/language';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import type { MetricCell, UploadUnit } from '@/lib/production';
import { correctedNote } from './correction-panel';

/*
 * **A figure and the month's *Active (MAA)*, as Data upload draws them** — the laptop's table, the rows of a phone and
 * a tablet, and the agent's sheet (P9-T6, ADR-0054; moved here from `page.tsx` by P19.2-T3, when the sheet came to draw
 * them too).
 */

/**
 * Money in full rupiah, persistency with its sign, counts as they are — the table's own formats, in `id-ID`
 * (ADR-0167 §1). **The file's own figures, so in full** (ADR-0174 §3, §4: Data upload's cells are where precision
 * matters): money to the rupiah, and a persistency with every decimal the file had — *87,35%*, *87%* — never rounded.
 */
export function formatFigure(unit: UploadUnit, value: number, figures: Language): string {
  if (unit === 'rp_million') return formatRupiah(value, figures);
  // Every percentage column — a rolling persistency, a leader row's unit persistency — with the places the file gave.
  if (unit === 'percent') return formatPercent(value, { lossless: true }, figures);
  return formatNumber(value, { maxDecimals: 4 }, figures);
}

/**
 * One cell, in its column's unit. **A dash for nothing, a number for something — including zero.** The dash is muted so a
 * month nobody has uploaded reads as quiet rather than as a wall of failures.
 *
 * **And whose it is** (P9-T6 AC-4). A figure from the carrier's file is plain — it is most of the
 * table, and marking every one would mark none. A figure corrected by hand carries **✎**, with who,
 * when and why in its tooltip and, for a screen reader, in its text; a figure **emptied** by hand is a
 * dash with the same mark, because *nothing is held* and *somebody decided nothing is held* are two
 * different things to know about a month.
 */
export function Figure({ unit, cell }: { unit: UploadUnit; cell: MetricCell }) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const mark = cell.provenance === 'corrected' ? correctedNote(cell, figures, language) : null;
  const value = cell.value === null
    ? <span className="text-muted" aria-label={mark ? undefined : t.nothingReported}>—</span>
    : <span className="text-navy">{formatFigure(unit, cell.value, figures)}</span>;
  /*
   * **A value outside its column's current limits** (P19.5-T2 AC-11; AA UI-025): a red outline and *"Di luar batas sejak
   * v<n>"* — on the tooltip and, for a screen reader, in its words. The value is never changed.
   */
  const bounds = cell.outOfBounds && cell.value !== null ? t.outOfBounds({ version: cell.outOfBounds.sinceVersion }) : null;
  const shown = bounds ? (
    <span data-out-of-bounds="" title={bounds} className="relative rounded-sm px-0.5 outline outline-1 outline-alert">
      {value}
      <span className="sr-only">{`, ${bounds}`}</span>
    </span>
  ) : value;
  if (!mark) return shown;
  // `relative`, so the screen-reader note is placed inside the table's scroll box and not beside the
  // page: an `sr-only` span is absolutely positioned, and with no positioned ancestor it escaped the
  // box and widened the page by the width of its column — 5px at 400px, found walking the screen.
  return (
    <span title={mark} className="relative">
      {shown}
      <span aria-hidden="true" className="ml-1 text-2xs font-bold text-navy">✎</span>
      <span className="sr-only">{`, ${mark}`}</span>
    </span>
  );
}

/**
 * The Monthly Active Agent (ADR-0054): the prototype's ✓, ✕ and grey dash (`KPM_Owner.html:4830-4832`).
 *
 * **The server's answer, drawn — never worked out here.** The prototype computes it in the page; ours
 * is `MONTHLY_ACTIVE_AGENT`, one function on the server, and a screen re-deriving it is how the
 * product came to hold four definitions of *active* (invariant §8).
 *
 * **The glyph is navy and the wash is the colour.** The prototype's blue ✓ and amber ✕ miss 4.5:1 on
 * their own tints (`a11y.spec.tsx` pins both), which is the leads table's mid-stage status again, and
 * settled the same way. The shape says which, the words say it to a screen reader, and colour is
 * never the only cue.
 */
export function ActiveMark({ active }: { active: boolean | null | undefined }) {
  const t = useMessages(dataUploadMessages);
  if (active === null || active === undefined) {
    return <span role="img" aria-label={t.notReported} className="text-muted">—</span>;
  }
  return (
    <span
      role="img"
      aria-label={active ? t.active : t.notActive}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-navy',
        active ? 'bg-info/[0.12]' : 'bg-primary/[0.16]',
      )}
    >
      {active ? '✓' : '✕'}
    </span>
  );
}
