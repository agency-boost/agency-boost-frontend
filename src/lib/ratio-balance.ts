/**
 * A balance ratio read as **each side's share of the two** (P13.1-T6).
 *
 * The API answers a `band` ratio with `share`, the first side's percent of both, beside the lean in
 * points (`metrics-and-definitions.md`, `SELLING_RECRUITMENT_BALANCE`). The client read the lean and the
 * prototype's `100% / 0% / 100%` ticks as ambiguous (2026-10-07): two selling and three recruiting is
 * *40% Selling · 60% Recruitment*, and that is how a balance is written now, on the agent's card and on
 * a coaching session's — **whole** (UI V1, UI-080; until then to its tenth, ADR-0174 §2, parity I-501), its status
 * judged on the unrounded share. **The benchmark stays in points** — stored,
 * typed and edited as ±30 — and is read as the shares it allows, **as typed**: ±30 points is each side between
 * 35% and 65%, never *35,0%*.
 *
 * Nothing here is a constant (invariant §7). The band's edges are `(100 ∓ b) ÷ 2`, the share a side has
 * when the lean is exactly ±b — the registry's `lean = (share − 50) × 2` solved for the share.
 */

import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { ratioWordMessages } from '@/i18n/messages/ratio-words';
import { formatPercent, wholePercent } from '@/lib/format';

type Status = 'success' | 'alert' | 'neutral';

/** At most `places` decimals, and none when whole: `40`, `37.5`. */
const rounded = (value: number, places: number) => Number(value.toFixed(places));

/** Where each side must sit to be on track, in percent: `{ low: 35, high: 65 }` for ±30 points. */
export function balanceBand(benchmark: number): { low: number; high: number } {
  // A band of 100 points or more allows every split; one below zero allows none but an even one.
  const b = Math.min(100, Math.max(0, benchmark));
  return { low: (100 - b) / 2, high: (100 + b) / 2 };
}

/**
 * The band's edges as written, **as the benchmark was typed** (ADR-0174 §2): `{ low: '35%', high: '65%' }`, `37,5%`
 * for a ±25 band, `37,25%` for ±25.5 — the places the benchmark gives them, and no *,0*. In the reader's `language`
 * (P18.98-T3): `37.5%` in English.
 */
export function formatBalanceBand(benchmark: number, language: Language = DEFAULT_LANGUAGE): { low: string; high: string } {
  const { low, high } = balanceBand(benchmark);
  return {
    low: formatPercent(rounded(low, 2), { lossless: true }, language),
    high: formatPercent(rounded(high, 2), { lossless: true }, language),
  };
}

/**
 * The split, **whole, summing to 100**: `{ first: '40%', second: '60%' }` for a 40% share, `{ '67%', '33%' }` for 66,7
 * (UI V1, UI-080, the owner: every percentage whole, rounded half up; ADR-0180, which reverses ADR-0174 §2's tenth).
 *
 * The first side is rounded half up and the second is 100 less it, so the two never add up to 99 or 101. **The status
 * is the server's, judged on the unrounded share**, and this writes it as it is: a 65,4% share misses a 35–65% band and
 * reads `65% · 35%` beside *Below benchmark* — as *29,6% reads 30%, below a 30% target* (UI-080). Until UI V1 a place
 * was added here where the rounding met the band's edge, and a side with any activity never read 0; UI-080's
 * *0,4% → 0%* settles both.
 *
 * The figures are the same in both languages (P18.98-T3 AC-2): `65% · 35%` in English too.
 */
export function formatBalanceSplit(
  share: number, _benchmark: number, _status: Status, language: Language = DEFAULT_LANGUAGE,
): { first: string; second: string } {
  const first = Math.min(100, Math.max(0, wholePercent(share)));
  return {
    first: formatPercent(first, {}, language),
    second: formatPercent(100 - first, {}, language),
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
 *   a section's name — *too much selling* — and as it is where it is *Side A* or *Side B*. In Indonesian a section's
 *   name is written as the office typed it (P18.98-T4; ADR-0179 §5).
 * - **Its words are the catalogue's** (`messages/ratio-words.ts`), in `words`' language — English when none is passed —
 *   and the band's figures in `language`'s.
 */
export function balanceAdvice(
  share: number | null,
  benchmark: number,
  status: Status,
  sides: { numerator: string | null; denominator: string | null } | null | undefined,
  language: Language = DEFAULT_LANGUAGE,
  words: Language = SOURCE_LANGUAGE,
): string | null {
  if (share === null || status !== 'alert') return null;
  const t = messagesIn(ratioWordMessages, words);
  const { first, second } = balanceSideNames(sides, words);
  // The status is judged on the lean, which is the share's distance from half: past the band, the larger side.
  const firstIsMore = share > 50;
  const side = firstIsMore ? first : second;
  // A section's name, unless `balanceSideNames` fell back to *Side A* / *Side B* for it.
  const section = (firstIsMore ? sides?.numerator : sides?.denominator) ?? null;
  const fellBack = section === null
    || (first.toLowerCase() === t.sideA.toLowerCase() && second.toLowerCase() === t.sideB.toLowerCase());
  const { low, high } = formatBalanceBand(benchmark, language);
  return t.tooMuch({ side, section: !fellBack, low, high });
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
 *
 * *Side A* and *Side B* are the catalogue's, in `words`' language (P18.98-T4), English when none is passed; a section's
 * name is the office's, as typed.
 */
export function balanceSideNames(
  sides: { numerator: string | null; denominator: string | null } | null | undefined,
  words: Language = SOURCE_LANGUAGE,
): { first: string; second: string } {
  const t = messagesIn(ratioWordMessages, words);
  const first = sides?.numerator ?? null;
  const second = sides?.denominator ?? null;
  if (first !== null && second !== null && first.toLowerCase() === second.toLowerCase()) {
    return { first: t.sideA, second: t.sideB };
  }
  return { first: first ?? t.sideA, second: second ?? t.sideB };
}
