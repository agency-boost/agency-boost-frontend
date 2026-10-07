/**
 * A balance ratio read as **each side's share of the two** (P13.1-T6).
 *
 * The API answers a `band` ratio with `share`, the first side's percent of both, beside the lean in
 * points (`metrics-and-definitions.md`, `SELLING_RECRUITMENT_BALANCE`). The client read the lean and the
 * prototype's `100% / 0% / 100%` ticks as ambiguous (2026-10-07): two selling and three recruiting is
 * *40% Selling · 60% Recruitment*, and that is how a balance is written now, on the agent's card and on
 * a coaching session's. **The benchmark stays in points** — stored, typed and edited as ±30 — and is
 * read as the shares it allows: ±30 points is each side between 35% and 65%.
 *
 * Nothing here is a constant (invariant §7). The band's edges are `(100 ∓ b) ÷ 2`, the share a side has
 * when the lean is exactly ±b — the registry's `lean = (share − 50) × 2` solved for the share.
 */

type Status = 'success' | 'alert' | 'neutral';

/** At most `places` decimals, and none when whole: `40`, `37.5`. */
const rounded = (value: number, places: number) => Number(value.toFixed(places));

/** Where each side must sit to be on track, in percent: `{ low: 35, high: 65 }` for ±30 points. */
export function balanceBand(benchmark: number): { low: number; high: number } {
  // A band of 100 points or more allows every split; one below zero allows none but an even one.
  const b = Math.min(100, Math.max(0, benchmark));
  return { low: (100 - b) / 2, high: (100 + b) / 2 };
}

/** The band's edges as written: `{ low: '35%', high: '65%' }`, `37.5%` for a ±25 band. */
export function formatBalanceBand(benchmark: number): { low: string; high: string } {
  const { low, high } = balanceBand(benchmark);
  return { low: `${rounded(low, 2)}%`, high: `${rounded(high, 2)}%` };
}

/**
 * The split, **summing to 100**: `{ first: '40%', second: '60%' }` for a 40% share.
 *
 * Whole percent, the second side written as 100 less the first so the two never add up to 99 or 101.
 * **A split never rounds onto the other side of its status**, as `formatRatioForStatus` keeps a rate from
 * doing: a 65.2% share misses a 35–65% band, and written `65% · 35%` it would read as inside it, so it
 * is written `65.2% · 34.8%`. **A side with any activity on it never reads 0%**, either — the zero the
 * client asked to have taken off the bar is not put back in the sentence.
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
  const split = [0, 1].map(write).find(honest) ?? write(2);
  return { first: `${split.first}%`, second: `${split.second}%` };
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
