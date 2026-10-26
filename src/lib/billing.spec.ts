import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, BILLING_OWN_COPY, START_DAYS_AHEAD, costMissingWords, defaultDates, leaderCountOf, maskAmount,
  maskDate, money, officeToday, parseDmy, perLeaderDiscount, planEnd, priceQuote, quoteDay, savePct, saveWords, subscriptionCosts,
  subscriptionMonths, tierFor, tierLabel, toDmy, validateQuote,
  type BillingTier, type CalculatorInput,
} from './billing';

/**
 * The quote tool's arithmetic (P13.2-T2 AC-3; ADR-0111 §4) and its dates (AC-6).
 *
 * The table below is what `GET /admin/billing/prices` serves, the prototype's `:420-426` in sen; the
 * backend's `billing.spec.ts` pins the constant, and this file pins what the screen does with it.
 */
const rp = (major: number) => major * 100;
const TIERS: BillingTier[] = [
  { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), sixMonthMinor: rp(400_000), annualMinor: rp(380_000), customPricing: false },
  { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), sixMonthMinor: rp(375_000), annualMinor: rp(356_250), customPricing: false },
  { code: 'TIER_21_50', minLeaders: 21, maxLeaders: 50, standardMinor: rp(450_000), sixMonthMinor: rp(350_000), annualMinor: rp(332_500), customPricing: false },
  { code: 'TIER_51_100', minLeaders: 51, maxLeaders: 100, standardMinor: rp(425_000), sixMonthMinor: rp(300_000), annualMinor: rp(285_000), customPricing: false },
  { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: rp(375_000), sixMonthMinor: rp(250_000), annualMinor: rp(237_500), customPricing: true },
];
const PRICES = { tiers: TIERS };

const input = (over: Partial<CalculatorInput> = {}): CalculatorInput => ({
  leaders: '8', period: 'sixMonth', discountType: 'percent', discount: '0', ...over,
});
const priced = (over: Partial<CalculatorInput> = {}) => priceQuote(PRICES, input(over));

describe('the pricing function (P13.2-T2 AC-3)', () => {
  /*
   * `docs/01-flows/billing.md` §4.2, row by row. Every rate here is a whole rupiah, so ours and the
   * prototype's agree to the rupiah — but for the 13-leader case below.
   */
  it.each([
    ['8 · 6-month · none (the page as it opens)', input(), 400_000, 3_200_000, 19_200_000],
    ['8 · Annual · none', input({ period: 'annual' }), 380_000, 3_040_000, 36_480_000],
    ['8 · Annual · 10%', input({ period: 'annual', discount: '10' }), 342_000, 2_736_000, 32_832_000],
    ['15 · 6-month · Rp 25,000', input({ leaders: '15', discountType: 'flat', discount: '25.000' }), 350_000, 5_250_000, 31_500_000],
    ['120 · 6-month · none', input({ leaders: '120' }), 250_000, 30_000_000, 180_000_000],
  ])('reproduces the flow doc’s %s', (_name, given, rate, monthly, period) => {
    const p = priceQuote(PRICES, given);
    expect([p.finalMinor, p.monthlyTotalMinor, p.periodTotalMinor]).toEqual([rp(rate), rp(monthly), rp(period)]);
    expect(p.discountError).toBeNull();
  });

  it('the registered Fix: 13 leaders, Annual, 7% — the rate rounded once, half up, and every total exact', () => {
    // The prototype: Rp 331.313 a leader, *Rp 4.307.063* a month (13 × 331,312.5, rounded only for
    // display), Rp 51.684.750 a year — a printed rate × count that is not the printed total.
    const p = priced({ leaders: '13', period: 'annual', discount: '7' });

    expect(p.finalMinor).toBe(rp(331_313));
    expect(p.monthlyTotalMinor).toBe(rp(4_307_069));
    expect(p.monthlyTotalMinor).toBe(p.finalMinor * 13);
    expect(p.periodTotalMinor).toBe(rp(51_684_828));
    expect(p.periodTotalMinor).toBe(p.monthlyTotalMinor * 12);
    expect(p.manualDiscountMinor).toBe(rp(356_250 - 331_313));
  });

  it('rounds half up exactly, where a float would round a half-rupiah down', () => {
    // 356,250 × 99.8% = 355,537.5. In floating point 99.8 is a hair under, and the product rounds to
    // 355,537; the exact arithmetic rounds the half up.
    expect(priced({ leaders: '13', period: 'annual', discount: '0,2' }).finalMinor).toBe(rp(355_538));
    // Below a half goes down and above it up: 400,000 less 33.3334375% is 266,666.25, less 33.3333125%
    // is 266,666.75.
    expect(priced({ discount: '33,3334375' }).finalMinor).toBe(rp(266_666));
    expect(priced({ discount: '33,3333125' }).finalMinor).toBe(rp(266_667));
  });

  it('prices every figure in whole rupiah and integer sen', () => {
    for (const leaders of ['1', '13', '47', '99', '250']) {
      for (const discount of ['0', '7', '10,5', '33,333', '99,99']) {
        const p = priced({ leaders, period: 'annual', discount });
        for (const minor of [p.finalMinor, p.monthlyTotalMinor, p.periodTotalMinor, p.manualDiscountMinor]) {
          expect([leaders, discount, Number.isInteger(minor), minor % 100]).toEqual([leaders, discount, true, 0]);
        }
      }
    }
  });

  it('names the tier at every edge: 1, 10, 11, 20, 21, 50, 51, 100 and 101', () => {
    const at = (n: number) => tierFor(TIERS, n).code;
    expect([1, 10, 11, 20, 21, 50, 51, 100, 101].map(at)).toEqual([
      'TIER_1_10', 'TIER_1_10', 'TIER_11_20', 'TIER_11_20', 'TIER_21_50', 'TIER_21_50',
      'TIER_51_100', 'TIER_51_100', 'TIER_101_PLUS',
    ]);
    expect(at(100_000)).toBe('TIER_101_PLUS');
    expect(TIERS.map(tierLabel)).toEqual(['1–10', '11–20', '21–50', '51–100', '101+']);
  });

  it('charges the inversions as the table says: 20 leaders cost more a month than 21', () => {
    expect(priced({ leaders: '20' }).monthlyTotalMinor).toBeGreaterThan(priced({ leaders: '21' }).monthlyTotalMinor);
  });

  it('*Save n%* is 20, 21, 22 and 29 down the four public cards, rounded half up', () => {
    expect(TIERS.slice(0, 4).map(savePct)).toEqual([20, 21, 22, 29]);
  });

  it.each([
    ['empty', '', 1], ['zero', '0', 1], ['a negative', '-4', 1], ['letters', 'abc', 1],
    ['a decimal, cut as the prototype cuts it', '8.9', 8], ['an exponent, as parseInt reads it', '1e3', 1],
    ['a count', '42', 42],
  ])('reads %s as %s leader(s), never below 1', (_name, text, count) => {
    expect(leaderCountOf(text)).toBe(count);
    expect(priced({ leaders: text }).leaders).toBe(count);
  });

  it('prices a count below 1 as one leader in the first tier', () => {
    const p = priced({ leaders: '0' });
    expect([p.leaders, p.tier.code, p.monthlyTotalMinor]).toEqual([1, 'TIER_1_10', rp(400_000)]);
  });

  it('on Annual the base is the annual rate, the offer still the six-month, and the annual discount their difference', () => {
    const p = priced({ period: 'annual' });
    expect([p.offerMinor, p.baseMinor, p.annualDiscountMinor, p.months]).toEqual([rp(400_000), rp(380_000), rp(20_000), 12]);
    expect(priced().annualDiscountMinor).toBe(0);
    expect(priced().months).toBe(6);
    // Rp 20.000, 18.750, 17.500, 15.000 and 12.500 down the tiers (§4.3).
    expect(['8', '15', '30', '60', '150'].map((leaders) => priced({ leaders, period: 'annual' }).annualDiscountMinor))
      .toEqual([20_000, 18_750, 17_500, 15_000, 12_500].map(rp));
  });

  describe('the discount bounds (ADR-0111 §5)', () => {
    it.each([['0'], ['100'], ['55,5'], ['55.5'], ['10,'], [',5'], ['']])('accepts %j as a percent', (discount) => {
      expect(priced({ discount }).discountError).toBeNull();
    });

    it('reads a decimal comma as a decimal: 10,5 is 10.5%, never 105%', () => {
      expect(priced({ discount: '10,5' }).finalMinor).toBe(rp(358_000));
    });

    it('100% prices the rate at Rp 0, and nothing below it', () => {
      const p = priced({ discount: '100' });
      expect([p.finalMinor, p.monthlyTotalMinor, p.periodTotalMinor]).toEqual([0, 0, 0]);
    });

    it.each([['100,01'], ['100.5'], ['150'], ['-5'], ['ten'], ['1,2,3'], ['5%']])('refuses %j as a percent, pricing without it', (discount) => {
      const p = priced({ discount });
      expect(p.discountError).toBe(BILLING_OWN_COPY.percentError);
      expect(p.finalMinor).toBe(rp(400_000));
      expect(p.manualDiscountMinor).toBe(0);
    });

    it('accepts an amount from Rp 0 to the period’s rate, the rate itself pricing at Rp 0', () => {
      expect(priced({ discountType: 'flat', discount: '400.000' }).finalMinor).toBe(0);
      expect(priced({ discountType: 'flat', discount: '' }).finalMinor).toBe(rp(400_000));
      expect(priced({ discountType: 'flat', discount: '0' }).discountError).toBeNull();
    });

    it('refuses an amount above the rate, naming the rate, where the prototype gave Rp 0 in silence', () => {
      const p = priced({ discountType: 'flat', discount: '400.001' });
      expect(p.discountError).toBe('Enter an amount from Rp 0 to Rp 400.000.');
      expect(p.finalMinor).toBe(rp(400_000));
      // On Annual the bound is the annual rate.
      expect(priced({ period: 'annual', discountType: 'flat', discount: '390.000' }).discountError)
        .toBe('Enter an amount from Rp 0 to Rp 380.000.');
    });

    it('refuses anything but digits in the amount', () => {
      expect(priced({ discountType: 'flat', discount: '25,000' }).discountError).not.toBeNull();
      expect(priced({ discountType: 'flat', discount: '-1' }).discountError).not.toBeNull();
    });
  });

  it('formats the amount as it is typed, in the product’s grouping', () => {
    expect(maskAmount('25000')).toBe('25.000');
    expect(maskAmount('2a5,0.00')).toBe('25.000');
    expect(maskAmount('')).toBe('');
  });

  it('prints money and a per-leader discount as the page does', () => {
    expect(money(rp(3_200_000))).toBe('Rp 3.200.000');
    expect(perLeaderDiscount(rp(20_000))).toBe('-Rp 20.000/leader/mo');
  });
});

describe('the dialog’s dates (P13.2-T2 AC-6)', () => {
  it('today is the office’s, in Asia/Jakarta, not the browser’s or UTC', () => {
    // 18:30 UTC on 7 October is 01:30 on the 8th in Jakarta.
    expect(officeToday(new Date('2026-10-07T18:30:00Z'))).toBe('2026-10-08');
    expect(officeToday(new Date('2026-10-07T16:59:00Z'))).toBe('2026-10-07');
  });

  it('opens on today + 7 days, and the end the start + the period − 1 day', () => {
    // `START_DAYS_AHEAD` (`metrics-and-definitions.md` §B.15), the prototype's `addDays(new Date(), 7)` (`:602`).
    expect(START_DAYS_AHEAD).toBe(7);
    const now = new Date('2026-10-07T03:00:00Z');
    expect(defaultDates('sixMonth', now)).toEqual({ start: '14/10/2026', end: '13/04/2027' });
    expect(defaultDates('annual', now)).toEqual({ start: '14/10/2026', end: '13/10/2027' });
    // Late in the evening in Jakarta the office is already on the next day.
    expect(defaultDates('sixMonth', new Date('2026-10-07T18:00:00Z')).start).toBe('15/10/2026');
  });

  it('ends a month-end start on the shorter month’s last day, less one', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(planEnd('2026-08-31', 'sixMonth')).toBe('2027-02-27');
    expect(addMonths('2027-11-30', 3)).toBe('2028-02-29');
    expect(planEnd('2028-02-29', 'annual')).toBe('2029-02-27');
    expect(planEnd('2026-01-01', 'annual')).toBe('2026-12-31');
  });

  it('adds and takes days across a month and a year', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('writes and reads DD/MM/YYYY, refusing an impossible day', () => {
    expect(toDmy('2026-10-14')).toBe('14/10/2026');
    expect(parseDmy('14/10/2026')).toBe('2026-10-14');
    expect(parseDmy('29/02/2028')).toBe('2028-02-29');
    for (const bad of ['31/02/2027', '29/02/2027', '99/99/9999', '00/10/2026', '14/13/2026', '14/10/26', '14-10-2026', '']) {
      expect([bad, parseDmy(bad)]).toEqual([bad, null]);
    }
  });

  it('inserts the slashes as the date is typed, digits only, eight at most', () => {
    expect(maskDate('1')).toBe('1');
    expect(maskDate('141')).toBe('14/1');
    expect(maskDate('14102')).toBe('14/10/2');
    expect(maskDate('14/10/2026')).toBe('14/10/2026');
    expect(maskDate('1410202699')).toBe('14/10/2026');
    expect(maskDate('ab')).toBe('');
  });

  it('validates the five values, each refusal with its sentence', () => {
    const ok = { kpm: 'Jakarta Selatan', pic: 'Andi Wijaya', sales: 'Maya', start: '14/10/2026', end: '13/04/2027' };
    expect(validateQuote(ok)).toEqual({});
    expect(validateQuote({ kpm: ' ', pic: '', sales: '\t', start: '31/02/2027', end: '1/1/2027' })).toEqual({
      kpm: 'Enter the KPM name.',
      pic: 'Enter the PIC name.',
      sales: "Enter who's submitting this quote.",
      start: BILLING_OWN_COPY.startError,
      end: BILLING_OWN_COPY.endError,
    });
    expect(validateQuote({ ...ok, end: '13/10/2026' })).toEqual({ end: BILLING_OWN_COPY.endBeforeStart });
    // The same day is a one-day plan, not a refusal.
    expect(validateQuote({ ...ok, end: '14/10/2026' })).toEqual({});
  });
});

/*
 * P18.8-T3 AC-1, AC-3 (ADR-0157 §6): the *Edit subscription* dialog's three cost lines — the month for the whole
 * quota, the duration and the cost over it — and why a line reads *—*.
 */
describe('the subscription’s cost (P18.8-T3)', () => {
  const costs = (over: Partial<Parameters<typeof subscriptionCosts>[0]> = {}) => subscriptionCosts({
    pricePerLeaderMinor: rp(350_000), maxLeaders: 10, startDate: '2026-01-06', endDate: '2027-01-05', ...over,
  });

  it('AC-1 a whole year: Rp 3.500.000 a month for ten leaders, 12 months, Rp 42.000.000 over them', () => {
    expect(costs()).toEqual({
      monthlyMinor: rp(3_500_000), months: 12, totalMinor: rp(42_000_000),
      missing: { monthly: [], months: [], total: [] },
    });
  });

  it('AC-1 the month is the whole quota, whatever is used', () => {
    expect(costs({ maxLeaders: 13 }).monthlyMinor).toBe(rp(4_550_000));
  });

  it('AC-1 a part month counts whole', () => {
    expect(subscriptionMonths('2026-01-15', '2026-03-20')).toBe(3);
    expect(subscriptionMonths('2026-01-15', '2026-03-14')).toBe(2);
    expect(subscriptionMonths('2026-03-01', '2026-03-01')).toBe(1);
    // Clamped to the shorter month, as `addMonths` is: 31 January to 27 February is one month.
    expect(subscriptionMonths('2026-01-31', '2026-02-27')).toBe(1);
    expect(subscriptionMonths('2026-01-31', '2026-02-28')).toBe(2);
    expect(costs({ startDate: '2026-01-15', endDate: '2026-03-20' }).totalMinor).toBe(rp(10_500_000));
  });

  it('AC-1 no limit: no month and no total, and says the limit is what is missing', () => {
    expect(costs({ maxLeaders: null })).toMatchObject({
      monthlyMinor: null, months: 12, totalMinor: null, missing: { monthly: ['limit'], total: ['limit'] },
    });
    expect(costs({ maxLeaders: 0 }).missing.monthly).toEqual(['limit']);
    expect(costs({ maxLeaders: 2.5 }).missing.monthly).toEqual(['limit']);
  });

  it('AC-1 no price: likewise, naming the price', () => {
    expect(costs({ pricePerLeaderMinor: null })).toMatchObject({
      monthlyMinor: null, months: 12, totalMinor: null, missing: { monthly: ['price'], total: ['price'] },
    });
    // A price of nothing is a price: the office pays nothing.
    expect(costs({ pricePerLeaderMinor: 0 }).totalMinor).toBe(0);
  });

  it('AC-1 no dates, or an end before the start: no duration and no total', () => {
    expect(costs({ startDate: null, endDate: null })).toMatchObject({
      monthlyMinor: rp(3_500_000), months: null, totalMinor: null, missing: { months: ['dates'], total: ['dates'] },
    });
    expect(costs({ endDate: '2025-12-31' }).months).toBeNull();
    expect(costs({ endDate: '2026-02-30' }).months).toBeNull();
  });

  it('AC-2 names what a line lacks', () => {
    expect(costMissingWords(['price'])).toBe('— no price per leader');
    expect(costMissingWords(['price', 'limit', 'dates']))
      .toBe('— no price per leader and no maximum leaders and no start and end dates');
  });
});

/** ADR-0167 §1: the quote's paper writes dates as every screen does; the card's saving to one decimal. */
describe('the quote’s dates and the cards’ saving in id-ID (P18.95-T1 AC-1, AC-3)', () => {
  it('prints a typed DD/MM/YYYY date as `15 Okt 2026`, and what is not a day as it was typed', () => {
    expect(quoteDay('15/10/2026')).toBe('15 Okt 2026');
    expect(quoteDay(' 14/04/2027 ')).toBe('14 Apr 2027');
    expect(quoteDay('31/02/2027')).toBe('31/02/2027');
  });

  it('writes the six-month saving as `Save 20,0%`, from the registry’s whole percent', () => {
    expect(TIERS.slice(0, 4).map(saveWords)).toEqual(['Save 20,0%', 'Save 21,0%', 'Save 22,0%', 'Save 29,0%']);
  });

  it('keeps every price in full: a price is exact, and the quote is a document', () => {
    expect(money(40_000_000)).toBe('Rp 400.000');
    expect(perLeaderDiscount(1_875_000)).toBe('-Rp 18.750/leader/mo');
  });
});
