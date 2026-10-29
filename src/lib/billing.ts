import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { billingMessages } from '@/i18n/messages/billing';
import { officeSubscriptionMessages } from '@/i18n/messages/office-subscription';
import { api } from './api-client';
import { dayInZone, formatCalendarDay, formatPercent, OFFICE_TIME_ZONE } from './format';
import { formatRupiah, groupDigits, MINOR_UNITS_PER_MAJOR } from './goals';

/**
 * The quote tool at `/admin/billing` (ADR-0111; `functional/billing.md`): its one read, the one pure
 * function that prices the calculator and the quote, the *Send quote* dialog's dates, and every string.
 *
 * **Nothing here is stored and nothing is sent but the read.** The prices come from the backend's
 * constant (invariant §7; the 101+ tier's real rates never ship in this bundle); every figure is worked
 * out here, in the browser, on every keystroke; the quote is the page, and its PDF the browser's print.
 */

/** One tier of the price table, as `GET /admin/billing/prices` serves it (`BillingTierDto`). */
export interface BillingTier {
  code: string;
  minLeaders: number;
  maxLeaders: number | null;
  standardMinor: number;
  sixMonthMinor: number;
  annualMinor: number;
  customPricing: boolean;
}

/** `GET /admin/billing/prices` (`BillingPricesDto`). */
export interface BillingPrices {
  currency: 'IDR';
  tiers: BillingTier[];
  annualDiscountPct: number;
}

export const readBillingPrices = () => api<BillingPrices>('/admin/billing/prices');

/** The toggle's two periods (`setPeriod`, `:551-556`). */
export type BillingPeriod = 'sixMonth' | 'annual';
/** The manual override's select (`:291-294`). */
export type DiscountType = 'percent' | 'flat';

/** The calculator's inputs, **as typed**: the function reads them as the prototype does, and better. */
export interface CalculatorInput {
  /** *Number of leaders*. */
  leaders: string;
  period: BillingPeriod;
  discountType: DiscountType;
  /** *Arbitrary discount (internal, per leader)*. */
  discount: string;
}

/** Every figure the calculator and the quote print, in integer IDR minor units. */
export interface Pricing {
  /** The count priced: what was typed, read as the prototype reads it, never below 1. */
  leaders: number;
  tier: BillingTier;
  period: BillingPeriod;
  months: 6 | 12;
  /** *Standard price / leader / mo*. */
  standardMinor: number;
  /** *Offering price / leader / mo*: the six-month rate, in either period. */
  offerMinor: number;
  /** The period's rate, before the manual discount. */
  baseMinor: number;
  /** The six-month rate less the annual, on an annual plan; 0 on six months. */
  annualDiscountMinor: number;
  /** The base rate less the final: what the manual discount took off, per leader. */
  manualDiscountMinor: number;
  /** *Offering price after discount* and *Final price / leader / mo*. */
  finalMinor: number;
  /** *Monthly total (all leaders)*: the final rate × the count, exactly. */
  monthlyTotalMinor: number;
  /** *6-month* or *Annual total (all leaders)*: the monthly total × 6 or 12, exactly. */
  periodTotalMinor: number;
  /**
   * The sentence under the discount field when the discount is out of bounds, or `null`. While it is set
   * the rate is priced without the manual discount and **no quote is generated** (ADR-0111 §5).
   */
  discountError: string | null;
}

/*
 * ── Words ────────────────────────────────────────────────────────────────────────────────────────
 *
 * The catalogue's (`i18n/messages/billing.tsx`, P18.98-T6). The two objects below are its English, the source, in the
 * shapes the specs read; a screen reads its reader's with `useMessages(billingMessages)`, and every function here that
 * writes words takes the words' language last, after the figures', English and Indonesian figures when given neither.
 */

/** **The prototype's own strings, verbatim** (`AgencyBoost_Billing_Subscription.html`; ADR-0062). */
export const BILLING_COPY = billingMessages.en.prototype;

/**
 * **Ours**: the sentences the prototype has no words for, each a registered Fix or Fill
 * (`prototype-parity.md`; `functional/billing.md`).
 */
export const BILLING_OWN_COPY = billingMessages.en.own;

/*
 * ── The arithmetic (ADR-0111 §4) ─────────────────────────────────────────────────────────────────
 */

/**
 * *Number of leaders*, read as the prototype reads it (`:487-488`): `parseInt`, and empty, `0`, a
 * negative or anything unparsable counts as **1**, while the field keeps what was typed. `8.9` is 8.
 */
export function leaderCountOf(text: string): number {
  const count = Number.parseInt(text, 10);
  return !count || count < 1 ? 1 : count;
}

/** The first tier whose bounds hold the count, else the first (`findTier`, `:432-434`). */
export function tierFor(tiers: readonly BillingTier[], count: number): BillingTier {
  return tiers.find((t) => count >= t.minLeaders && (t.maxLeaders === null || count <= t.maxLeaders)) ?? tiers[0];
}

/** *"1–10"*, *"101+"*: the card's and the quote's tier name, from its bounds (`label`, `:421-425`). */
export function tierLabel(tier: Pick<BillingTier, 'minLeaders' | 'maxLeaders'>): string {
  return tier.maxLeaders === null ? `${tier.minLeaders}+` : `${tier.minLeaders}–${tier.maxLeaders}`;
}

/**
 * The card's *Save n%*: the six-month rate's saving on the standard, rounded half up to a whole percent
 * (`:457`). Integers only: 20, 21, 22 and 29 down the table.
 */
export function savePct(tier: Pick<BillingTier, 'standardMinor' | 'sixMonthMinor'>): number {
  const s = tier.standardMinor;
  return Math.floor(((s - tier.sixMonthMinor) * 200 + s) / (2 * s));
}

/** A decimal typed as a percent: digits with one optional separator, **a comma read as a decimal**. */
const PERCENT = /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/** A percent as an exact fraction, `units / scale`, so no float decides a half-rupiah. */
function percentOf(text: string): { units: bigint; scale: bigint } | null {
  const trimmed = text.trim();
  if (trimmed === '') return { units: BigInt(0), scale: BigInt(1) };
  if (!PERCENT.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.replace(',', '.').split('.');
  const scale = BigInt(10) ** BigInt(fraction.length);
  return { units: BigInt(`${whole || '0'}${fraction}`), scale };
}

/** The mark that groups thousands in the figures' `language`: `.` in Indonesian, `,` in English (§E). */
const groupMark = (language: Language) => groupDigits(1000, language).charAt(1);

/**
 * Rupiah typed into *Rp/leader*: digits and the grouping the field writes in the figures' `language`, nothing else —
 * the other language's mark is that language's decimal, and an amount is whole rupiah.
 */
function amountOf(text: string, language: Language): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  const mark = groupMark(language);
  if (![...trimmed].every((c) => /\d/.test(c) || c === mark)) return null;
  const digits = trimmed.split(mark).join('');
  return digits === '' ? null : Number(digits);
}

/**
 * The rate after a percent discount, **rounded half up to the whole rupiah** (ADR-0111 §4), exactly:
 * `rate × (100 − p) / 100` in integers, so *7%* off Rp 356.250 is Rp 331.313 and never Rp 331.312.
 */
function afterPercent(rateMinor: number, pct: { units: bigint; scale: bigint }): number {
  const rate = BigInt(rateMinor / MINOR_UNITS_PER_MAJOR);
  const hundred = BigInt(100) * pct.scale;
  const numerator = rate * (hundred - pct.units);
  const two = BigInt(2);
  const major = (numerator * two + hundred) / (two * hundred);
  return Number(major) * MINOR_UNITS_PER_MAJOR;
}

/**
 * **The one pricing function** (ADR-0111 §4): the tier, the base rate, the manual discount, the final
 * rate, the totals and the quote's two discounts, in integer IDR minor units.
 *
 * - One rate per leader, chosen by the count's tier, the inversions charged as the table says.
 * - **The rate is rounded once**: after a percent discount, half up to the whole rupiah. Every total is
 *   that rate × the count (× 6 or 12), exactly, so a printed rate × count is always the printed total.
 * - **The manual discount is bounded** (§5): a percent from 0 to 100, an amount from Rp 0 to the period's
 *   rate. Outside that, the rate is priced without it and `discountError` says why — its sums in the `figures`'
 *   language, its words in the words' (P18.98-T6), and the amount read in the figures' grouping.
 */
export function priceQuote(
  prices: Pick<BillingPrices, 'tiers'>,
  input: CalculatorInput,
  figures: Language = DEFAULT_LANGUAGE,
  language: Language = SOURCE_LANGUAGE,
): Pricing {
  const own = messagesIn(billingMessages, language).own;
  const leaders = leaderCountOf(input.leaders);
  const tier = tierFor(prices.tiers, leaders);
  const months = input.period === 'annual' ? 12 : 6;
  const baseMinor = input.period === 'annual' ? tier.annualMinor : tier.sixMonthMinor;

  let finalMinor = baseMinor;
  let discountError: string | null = null;
  if (input.discountType === 'percent') {
    const pct = percentOf(input.discount);
    if (pct === null || pct.units > BigInt(100) * pct.scale) discountError = own.percentError;
    else finalMinor = afterPercent(baseMinor, pct);
  } else {
    const amount = amountOf(input.discount, figures);
    if (amount === null || amount * MINOR_UNITS_PER_MAJOR > baseMinor) {
      discountError = own.flatError({ from: formatRupiah(0, figures), to: formatRupiah(baseMinor, figures) });
    }
    else finalMinor = baseMinor - amount * MINOR_UNITS_PER_MAJOR;
  }

  const monthlyTotalMinor = finalMinor * leaders;
  return {
    leaders,
    tier,
    period: input.period,
    months,
    standardMinor: tier.standardMinor,
    offerMinor: tier.sixMonthMinor,
    baseMinor,
    annualDiscountMinor: input.period === 'annual' ? tier.sixMonthMinor - tier.annualMinor : 0,
    manualDiscountMinor: baseMinor - finalMinor,
    finalMinor,
    monthlyTotalMinor,
    periodTotalMinor: monthlyTotalMinor * months,
    discountError,
  };
}

/** The *Rp/leader* field as it is typed: digits only, in the product's grouping, `25.000` (F-03) — `25,000` in English figures. */
export function maskAmount(text: string, figures: Language = DEFAULT_LANGUAGE): string {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? '' : groupDigits(Number(digits), figures);
}

/** A money figure as the page prints it, `Rp 400.000` (`fmt`, `:430`, in the one formatter); `IDR 400,000` in English. */
export const money = (minor: number, figures: Language = DEFAULT_LANGUAGE) => formatRupiah(minor, figures);

/** A per-leader discount as the page prints it, `-Rp 20.000/leader/mo` (`:525`, `:675`). */
export const perLeaderDiscount = (minor: number, figures: Language = DEFAULT_LANGUAGE, language: Language = SOURCE_LANGUAGE) =>
  messagesIn(billingMessages, language).prototype.perLeaderDiscount({ money: formatRupiah(minor, figures) });

/*
 * ── The dialog's dates (ADR-0111 §5; invariant §9) ───────────────────────────────────────────────
 *
 * Calendar days are `YYYY-MM-DD` strings worked on as three numbers in UTC, so the browser's zone moves
 * nothing; *today* is the office's, `Asia/Jakarta` (ADR-0016), never the browser's.
 */

/** How far ahead the default start date is (`addDays(new Date(), 7)`, `:602`). */
export const START_DAYS_AHEAD = 7;

/** The office's today, `YYYY-MM-DD`. */
export const officeToday = (now: Date = new Date()) => dayInZone(OFFICE_TIME_ZONE, now);

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (at: Date) =>
  `${String(at.getUTCFullYear()).padStart(4, '0')}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
/** Midnight UTC of a calendar day. `setUTCFullYear`, because `Date.UTC` reads years 0–99 as 1900s. */
const utcOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(0);
  at.setUTCFullYear(y, m - 1, d);
  return at;
};
/** The days in a month, `month` 1 to 12: day 0 of the next month is this one's last. */
const daysIn = (year: number, month: number) => {
  const at = new Date(0);
  at.setUTCFullYear(year, month, 0);
  return at.getUTCDate();
};

/** A calendar day `n` days on (or back). */
export function addDays(day: string, n: number): string {
  const at = utcOf(day);
  at.setUTCDate(at.getUTCDate() + n);
  return isoOf(at);
}

/**
 * A calendar day `n` months on, **the day clamped to the shorter month**: 31 August and six months is
 * 28 February, as the activation's six months are (OD-120).
 */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(Math.min(d, daysIn(year, month)))}`;
}

/**
 * The plan's end: the start + the chosen period − 1 day (a Fix: the prototype always added a year,
 * `oneYearEnd`, `:579`). 8 October and six months ends on 7 April.
 */
export const planEnd = (start: string, period: BillingPeriod) =>
  addDays(addMonths(start, period === 'annual' ? 12 : 6), -1);

/** `YYYY-MM-DD` as the dialog's date fields are typed, `DD/MM/YYYY` (`formatDMY`, `:580`). */
export function toDmy(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * A date **as the quote prints it**: `8 Okt 2026` (ADR-0167 §1), from what the dialog's field holds, `08/10/2026`.
 * The field keeps the typed form; the paper writes the date the way every screen does. What is not a day is printed
 * as it was typed — `validateQuote` refuses it before a quote exists, so that is never on paper.
 */
export function quoteDay(typed: string, figures: Language = DEFAULT_LANGUAGE): string {
  const day = parseDmy(typed);
  return day ? formatCalendarDay(day, figures) : typed.trim();
}

/**
 * The card's *Save 20%*: `savePct`'s whole percent, written whole (ADR-0174 §1, OD-213) — the percentage in the
 * `figures`' language, the word in the words' (P18.98-T6).
 */
export const saveWordsIn = (
  tier: Pick<BillingTier, 'standardMinor' | 'sixMonthMinor'>,
  figures: Language,
  language: Language,
) => messagesIn(billingMessages, language).prototype.save({ pct: formatPercent(savePct(tier), {}, figures) });

/** `saveWordsIn` in English with Indonesian figures, one argument, so a list of tiers maps straight onto it. */
export const saveWords = (tier: Pick<BillingTier, 'standardMinor' | 'sixMonthMinor'>) =>
  saveWordsIn(tier, DEFAULT_LANGUAGE, SOURCE_LANGUAGE);

/**
 * `DD/MM/YYYY` as a calendar day, or `null` when it is not one — **an impossible date included**, where
 * the prototype let `31/02/2027` through as 3 March (`parseDMY`, `:581-586`).
 */
export function parseDmy(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** The date field as it is typed: digits only, the slashes inserted (`formatDateInput`, `:589-595`). */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

/** The dialog's five values, as typed. */
export interface QuoteDetails {
  kpm: string;
  pic: string;
  sales: string;
  start: string;
  end: string;
}

export type QuoteErrors = Partial<Record<keyof QuoteDetails, string>>;

/**
 * *Generate quote*'s checks (`generateQuote`, `:625-650`, and the Fixes): the three names non-empty once
 * trimmed, each date a real `DD/MM/YYYY` day, and the end on or after the start — each refusal a sentence, in the
 * reader's `language` (P18.98-T6).
 */
export function validateQuote(details: QuoteDetails, language: Language = SOURCE_LANGUAGE): QuoteErrors {
  const { prototype, own } = messagesIn(billingMessages, language);
  const errors: QuoteErrors = {};
  if (details.kpm.trim() === '') errors.kpm = prototype.kpmError;
  if (details.pic.trim() === '') errors.pic = prototype.picError;
  if (details.sales.trim() === '') errors.sales = prototype.salesError;
  const start = parseDmy(details.start);
  const end = parseDmy(details.end);
  if (!start) errors.start = own.startError;
  if (!end) errors.end = own.endError;
  else if (start && end < start) errors.end = own.endBeforeStart;
  return errors;
}

/** The dialog's two dates as it opens: the office's today + 7 days, and the plan's end from there. */
export function defaultDates(period: BillingPeriod, now: Date = new Date()): { start: string; end: string } {
  const start = addDays(officeToday(now), START_DAYS_AHEAD);
  return { start: toDmy(start), end: toDmy(planEnd(start, period)) };
}

// ---- The subscription's cost (ADR-0157 §6; `metrics-and-definitions.md` §B.16b).

/** An input a cost line needs: the price per leader, the maximum leaders, or the start and end dates. */
export type CostInput = 'price' | 'limit' | 'dates';

/** The *Edit subscription* dialog's three figures, as typed. Nothing is charged from any of them (ADR-0112). */
export interface SubscriptionCosts {
  /** Price per leader × maximum leaders, **whatever is used**. `null` without both. */
  monthlyMinor: number | null;
  /** Whole months from the start date to the day after the end date, a part month counted whole. `null` without both dates. */
  months: number | null;
  /** Monthly × months. `null` without every input. */
  totalMinor: number | null;
  /** What each figure lacks, so the line can say so; empty for a figure that is computed. */
  missing: { monthly: CostInput[]; months: CostInput[]; total: CostInput[] };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day, `YYYY-MM-DD` — 2026-02-30 is not one. */
const isCalendarDay = (day: string) => DAY.test(day) && isoOf(utcOf(day)) === day;

/**
 * **The months a subscription runs** (ADR-0157 §6): from the start date to the day after the end date, a part
 * month counted whole — a year that ends the day before its start's anniversary is 12, the 15th of January to the
 * 20th of March is 3. `null` without both dates, or with the end before the start.
 *
 * Counted by `addMonths`, the day clamped to the shorter month, so 31 January to 27 February is one month.
 */
export function subscriptionMonths(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate || !isCalendarDay(startDate) || !isCalendarDay(endDate) || endDate < startDate) return null;
  const after = addDays(endDate, 1);
  const [sy, sm] = startDate.split('-').map(Number);
  const [ay, am] = after.split('-').map(Number);
  let months = (ay * 12 + am) - (sy * 12 + sm);
  while (months > 0 && addMonths(startDate, months) > after) months -= 1;
  if (addMonths(startDate, months) < after) months += 1;
  return months;
}

/**
 * **What the subscription costs, as typed** (ADR-0157 §6): the month for the whole quota, the duration, and the
 * cost over it. One function, so the dialog and its spec read the same arithmetic; integer sen throughout
 * (invariant §9). A maximum that is not a whole number of at least one is no limit for this purpose.
 */
export function subscriptionCosts(input: {
  pricePerLeaderMinor: number | null;
  maxLeaders: number | null;
  startDate: string | null;
  endDate: string | null;
}): SubscriptionCosts {
  const price = input.pricePerLeaderMinor;
  const max = input.maxLeaders !== null && Number.isInteger(input.maxLeaders) && input.maxLeaders >= 1
    ? input.maxLeaders : null;
  const months = subscriptionMonths(input.startDate, input.endDate);

  const monthlyLacks: CostInput[] = [...(price === null ? ['price' as const] : []), ...(max === null ? ['limit' as const] : [])];
  const monthsLack: CostInput[] = months === null ? ['dates'] : [];
  const monthlyMinor = monthlyLacks.length === 0 ? (price as number) * (max as number) : null;
  return {
    monthlyMinor,
    months,
    totalMinor: monthlyMinor !== null && months !== null ? monthlyMinor * months : null,
    missing: { monthly: monthlyLacks, months: monthsLack, total: [...monthlyLacks, ...monthsLack] },
  };
}

/**
 * *— no price per leader*, *— no maximum leaders and no start and end dates*: a line that cannot be worked out — in the
 * reader's `language` (P18.98-T6; `i18n/messages/office-subscription.ts`).
 */
export function costMissingWords(missing: readonly CostInput[], language: Language = SOURCE_LANGUAGE): string {
  const words = messagesIn(officeSubscriptionMessages, language).costMissing;
  return words.joined({ parts: missing.map((m) => words[m]) });
}
