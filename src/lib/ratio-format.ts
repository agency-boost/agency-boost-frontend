/**
 * Writing a ratio's benchmark for a reader (P4-T25).
 *
 * **The one place a benchmark is formatted.** The stored value is a proportion or a number;
 * the API says which unit it is written in (`displayUnit`), and this turns the pair into the
 * text the metric registry states — `15%`, `0,30`, `±30 points`. Until this existed every
 * settings screen printed the stored value, so an Owner read `0.15` for a success rate.
 *
 * **In `id-ID` since ADR-0167 §1** (parity I-395): a decimal takes a comma, through `lib/format.ts`'s
 * `formatNumber` and `formatPercent`. **Since ADR-0174 §2** (parity I-501) a benchmark reads as typed — `30%`,
 * `15,5%`, never `30,0%` — and a computed ratio keeps its tenth, `29,6%`, because beside its benchmark the
 * tenth decides the status; a ratio written as a number keeps its two places, `0,30`.
 *
 * The decimal places live here and nowhere else: the backend holds the unit and never
 * formats, so this is not a second copy of anything (invariant §7).
 *
 * **In the reader's language since P18.98-T3** (ADR-0174 §6, ADR-0179 §6): every function that writes a figure takes
 * the `language` last — Indonesian when a caller passes none — and writes the same figure in each, `29,6%` and
 * `29.6%`, `0,30` and `0.30`. **The words beside a figure** (*points*, *A number*) are the catalogue's since P18.98-T4
 * (`messages/ratio-words.ts`): a function that writes one takes the words' language after the figures' — `words`,
 * English when none is passed, so a screen not moved yet reads as it did — and its caller passes `useLanguage()` and
 * `useFigureLanguage()`.
 *
 * **Input is typed the way it is shown.** An Owner reads `15%` and types `15`, not `0.15`;
 * the conversion back is {@link benchmarkFromInput}, which takes a comma or a point (`parseDecimal`).
 * Anything else would be a field whose value means something different from the number beside it.
 */

import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { ratioWordMessages } from '@/i18n/messages/ratio-words';
import { formatDecimalInput, formatNumber, formatPercent, parseDecimal } from '@/lib/format';

export type RatioDisplayUnit = 'percent' | 'decimal' | 'points';

/**
 * **What each unit is called where an Owner chooses one**, with an example figure in it — *A percentage — 15%*, *A
 * number — 0,30* — in the reader's `words` and its figure in the `figures` language (P18.98-T4).
 */
export function displayUnitLabels(
  words: Language = SOURCE_LANGUAGE, figures: Language = DEFAULT_LANGUAGE,
): Record<Exclude<RatioDisplayUnit, 'points'>, string> {
  const t = messagesIn(ratioWordMessages, words).unit;
  return {
    percent: t.percent({ example: formatPercent(15, {}, figures) }),
    decimal: t.decimal({ example: formatNumber(0.3, { decimals: 2 }, figures) }),
  };
}

/** What each unit is called where an Owner chooses one, in English with Indonesian figures — a screen not moved yet. */
export const DISPLAY_UNIT_LABEL: Record<Exclude<RatioDisplayUnit, 'points'>, string> = displayUnitLabels();

/** The unit's mark beside an input, or `null` for a plain number. */
export const DISPLAY_UNIT_SUFFIX: Record<RatioDisplayUnit, string | null> = {
  percent: '%',
  decimal: null,
  points: ratioWordMessages.en.pointsEitherSide,
};

/**
 * The unit a row is written in.
 *
 * The fallback is for a **published snapshot rendered before units existed**, which is an
 * immutable copy and carries none. A band is points by definition; anything else falls back
 * to `decimal`, which prints the stored value exactly as the screen did before — wrong for a
 * success rate until the next publish, and never a number multiplied by a hundred that
 * should not have been.
 */
export function unitFor(ratio: { displayUnit?: RatioDisplayUnit | null; comparison: 'gte' | 'band' }): RatioDisplayUnit {
  if (ratio.comparison === 'band') return 'points';
  return ratio.displayUnit && ratio.displayUnit !== 'points' ? ratio.displayUnit : 'decimal';
}

/** At most `places` decimals, and none when whole: what an input holds, before it is written in the reader's marks. */
const trimmed = (value: number, places: number) => Number(value.toFixed(places));

/**
 * `30%`, `15,5%`, `0,30`, `±30 points` — **a benchmark reads as typed** (ADR-0174 §2): a percentage keeps the
 * places it was set with and no more (`lossless`, so `30%`, never `30,0%`), as the field beside it is typed; a
 * number to two places, as `metrics-and-definitions.md` states for each ratio. Points are whole where they are
 * whole — the balance band is `±30`, and `±30.0 points` would claim a precision nobody set. *Points* is a word, in
 * `words`' language (English when none is passed).
 */
export function formatBenchmark(
  value: number, unit: RatioDisplayUnit, language: Language = DEFAULT_LANGUAGE, words: Language = SOURCE_LANGUAGE,
): string {
  if (unit === 'percent') return formatPercent(value * 100, { lossless: true }, language);
  if (unit === 'points') {
    return messagesIn(ratioWordMessages, words).band({ value: formatNumber(value, { maxDecimals: 1 }, language) });
  }
  return formatNumber(value, { decimals: 2 }, language);
}

/** The places a computed number ratio keeps: two (`0,38`). A percentage is whole (UI-080), so it has none to keep. */
const DECIMAL_PLACES = 2;

/** A ratio's figure in its unit: `30%`, `0,38` — `30%`, `0.38` in English. A percentage is whole (UI-080). */
const ratioText = (value: number, unit: Exclude<RatioDisplayUnit, 'points'>, places: number, language: Language) =>
  (unit === 'percent'
    ? formatPercent(value * 100, {}, language)
    : formatNumber(value, { decimals: places }, language));

/**
 * A computed ratio (P10-T2): **a percentage whole** — `9%`, `30%` for 29,6 (UI V1, UI-080, the owner: every percentage is
 * a whole number, round half up; ADR-0180, which reverses ADR-0174 §2's tenth); a number to two places, `0,38` —
 * *Leads per activity* keeps them; and the balance's lean as whole points — `24 points`, without a sign, since the
 * sentence around it says which way. `null` is *not enough data* and is written `–`, the prototype's own
 * (`Overall.html:5330`): never `0`. *Points* is a word, in `words`' language (English when none is passed).
 */
export function formatRatioValue(
  value: number | null, unit: RatioDisplayUnit, language: Language = DEFAULT_LANGUAGE, words: Language = SOURCE_LANGUAGE,
): string {
  if (value === null) return '–';
  if (unit === 'points') {
    const points = Math.round(Math.abs(value));
    return messagesIn(ratioWordMessages, words).lean({ value: String(points), one: points === 1 });
  }
  return ratioText(value, unit, DECIMAL_PLACES, language);
}

/**
 * A computed ratio written beside its status.
 *
 * **A percentage is whole, whatever its status** (UI-080, the owner: *29,6% shows 30% but stays below a 30% target*).
 * The status is judged on the unrounded value — the server's `status`, which this only reads — so a 29,6% miss reads
 * `30%` beside *Below benchmark*, as the owner asked. Until UI V1 a place was added here (`29,6%`) wherever the rounding
 * would reach the benchmark; for a percentage it no longer is.
 *
 * **A number and a lean keep that rule**, which UI-080 does not touch: the status is judged on the exact value and the
 * display rounds, so `8 ÷ 27` is 0.296 — below a 0.30 benchmark — and would read `0,30`; one more decimal is written,
 * `0,296`. A lean of 30.43 points outside a ±30 band reads `30,4 points`. **Read back from what is written**, in `id-ID`
 * whatever the reader's language (P18.98-T3 AC-2), so both languages add the same place.
 */
export function formatRatioForStatus(
  value: number | null,
  unit: RatioDisplayUnit,
  benchmark: number,
  status: 'success' | 'alert' | 'neutral',
  language: Language = DEFAULT_LANGUAGE,
  words: Language = SOURCE_LANGUAGE,
): string {
  const text = formatRatioValue(value, unit, language, words);
  if (value === null || status !== 'alert' || unit === 'percent') return text;
  if (unit === 'points') {
    const lean = Math.abs(value);
    return Math.round(lean) <= benchmark
      ? messagesIn(ratioWordMessages, words).leanExact({ value: formatNumber(lean, { decimals: 1 }, language) })
      : text;
  }
  // Read back in `id-ID`, where a comma is the decimal and a point groups: the same figure as `text`'s.
  const shown = parseDecimal(formatRatioValue(value, unit, 'id'));
  // The benchmark rid of a product's binary noise.
  const mark = Number(benchmark.toFixed(8));
  if (shown < mark) return text;
  return ratioText(value, unit, DECIMAL_PLACES + 1, language);
}

/**
 * What goes in the input for a stored value: `15` for 0.15 shown as a percentage, `0,3` for 0.3 as a
 * number — a comma, as the figure beside it is written (ADR-0167 §1); `0.3` in English (P18.98-T3 AC-3).
 */
export function benchmarkToInput(value: number, unit: RatioDisplayUnit, language: Language = DEFAULT_LANGUAGE): string {
  // Rounded before printing so 0.155 × 100 reads `15,5`, not `15,500000000000002`.
  return formatDecimalInput(unit === 'percent' ? trimmed(value * 100, 4) : trimmed(value, 6), language);
}

/**
 * The stored value for what was typed, or `NaN` when it is not a number.
 *
 * **A comma or a point, in either language** (ADR-0167 §1, AC-3; P18.98-T3 AC-3): `15,5` and `15.5` are both fifteen
 * and a half percent. A
 * benchmark is a small value — a percentage, a ratio near 1, points under 100 — so a single point is a
 * decimal, never a thousands separator: `1.250` is 1,25 (`parseDecimal` states the rule).
 *
 * An empty or whitespace-only field is `NaN`, not `0`: `Number('')` is zero, and a
 * benchmark cleared by accident would otherwise save as "on track at or above 0%".
 */
export function benchmarkFromInput(text: string, unit: RatioDisplayUnit): number {
  const typed = parseDecimal(text);
  if (!Number.isFinite(typed)) return Number.NaN;
  return unit === 'percent' ? Number((typed / 100).toFixed(8)) : typed;
}

/**
 * The same value, re-expressed for another unit — what an input shows when the unit changes.
 *
 * Switching `0,3` from a number to a percentage must read `30`, not reinterpret `0,3` as
 * 0,3%. The stored value is what the reader meant; only its spelling changes.
 */
export function reexpress(
  text: string, from: RatioDisplayUnit, to: RatioDisplayUnit, language: Language = DEFAULT_LANGUAGE,
): string {
  const stored = benchmarkFromInput(text, from);
  return Number.isNaN(stored) ? text : benchmarkToInput(stored, to, language);
}
