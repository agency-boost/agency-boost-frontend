import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, breakdownOf, costMissingWords, endOfPlan, isCalendarDay, OfferInputError, officeToday, planEnd,
  planMonths, planPeriodOf, policiesText, priceOffer, rupiahOf, subscriptionCosts, subscriptionMonths, tierFor, tierRange,
  tierSavePct, wholeOf, whatsappLink,
  type BillingPrices, type OfferInput,
} from './billing';

/**
 * **Langganan & akses in the browser** (P19.23-T5 AC-2, AC-3; ADR-0279 §2): the calculator's arithmetic, held to the
 * backend's own function by one fixture; the cards' saving; the dates; *Kirim penawaran*'s link; and the *Edit
 * subscription* dialog's costs, which this module still serves.
 *
 * The prices below are what `GET /admin/billing/prices` serves — the backend's `billing.spec.ts` pins the constants.
 */
const rp = (major: number) => major * 100;
const PRICES: BillingPrices = {
  currency: 'IDR',
  tiers: [
    { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), offerMinor: rp(400_000), customPricing: false },
    { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), offerMinor: rp(375_000), customPricing: false },
    { code: 'TIER_21_50', minLeaders: 21, maxLeaders: 50, standardMinor: rp(450_000), offerMinor: rp(350_000), customPricing: false },
    { code: 'TIER_51_100', minLeaders: 51, maxLeaders: 100, standardMinor: rp(425_000), offerMinor: rp(300_000), customPricing: false },
    { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: null, offerMinor: null, customPricing: true },
  ],
  annualDiscountPct: 5,
  trialDays: 30,
  graceDays: 7,
  endingSoonDays: 30,
  daysPerMonth: 30,
  perDayRoundingMinor: rp(100),
  bulkPercentMax: 100,
  noteMax: 500,
  kpmNameMax: 120,
  countMax: 10_000,
  rateMaxMinor: rp(100_000_000),
  breakEven: { policyApeMinor: rp(20_000_000), commissionPct: 20, overridingPct: 10, bonusPct: 10, incomePerPolicyMinor: rp(8_000_000) },
};

/**
 * **One fixture, two copies of the function** (ADR-0279 §2; invariant §7): the server prices what *Konfirmasi paket*
 * stores and *Buat PDF* prints (`backend/src/modules/billing/price-offer.ts`), and this module's `priceOffer` prices the
 * calculator as it is typed. Both read `price-offer.fixture.json` from the backend's tree.
 */
describe('P19.23-T5 AC-2 the calculator prices the server’s fixture', () => {
  interface FixtureCase { case: string; input: OfferInput; expected: Record<string, unknown> }
  interface FixtureRefusal { case: string; input: OfferInput; field: string }
  const fixture = JSON.parse(readFileSync(
    join(__dirname, '..', '..', '..', 'backend', 'src', 'modules', 'billing', 'price-offer.fixture.json'), 'utf8',
  )) as { cases: FixtureCase[]; refusals: FixtureRefusal[] };

  it('reads the fixture at all', () => {
    expect(fixture.cases.length).toBeGreaterThan(10);
    expect(fixture.refusals.length).toBeGreaterThan(5);
  });

  it.each(fixture.cases.map((c) => [c.case, c] as const))('P19.23-T5 AC-2 %s', (_name, c) => {
    const { tier, leaders, agents, plan, ...figures } = priceOffer(PRICES, c.input);
    expect({ tierCode: tier.code, ...figures }).toEqual(c.expected);
    expect([leaders, agents, plan]).toEqual([c.input.leaders, c.input.agents, c.input.plan]);
  });

  it.each(fixture.refusals.map((r) => [r.case, r] as const))('P19.23-T5 AC-2 refuses %s, naming the field', (_name, r) => {
    let field: string | null = null;
    try {
      priceOffer(PRICES, r.input);
    } catch (err) {
      expect(err).toBeInstanceOf(OfferInputError);
      field = (err as OfferInputError).field;
    }
    expect(field).toBe(r.field);
  });
});

describe('P19.23-T5 the calculator’s parts', () => {
  const frame45: OfferInput = {
    leaders: 22, agents: 80, plan: 'annual', price: { mode: 'per_leader', rateMinor: rp(350_000) }, bulk: null,
  };

  it('AC-2 Balik modal: one decimal below ten policies, a whole number from ten, in the figures’ marks', () => {
    expect([policiesText(80, 'id'), policiesText(7, 'id'), policiesText(110, 'id'), policiesText(80, 'en')])
      .toEqual(['8,0', '0,7', '11', '8.0']);
  });

  it('AC-2 the breakdown reads Harga normal → Diskon harga → Hemat tahunan, and sums to the total', () => {
    const p = priceOffer(PRICES, frame45);
    expect(breakdownOf(p)).toEqual([
      { kind: 'normal', minor: rp(118_800_000) },
      { kind: 'priceDiscount', minor: rp(26_400_000) },
      { kind: 'annual', minor: rp(4_620_000) },
    ]);
    const custom = priceOffer(PRICES, { ...frame45, leaders: 120, price: { mode: 'per_leader', rateMinor: rp(250_000) }, bulk: { type: 'percent', percent: 10 } });
    expect(breakdownOf(custom).map((l) => l.kind)).toEqual(['gross', 'annual', 'bulk']);
    const lines = breakdownOf(custom);
    expect(lines[0].minor - lines[1].minor - lines[2].minor).toBe(custom.totalMinor);
  });

  it('AC-3 the cards: the tier a count falls in, its name, and its saving — 20%, 21%, 22%, 29%, none on 101+', () => {
    expect([1, 10, 11, 22, 51, 101].map((n) => tierFor(PRICES.tiers, n).code))
      .toEqual(['TIER_1_10', 'TIER_1_10', 'TIER_11_20', 'TIER_21_50', 'TIER_51_100', 'TIER_101_PLUS']);
    expect(PRICES.tiers.map(tierRange)).toEqual(['1–10', '11–20', '21–50', '51–100', '101+']);
    expect(PRICES.tiers.map(tierSavePct)).toEqual([20, 21, 22, 29, null]);
  });

  it('AC-2 reads what is typed: rupiah with either language’s marks, a whole count', () => {
    expect([rupiahOf('375.000'), rupiahOf('375,000'), rupiahOf(''), rupiahOf('3,5x')]).toEqual([375_000, 375_000, 0, null]);
    expect([wholeOf('22'), wholeOf(''), wholeOf('2.5'), wholeOf(' 7 ')]).toEqual([22, null, null, 7]);
  });

  it('AC-2 the dates: start today in Jakarta, the end the period’s last day, both real days', () => {
    // 23:30 on 19 November in UTC is 06:30 on the 20th in Jakarta.
    expect(officeToday(new Date('2026-11-19T23:30:00Z'))).toBe('2026-11-20');
    expect(endOfPlan('2026-11-20', 'annual')).toBe('2027-11-19');
    expect(endOfPlan('2026-11-20', 'six_months')).toBe('2027-05-19');
    expect(planEnd('2026-08-31', planPeriodOf('six_months'))).toBe('2027-02-27');
    expect([planMonths('annual'), planMonths('six_months')]).toEqual([12, 6]);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect([isCalendarDay('2026-02-28'), isCalendarDay('2026-02-30'), isCalendarDay('20-11-2026')]).toEqual([true, false, false]);
  });

  it('AC-2 Kirim penawaran opens WhatsApp to the Owner, or to nobody, with the words', () => {
    expect(whatsappLink('+62 811-2000-300', 'Halo Budi')).toBe('https://wa.me/628112000300?text=Halo%20Budi');
    expect(whatsappLink('0811 2000 300', 'x')).toBe('https://wa.me/628112000300?text=x');
    expect(whatsappLink(null, 'Halo,\nbaris dua')).toBe('https://wa.me/?text=Halo%2C%0Abaris%20dua');
  });
});

/*
 * P18.5-T3 AC-1, AC-3 (ADR-0157 §6): the *Edit subscription* dialog's three cost lines — the month for the whole
 * quota, the duration and the cost over it — and why a line reads *—*.
 */
describe('the subscription’s cost (P18.5-T3)', () => {
  const costs = (over: Partial<Parameters<typeof subscriptionCosts>[0]> = {}) => subscriptionCosts({
    pricePerLeaderMinor: rp(350_000), maxLeaders: 10, startDate: '2026-01-06', endDate: '2027-01-05', ...over,
  });

  it('AC-1 a whole year: Rp 3.500.000 a month for ten leaders, 12 months, Rp 42.000.000 over them', () => {
    expect(costs()).toEqual({
      monthlyMinor: rp(3_500_000), months: 12, totalMinor: rp(42_000_000),
      missing: { monthly: [], months: [], total: [] },
    });
  });

  it('AC-1 a part month counts whole', () => {
    expect(subscriptionMonths('2026-01-15', '2026-03-20')).toBe(3);
    expect(subscriptionMonths('2026-01-15', '2026-03-14')).toBe(2);
    expect(subscriptionMonths('2026-01-31', '2026-02-27')).toBe(1);
  });

  it('AC-1 no limit, no price or no dates: the line says what is missing', () => {
    expect(costs({ maxLeaders: null }).missing.monthly).toEqual(['limit']);
    expect(costs({ pricePerLeaderMinor: null }).missing.total).toEqual(['price']);
    expect(costs({ startDate: null, endDate: null }).missing.months).toEqual(['dates']);
    expect(costs({ endDate: '2026-02-30' }).months).toBeNull();
  });

  it('AC-2 names what a line lacks', () => {
    expect(costMissingWords(['price'])).toBe('— no price per leader');
    expect(costMissingWords(['price', 'limit', 'dates']))
      .toBe('— no price per leader and no maximum leaders and no start and end dates');
  });
});
