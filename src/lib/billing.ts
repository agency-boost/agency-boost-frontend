import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { officeSubscriptionMessages } from '@/i18n/messages/office-subscription';
import { api, apiBlob } from './api-client';
import { dayInZone, OFFICE_TIME_ZONE } from './format';

/**
 * **Langganan & akses** at `/admin/billing` (P19.23-T5; ADR-0279; `functional/billing.md`): the price list and the
 * calculator's numbers, the one pure function that prices the calculator, *Langganan per KPM*, *Konfirmasi paket*,
 * *Buat PDF* and *Kirim penawaran*'s WhatsApp link.
 *
 * **Every number is the server's** (invariant §7): the tiers, the annual discount, the per-day divisor and rounding and
 * *Balik modal*'s parts arrive with `GET /admin/billing/prices`, and `priceOffer` below is held to the backend's own
 * function by one shared fixture (`backend/src/modules/billing/price-offer.fixture.json`). What *Konfirmasi paket* stores
 * and *Buat PDF* prints is priced again on the server from the same inputs.
 */

/** One tier of the price list (`BillingTierDto`). `null` prices: *Harga khusus*. */
export interface BillingTier {
  code: string;
  minLeaders: number;
  maxLeaders: number | null;
  standardMinor: number | null;
  offerMinor: number | null;
  customPricing: boolean;
}

/** `GET /admin/billing/prices` (`BillingPricesDto`): the list and every number the calculator works with. */
export interface BillingPrices {
  currency: 'IDR';
  tiers: BillingTier[];
  annualDiscountPct: number;
  trialDays: number;
  graceDays: number;
  endingSoonDays: number;
  daysPerMonth: number;
  perDayRoundingMinor: number;
  bulkPercentMax: number;
  noteMax: number;
  kpmNameMax: number;
  countMax: number;
  rateMaxMinor: number;
  breakEven: {
    policyApeMinor: number; commissionPct: number; overridingPct: number; bonusPct: number; incomePerPolicyMinor: number;
  };
}

export const readBillingPrices = () => api<BillingPrices>('/admin/billing/prices');

/** A plan as the API carries it: *Tahunan* or *6 bulan*. */
export type SubscriptionPlan = 'six_months' | 'annual';

/** The months a plan runs. */
export const planMonths = (plan: SubscriptionPlan): 6 | 12 => (plan === 'annual' ? 12 : 6);

/*
 * ── The arithmetic (ADR-0279 §2) ─────────────────────────────────────────────────────────────────
 */

/** How the price is typed: per leader per month, or as the period's total before the bulk discount (*isi total*). */
export type OfferPrice = { mode: 'per_leader'; rateMinor: number } | { mode: 'total'; totalMinor: number };
/** *Diskon bulk order*: a whole percent, or an amount in sen. */
export type BulkDiscount = { type: 'percent'; percent: number } | { type: 'amount'; amountMinor: number };

export interface OfferInput {
  leaders: number;
  agents: number | null;
  plan: SubscriptionPlan;
  price: OfferPrice;
  bulk: BulkDiscount | null;
}

/** Every figure the result card draws, in integer IDR minor units — the server's `OfferPricing`, field for field. */
export interface OfferPricing {
  leaders: number;
  agents: number | null;
  plan: SubscriptionPlan;
  months: 6 | 12;
  tier: BillingTier;
  rateMinor: number;
  priceMode: OfferPrice['mode'];
  normalMinor: number | null;
  grossMinor: number;
  priceDiscountMinor: number;
  annualDiscountMinor: number;
  bulkDiscountMinor: number;
  totalMinor: number;
  savingMinor: number;
  savingPct: number;
  perMonthMinor: number;
  perLeaderPerDayMinor: number;
  perAgentPerDayMinor: number | null;
  breakEven: { incomePerPolicyMinor: number; policiesPerPeriodTenths: number; policiesPerMonthTenths: number };
}

/** The input that cannot be priced, so the field can say so. */
export type OfferField =
  | 'leaders' | 'agents' | 'price.rateMinor' | 'price.totalMinor' | 'bulk.percent' | 'bulk.amountMinor';

export class OfferInputError extends Error {
  constructor(readonly field: OfferField) {
    super(`The offer cannot be priced: ${field} is out of bounds.`);
  }
}

const SEN = 100;
const halfUp = (a: number, b: number) => Math.floor((2 * a + b) / (2 * b));

/** The first tier whose bounds hold the count, else the first. */
export function tierFor(tiers: readonly BillingTier[], count: number): BillingTier {
  return tiers.find((t) => count >= t.minLeaders && (t.maxLeaders === null || count <= t.maxLeaders)) ?? tiers[0];
}

/** *1–10 leader*, *101+ leader*: a tier's name, from its bounds. */
export function tierRange(tier: Pick<BillingTier, 'minLeaders' | 'maxLeaders'>): string {
  return tier.maxLeaders === null ? `${tier.minLeaders}+` : `${tier.minLeaders}–${tier.maxLeaders}`;
}

/** A card's *Hemat 20%*: the offer price's saving on the standard, a whole percent rounded half up; `null` on 101+. */
export function tierSavePct(tier: Pick<BillingTier, 'standardMinor' | 'offerMinor'>): number | null {
  if (tier.standardMinor === null || tier.offerMinor === null) return null;
  return halfUp((tier.standardMinor - tier.offerMinor) * 100, tier.standardMinor);
}

function wholeRupiah(minor: number, field: OfferField): number {
  if (!Number.isSafeInteger(minor) || minor < 0 || minor % SEN !== 0) throw new OfferInputError(field);
  return minor / SEN;
}

function count(value: number, min: number, max: number, field: OfferField): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new OfferInputError(field);
  return value;
}

/**
 * **The one pricing function in the browser** (ADR-0279 §2) — the backend's `priceOffer`, line for line, with its numbers
 * read from `GET /admin/billing/prices`. Whole rupiah, in integers; an input out of bounds throws `OfferInputError`.
 */
export function priceOffer(prices: BillingPrices, input: OfferInput): OfferPricing {
  const leaders = count(input.leaders, 1, prices.countMax, 'leaders');
  const agents = input.agents === null || input.agents === 0 ? null : count(input.agents, 1, prices.countMax, 'agents');
  const months = planMonths(input.plan);
  const annualPct = input.plan === 'annual' ? prices.annualDiscountPct : 0;
  const tier = tierFor(prices.tiers, leaders);
  const rateMax = prices.rateMaxMinor / SEN;

  let rate: number;
  let gross: number;
  let annual: number;
  let afterAnnual: number;
  if (input.price.mode === 'per_leader') {
    rate = wholeRupiah(input.price.rateMinor, 'price.rateMinor');
    if (rate > rateMax) throw new OfferInputError('price.rateMinor');
    gross = leaders * rate * months;
    annual = halfUp(gross * annualPct, 100);
    afterAnnual = gross - annual;
  } else {
    afterAnnual = wholeRupiah(input.price.totalMinor, 'price.totalMinor');
    if (afterAnnual > rateMax * leaders * months) throw new OfferInputError('price.totalMinor');
    gross = halfUp(afterAnnual * 100, 100 - annualPct);
    annual = gross - afterAnnual;
    rate = halfUp(gross, leaders * months);
  }

  let bulk = 0;
  if (input.bulk?.type === 'percent') {
    const { percent } = input.bulk;
    if (!Number.isSafeInteger(percent) || percent < 0 || percent > prices.bulkPercentMax) throw new OfferInputError('bulk.percent');
    bulk = halfUp(afterAnnual * percent, 100);
  } else if (input.bulk?.type === 'amount') {
    bulk = wholeRupiah(input.bulk.amountMinor, 'bulk.amountMinor');
    if (bulk > afterAnnual) throw new OfferInputError('bulk.amountMinor');
  }
  const total = afterAnnual - bulk;

  const standard = tier.standardMinor === null ? null : tier.standardMinor / SEN;
  const normal = standard === null ? null : leaders * standard * months;
  const priceDiscount = normal !== null && normal > gross ? normal - gross : 0;
  const saving = normal !== null && normal > total ? normal - total : 0;
  const step = prices.perDayRoundingMinor / SEN;
  const perDay = (heads: number) => halfUp(total, months * prices.daysPerMonth * heads * step) * prices.perDayRoundingMinor;
  const income = prices.breakEven.incomePerPolicyMinor / SEN;

  return {
    leaders,
    agents,
    plan: input.plan,
    months,
    tier,
    rateMinor: rate * SEN,
    priceMode: input.price.mode,
    normalMinor: normal === null ? null : normal * SEN,
    grossMinor: gross * SEN,
    priceDiscountMinor: priceDiscount * SEN,
    annualDiscountMinor: annual * SEN,
    bulkDiscountMinor: bulk * SEN,
    totalMinor: total * SEN,
    savingMinor: saving * SEN,
    savingPct: normal ? halfUp(saving * 100, normal) : 0,
    perMonthMinor: halfUp(total, months) * SEN,
    perLeaderPerDayMinor: perDay(leaders),
    perAgentPerDayMinor: agents === null ? null : perDay(agents),
    breakEven: {
      incomePerPolicyMinor: prices.breakEven.incomePerPolicyMinor,
      policiesPerPeriodTenths: halfUp(total * 10, income),
      policiesPerMonthTenths: halfUp(total * 10, income * months),
    },
  };
}

/**
 * *Balik modal*'s policies as the card writes them: **one decimal below ten, a whole number from ten** (*8,0*, *0,7*,
 * *11*), the decimal mark the figures' language's — *8.0* in English.
 */
export function policiesText(tenths: number, figures: Language): string {
  if (tenths >= 100) return String(Math.floor((tenths + 5) / 10));
  return `${Math.floor(tenths / 10)}${figures === 'en' ? '.' : ','}${tenths % 10}`;
}

/** One line of the breakdown: which, and its sum; the caller writes the words. They sum to the total exactly. */
export type BreakdownLine =
  | { kind: 'normal'; minor: number }
  | { kind: 'gross'; minor: number }
  | { kind: 'priceDiscount'; minor: number }
  | { kind: 'annual'; minor: number }
  | { kind: 'bulk'; minor: number };

/**
 * **The breakdown** (*Harga normal → Diskon harga → Hemat tahunan 5% → Diskon bulk order → Total*): from *Harga normal*
 * when the price is at or below the standard, else from leaders × price × months — *Harga khusus*, or a price above it.
 */
export function breakdownOf(p: OfferPricing): BreakdownLine[] {
  const lines: BreakdownLine[] = [];
  if (p.normalMinor !== null && p.normalMinor >= p.grossMinor) {
    lines.push({ kind: 'normal', minor: p.normalMinor });
    if (p.priceDiscountMinor > 0) lines.push({ kind: 'priceDiscount', minor: p.priceDiscountMinor });
  } else {
    lines.push({ kind: 'gross', minor: p.grossMinor });
  }
  if (p.annualDiscountMinor > 0) lines.push({ kind: 'annual', minor: p.annualDiscountMinor });
  if (p.bulkDiscountMinor > 0) lines.push({ kind: 'bulk', minor: p.bulkDiscountMinor });
  return lines;
}

/**
 * Rupiah typed into a money field, as whole rupiah: digits and the grouping marks either language writes, nothing else.
 * `null` for anything that is not an amount; `0` for empty.
 */
export function rupiahOf(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  if (!/^[\d.,\s]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/[.,\s]/g, '');
  return digits === '' ? null : Number(digits);
}

/** A whole number typed into a count field, or `null` when it is not one (empty is `null` too). */
export function wholeOf(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/*
 * ── Dates (invariant §9) ─────────────────────────────────────────────────────────────────────────
 *
 * Calendar days are `YYYY-MM-DD` strings worked on as three numbers in UTC, so the browser's zone moves nothing; *today*
 * is the office's, `Asia/Jakarta` (ADR-0016), never the browser's.
 */

/** The office's today, `YYYY-MM-DD`. *Mulai* starts here (ADR-0279 §2). */
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

/** A calendar day `n` months on, **the day clamped to the shorter month**: 31 August and six months is 28 February. */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(Math.min(d, daysIn(year, month)))}`;
}

/** The *Edit subscription* dialog's period names (ADR-0211 §1). */
export type BillingPeriod = 'sixMonth' | 'annual';

/**
 * The plan's end: the start + the period − 1 day, the last day it serves. 20 November and a year ends on 19 November;
 * 8 October and six months on 7 April.
 */
export const planEnd = (start: string, period: BillingPeriod) =>
  addDays(addMonths(start, period === 'annual' ? 12 : 6), -1);

/** A subscription's plan as the dialog's period. */
export const planPeriodOf = (plan: SubscriptionPlan): BillingPeriod => (plan === 'annual' ? 'annual' : 'sixMonth');

/** A plan's end from its start, by the plan's own code. */
export const endOfPlan = (start: string, plan: SubscriptionPlan) => planEnd(start, planPeriodOf(plan));

/** A real calendar day, `YYYY-MM-DD` — 2026-02-30 is not one. */
export const isCalendarDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && isoOf(utcOf(day)) === day;

/*
 * ── Langganan per KPM (ADR-0279 §6) ──────────────────────────────────────────────────────────────
 */

/** The one pill a row carries, or why it is on *Perlu tindakan*. */
export type BillingAttention = 'suspended' | 'ended' | 'over' | 'trial' | 'ending_soon';

/** One row of `GET /admin/billing/kpms` (`BillingKpmRowDto`). */
export interface BillingKpmRow {
  kpmId: string;
  code: string;
  branch: string;
  company: { id: string; name: string };
  kpmStatus: 'active' | 'suspended';
  owner: { fullName: string; phone: string | null } | null;
  leadersUsed: number;
  maxLeaders: number | null;
  tier: { code: string; minLeaders: number; maxLeaders: number | null };
  rateMinor: number | null;
  customPrice: boolean;
  plan: SubscriptionPlan | null;
  trial: boolean;
  startDate: string | null;
  endDate: string | null;
  perMonthMinor: number | null;
  periodTotalMinor: number | null;
  graceEndsOn: string | null;
  attention: BillingAttention | null;
  needsAction: boolean;
  agents: number | null;
  bulkDiscount: BulkDiscount | null;
  note: string | null;
}

export interface BillingSummary {
  monthlyRevenueMinor: number;
  payingKpms: number;
  leadersBilled: number;
  endingSoon: number;
  needsAction: number;
  kpms: number;
}

export interface BillingTotal {
  kpms: number;
  leadersUsed: number;
  weightedRateMinor: number | null;
  perMonthMinor: number;
  periodTotalMinor: number;
  needsAction: number;
}

export interface BillingKpmList {
  summary: BillingSummary;
  total: BillingTotal;
  rows: BillingKpmRow[];
}

export type BillingKpmFilter = 'all' | 'needs_action';

/** `GET /admin/billing/kpms?filter=`: the Super Admin's alone (`billing:read_prices`). */
export const listBillingKpms = (filter: BillingKpmFilter = 'all') =>
  api<BillingKpmList>(`/admin/billing/kpms${filter === 'all' ? '' : `?filter=${filter}`}`);

/** The calculator's inputs as the two writes take them — no figure: the server prices them. */
export interface OfferBody extends OfferInput {
  startDate: string;
  endDate: string;
  note: string | null;
}

/** *Konfirmasi paket* / *Pakai untuk KPM*: `PUT /admin/billing/kpms/:kpmId/subscription` (`kpm:update_subscription`). */
export const confirmPackage = (kpmId: string, body: OfferBody) =>
  api<BillingKpmRow>(`/admin/billing/kpms/${encodeURIComponent(kpmId)}/subscription`, { method: 'PUT', body });

/** *Buat PDF*: `POST /admin/billing/offer` (`billing:send_quote`) — the PDF itself, for an existing KPM or a new name. */
export const offerPdf = (body: OfferBody & { kpmId?: string; kpmName?: string }) =>
  apiBlob('/admin/billing/offer', { method: 'POST', body });

/**
 * ***Kirim penawaran*** (OD-359): a `wa.me` link — to the Owner's number when there is one, or to nobody, so WhatsApp
 * asks whom to send it to — carrying the offer's words. The number's digits only, a leading `0` read as Indonesia's.
 */
export function whatsappLink(phone: string | null, text: string): string {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^0/, '62');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// ---- The subscription's cost (ADR-0157 §6; `metrics-and-definitions.md` §B.16b) — the *Edit subscription* dialog's.

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

/**
 * **The months a subscription runs** (ADR-0157 §6): from the start date to the day after the end date, a part month
 * counted whole. `null` without both dates, or with the end before the start.
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

/** **What the subscription costs, as typed** (ADR-0157 §6): the month for the whole quota, the duration, the cost. */
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

/** *— no price per leader*, *— no maximum leaders and no start and end dates*: a line that cannot be worked out. */
export function costMissingWords(missing: readonly CostInput[], language: Language = SOURCE_LANGUAGE): string {
  const words = messagesIn(officeSubscriptionMessages, language).costMissing;
  return words.joined({ parts: missing.map((m) => words[m]) });
}
