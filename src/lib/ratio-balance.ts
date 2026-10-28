/**
 * A balance ratio read as **each side's share of the two** (P13.1-T6).
 *
 * The API answers a `band` ratio with `share`, the first side's percent of both, beside the lean in
 * points (`metrics-and-definitions.md`, `SELLING_RECRUITMENT_BALANCE`). The client read the lean and the
 * prototype's `100% / 0% / 100%` ticks as ambiguous (2026-10-07): two selling and three recruiting is
 * *40,0% Selling · 60,0% Recruitment*, and that is how a balance is written now, on the agent's card and on
 * a coaching session's — **to its tenth**, the comma `id-ID`'s: a split is a ratio read against its benchmark,
 * whose tenth can decide the status (ADR-0174 §2, parity I-501). **The benchmark stays in points** — stored,
 * typed and edited as ±30 — and is read as the shares it allows, **as typed**: ±30 points is each side between
 * 35% and 65%, never *35,0%*.
 *
 * Nothing here is a constant (invariant §7). The band's edges are `(100 ∓ b) ÷ 2`, the share a side has
 * when the lean is exactly ±b — the registry's `lean = (share − 50) × 2` solved for the share.
 */

import { formatPercent } from '@/lib/format';

type Status = 'success' | 'alert' | 'neutral';

/** At most `places` decimals, and none when whole: `40`, `37.5`. */
const rounded = (value: number, places: number) => Number(value.toFixed(places));

/** The places a split is written to before it needs more to stay on its side of the band: its tenth (ADR-0174 §2). */
const SPLIT_PLACES = 1;

/** Where each side must sit to be on track, in percent: `{ low: 35, high: 65 }` for ±30 points. */
export function balanceBand(benchmark: number): { low: number; high: number } {
  // A band of 100 points or more allows every split; one below zero allows none but an even one.
  const b = Math.min(100, Math.max(0, benchmark));
  return { low: (100 - b) / 2, high: (100 + b) / 2 };
}

/**
 * The band's edges as written, **as the benchmark was typed** (ADR-0174 §2): `{ low: '35%', high: '65%' }`, `37,5%`
 * for a ±25 band, `37,25%` for ±25.5 — the places the benchmark gives them, and no *,0*.
 */
export function formatBalanceBand(benchmark: number): { low: string; high: string } {
  const { low, high } = balanceBand(benchmark);
  return { low: formatPercent(rounded(low, 2), { lossless: true }), high: formatPercent(rounded(high, 2), { lossless: true }) };
}

/**
 * The split, **summing to 100**: `{ first: '40,0%', second: '60,0%' }` for a 40% share.
 *
 * Its tenth (ADR-0174 §2: a ratio beside its benchmark), the second side written as 100 less the first so the two
 * never add up to 99,9 or 100,1. **A split never rounds onto the other side of its status**, as `formatRatioForStatus` keeps a
 * rate from doing: a 65.04% share misses a 35–65% band, and written `65,0% · 35,0%` it would read as inside
 * it, so it is written `65,04% · 34,96%`. **A side with any activity on it never reads 0,0%**, either — the
 * zero the client asked to have taken off the bar is not put back in the sentence.
 */
export function formatBalanceSplit(share: number, benchmark: number, status: Status): { first: string; second: string } {
  const { high } = balanceBand(benchmark);
  const write = (places: number) => {
    const first = rounded(share, places);
    return { first, second: rounded(100 - first, places) };
  };
  const honest = ({ first, second }: { first: number; second: number }) => {
    const larger = Math.max(first, second);
    const agrees = status === 'alert' ? larger > high : status === 'success' ? larger <= high : true;
    const bothSeen = share <= 0 || share >= 100 || (first > 0 && second > 0);
    return agrees && bothSeen;
  };
  const places = [SPLIT_PLACES, SPLIT_PLACES + 1].find((p) => honest(write(p))) ?? SPLIT_PLACES + 2;
  const split = write(places);
  return {
    first: formatPercent(split.first, { decimals: SPLIT_PLACES, maxDecimals: places }),
    second: formatPercent(split.second, { decimals: SPLIT_PLACES, maxDecimals: places }),
  };
}

/**
 * **What an off-balance reading tells the reader to do** (P18.95-T5 AC-6; the client's UI review, UI-030:
 * *67% Selling · 33% Recruitment · Below benchmark* said that something was wrong and not what): the side
 * there is too much of, and the band to come back into — *Too much selling — aim for 35%–65%*.
 *
 * - **`null` in the band**, and for a reading with no status to give: the screen keeps its own words there
 *   (*On track*), as it always has.
 * - **The band is the ratio's own benchmark**, read as shares (`formatBalanceBand`): an office's ±20 points
 *   says *aim for 40%–60%*. Nothing here is a literal (invariant §7).
 * - **The side is named as the track's ends are** (`balanceSideNames`), lower-cased in the sentence where it is
 *   a section's name — *too much selling* — and as it is where it is *Side A* or *Side B*.
 */
export function balanceAdvice(
  share: number | null,
  benchmark: number,
  status: Status,
  sides: { numerator: string | null; denominator: string | null } | null | undefined,
): string | null {
  if (share === null || status !== 'alert') return null;
  const { first, second } = balanceSideNames(sides);
  // The status is judged on the lean, which is the share's distance from half: past the band, the larger side.
  const firstIsMore = share > 50;
  const side = firstIsMore ? first : second;
  // A section's name, unless `balanceSideNames` fell back to *Side A* / *Side B* for it.
  const section = (firstIsMore ? sides?.numerator : sides?.denominator) ?? null;
  const fellBack = section === null || (first.toLowerCase() === 'side a' && second.toLowerCase() === 'side b');
  const { low, high } = formatBalanceBand(benchmark);
  return `Too much ${fellBack ? side : side.toLowerCase()} — aim for ${low}–${high}`;
}

/**
 * What the two ends are called: the section each side counts, as the API names it — *Selling* and
 * *Recruitment* on the seed — or **Side A** and **Side B**, the Add-a-ratio form's own words, for a side
 * with no one name.
 *
 * A side has no one name when its activities come from more than one section (the API's `null`), or
 * when both sides come from the same one: an office's *presentations vs follow-ups* is *Selling* at
 * both ends, and *40% Selling · 60% Selling* says nothing. A snapshot with no `sides` at all is the
 * caller's to handle — it never held names, and inventing them would be today's words on a past record.
 */
export function balanceSideNames(
  sides: { numerator: string | null; denominator: string | null } | null | undefined,
): { first: string; second: string } {
  const first = sides?.numerator ?? null;
  const second = sides?.denominator ?? null;
  if (first !== null && second !== null && first.toLowerCase() === second.toLowerCase()) {
    return { first: 'Side A', second: 'Side B' };
  }
  return { first: first ?? 'Side A', second: second ?? 'Side B' };
}
