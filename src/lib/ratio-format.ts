/**
 * Writing a ratio's benchmark for a reader (P4-T25).
 *
 * **The one place a benchmark is formatted.** The stored value is a proportion or a number;
 * the API says which unit it is written in (`displayUnit`), and this turns the pair into the
 * text the metric registry states — `15,0%`, `0,30`, `±30 points`. Until this existed every
 * settings screen printed the stored value, so an Owner read `0.15` for a success rate.
 *
 * **In `id-ID` since ADR-0167 §1** (parity I-395): a decimal takes a comma, through `lib/format.ts`'s
 * `formatNumber` and `formatPercent`.
 *
 * The decimal places live here and nowhere else: the backend holds the unit and never
 * formats, so this is not a second copy of anything (invariant §7).
 *
 * **Input is typed the way it is shown.** An Owner reads `15,0%` and types `15`, not `0.15`;
 * the conversion back is {@link benchmarkFromInput}, which takes a comma or a point (`parseDecimal`).
 * Anything else would be a field whose value means something different from the number beside it.
 */

import { formatNumber, formatPercent, parseDecimal } from '@/lib/format';

export type RatioDisplayUnit = 'percent' | 'decimal' | 'points';

/** What each unit is called where an Owner chooses one. */
export const DISPLAY_UNIT_LABEL: Record<Exclude<RatioDisplayUnit, 'points'>, string> = {
  percent: 'A percentage — 15,0%',
  decimal: 'A number — 0,30',
};

/** The unit's mark beside an input, or `null` for a plain number. */
export const DISPLAY_UNIT_SUFFIX: Record<RatioDisplayUnit, string | null> = {
  percent: '%',
  decimal: null,
  points: 'points either side',
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

/** At most `places` decimals, and none when whole: what an input holds, before its point becomes a comma. */
const trimmed = (value: number, places: number) => String(Number(value.toFixed(places)));

/**
 * `15,0%`, `0,30`, `±30 points`.
 *
 * Percentages to one decimal and numbers to two, as `metrics-and-definitions.md` states for
 * each ratio. Points are whole where they are whole — the balance band is `±30`, and
 * `±30.0 points` would claim a precision nobody set.
 */
export function formatBenchmark(value: number, unit: RatioDisplayUnit): string {
  if (unit === 'percent') return formatPercent(value * 100);
  if (unit === 'points') return `±${formatNumber(value, { maxDecimals: 1 })} points`;
  return formatNumber(value, { decimals: 2 });
}

/**
 * A computed ratio, written as its benchmark is (P10-T2): `9,1%`, `0,38`, and the balance's lean as
 * whole points — `24 points`, without a sign, since the sentence around it says which way. `null` is
 * *not enough data* and is written `–`, the prototype's own (`Overall.html:5330`): never `0`.
 */
export function formatRatioValue(value: number | null, unit: RatioDisplayUnit): string {
  if (value === null) return '–';
  if (unit === 'points') {
    const points = Math.round(Math.abs(value));
    return `${points} ${points === 1 ? 'point' : 'points'}`;
  }
  return formatBenchmark(value, unit);
}

/**
 * A computed ratio written so that **the number never contradicts the status beside it**.
 *
 * The status is judged on the exact value, and the display rounds: `8 ÷ 27` is 0.296 — below a 0.30
 * benchmark — and `formatRatioValue` writes it `0,30`, beside *Benchmark: 0,30* and *Below benchmark*.
 * A lean of 30.43 points is outside a ±30 band and writes `30 points`. Where the rounded figure would
 * land on the benchmark's own text or inside its band while the status says it missed, one more decimal
 * is written: `0,296`, `30,4 points`.
 */
export function formatRatioForStatus(
  value: number | null, unit: RatioDisplayUnit, benchmark: number, status: 'success' | 'alert' | 'neutral',
): string {
  const text = formatRatioValue(value, unit);
  if (value === null || status !== 'alert') return text;
  if (unit === 'points') {
    const lean = Math.abs(value);
    return Math.round(lean) <= benchmark ? `${formatNumber(lean, { decimals: 1 })} points` : text;
  }
  if (text !== formatBenchmark(benchmark, unit)) return text;
  return unit === 'percent' ? `${formatNumber(value * 100, { decimals: 2 })}%` : formatNumber(value, { decimals: 3 });
}

/**
 * What goes in the input for a stored value: `15` for 0.15 shown as a percentage, `0,3` for 0.3 as a
 * number — a comma, as the figure beside it is written (ADR-0167 §1).
 */
export function benchmarkToInput(value: number, unit: RatioDisplayUnit): string {
  // Rounded before printing so 0.155 × 100 reads `15,5`, not `15,500000000000002`.
  return (unit === 'percent' ? trimmed(value * 100, 4) : trimmed(value, 6)).replace('.', ',');
}

/**
 * The stored value for what was typed, or `NaN` when it is not a number.
 *
 * **A comma or a point** (ADR-0167 §1, AC-3): `15,5` and `15.5` are both fifteen and a half percent. A
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
export function reexpress(text: string, from: RatioDisplayUnit, to: RatioDisplayUnit): string {
  const stored = benchmarkFromInput(text, from);
  return Number.isNaN(stored) ? text : benchmarkToInput(stored, to);
}
