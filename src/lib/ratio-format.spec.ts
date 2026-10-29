import { describe, expect, it } from 'vitest';
import {
  benchmarkFromInput, benchmarkToInput, formatBenchmark, formatRatioForStatus, formatRatioValue, reexpress,
  unitFor,
} from '@/lib/ratio-format';

/*
 * P4-T25. Each of the five seeded benchmarks written the way `metrics-and-definitions.md`
 * states it — the defect was that the screens printed `0.15` for a success rate. The client's
 * benchmarks since ADR-0160 §2, and *Set appointment to meeting* a percent. **As typed since
 * ADR-0174 §2** (P18.97-T3 AC-2): *30%*, never *30,0%*; a number keeps its two places.
 */
describe('formatBenchmark', () => {
  it.each([
    ['Selling success rate', 0.3, 'percent', '30%'],
    ['Recruitment success rate', 0.3, 'percent', '30%'],
    ['Leads per activity', 1, 'decimal', '1,00'],
    ['Set appointment to meeting', 0.5, 'percent', '50%'],
    ['Selling vs Recruitment', 30, 'points', '±30 points'],
    // The prototype's, which an office that kept them still holds.
    ['a success rate at 15%', 0.15, 'percent', '15%'],
    ['Meeting per approach at 1.50', 1.5, 'decimal', '1,50'],
  ] as const)('P18.97-T3 AC-2 writes %s as typed, %s', (_, value, unit, text) => {
    expect(formatBenchmark(value, unit)).toBe(text);
  });

  it('P18.97-T3 AC-2 keeps the places a percentage benchmark was typed with, and only those', () => {
    expect(formatBenchmark(0.155, 'percent')).toBe('15,5%');
    expect(formatBenchmark(0.1525, 'percent')).toBe('15,25%');
    expect(formatBenchmark(0.57, 'percent')).toBe('57%');
    expect(formatBenchmark(0.3, 'decimal')).toBe('0,30');
  });

  it('keeps a half point where one was set, and adds none where it was not', () => {
    expect(formatBenchmark(22.5, 'points')).toBe('±22,5 points');
  });

  it('does not print floating-point noise', () => {
    expect(formatBenchmark(0.155, 'percent')).toBe('15,5%');
  });
});

describe('the input is typed the way it is shown', () => {
  it('asks for 15, not 0.15, for a percentage', () => {
    expect(benchmarkToInput(0.15, 'percent')).toBe('15');
    expect(benchmarkFromInput('15', 'percent')).toBe(0.15);
  });

  it('round-trips a fractional percentage without drift', () => {
    expect(benchmarkFromInput(benchmarkToInput(0.155, 'percent'), 'percent')).toBe(0.155);
  });

  it('leaves a number and a points band as typed, its decimal a comma (ADR-0167 §1)', () => {
    expect(benchmarkToInput(0.3, 'decimal')).toBe('0,3');
    expect(benchmarkToInput(0.155, 'percent')).toBe('15,5');
    expect(benchmarkFromInput('1.5', 'decimal')).toBe(1.5);
    expect(benchmarkFromInput('30', 'points')).toBe(30);
  });

  it('P18.95-T1 AC-3 takes a comma or a point for the decimal', () => {
    expect(benchmarkFromInput('1,5', 'decimal')).toBe(1.5);
    expect(benchmarkFromInput('15,5', 'percent')).toBe(0.155);
    expect(benchmarkFromInput('15.5', 'percent')).toBe(0.155);
    expect(benchmarkFromInput('22,5', 'points')).toBe(22.5);
  });

  it('P18.95-T1 AC-3 reads a single point as a decimal, never as thousands — a benchmark is a small value', () => {
    expect(benchmarkFromInput('1.250', 'decimal')).toBe(1.25);
    expect(benchmarkFromInput('1,2,5', 'decimal')).toBeNaN();
  });

  it('reads a cleared field as not-a-number, never as zero', () => {
    // `Number('')` is 0, and "on track at or above 0%" would save without complaint.
    expect(benchmarkFromInput('', 'percent')).toBeNaN();
    expect(benchmarkFromInput('   ', 'decimal')).toBeNaN();
    expect(benchmarkFromInput('abc', 'decimal')).toBeNaN();
  });
});

describe('reexpress', () => {
  it('keeps the value and changes its spelling when the unit changes', () => {
    expect(reexpress('0.3', 'decimal', 'percent')).toBe('30');
    expect(reexpress('0,3', 'decimal', 'percent')).toBe('30');
    expect(reexpress('30', 'percent', 'decimal')).toBe('0,3');
  });

  it('leaves text that is not a number alone, so the reader can finish typing', () => {
    expect(reexpress('', 'decimal', 'percent')).toBe('');
  });
});

describe('unitFor', () => {
  it('reads the unit the API sent', () => {
    expect(unitFor({ displayUnit: 'percent', comparison: 'gte' })).toBe('percent');
  });

  it('makes a band points whatever it carries', () => {
    expect(unitFor({ displayUnit: 'percent', comparison: 'band' })).toBe('points');
  });

  it('falls back to decimal for a snapshot published before units existed', () => {
    // Printing the stored value unchanged — never multiplying one that should not be.
    expect(unitFor({ comparison: 'gte' })).toBe('decimal');
  });
});

describe('formatRatioValue (P10-T2)', () => {
  it('P18.97-T3 AC-2 keeps a rate’s tenth — it is read against its benchmark — and a number’s two places', () => {
    expect(formatRatioValue(0.0909, 'percent')).toBe('9,1%');
    expect(formatRatioValue(0.296, 'percent')).toBe('29,6%');
    expect(formatRatioValue(0.3, 'percent')).toBe('30,0%');
    expect(formatRatioValue(0, 'percent')).toBe('0,0%');
    expect(formatRatioValue(0.375, 'decimal')).toBe('0,38');
    expect(formatRatioValue(2.25, 'decimal')).toBe('2,25');
    expect(formatRatioValue(2.125, 'decimal')).toBe('2,13');
  });

  it('writes the balance’s lean in whole points, without a sign', () => {
    expect(formatRatioValue(-24.4, 'points')).toBe('24 points');
    expect(formatRatioValue(1, 'points')).toBe('1 point');
    expect(formatRatioValue(0, 'points')).toBe('0 points');
  });

  it('writes not enough data as a dash, never as zero', () => {
    expect(formatRatioValue(null, 'percent')).toBe('–');
    expect(formatRatioValue(null, 'points')).toBe('–');
  });
});

describe('formatRatioForStatus — a rounded figure never reads as the other side of its status', () => {
  it('writes one more decimal where a miss would round onto the benchmark', () => {
    expect(formatRatioForStatus(8 / 27, 'decimal', 0.3, 'alert')).toBe('0,296');
    expect(formatRatioForStatus(0.1496, 'percent', 0.15, 'alert')).toBe('14,96%');
  });

  it('P18.97-T3 AC-2 compares the figure as written with the benchmark as a number: 30,0% beside 30% is a tie', () => {
    // The two are written apart on purpose (a ratio keeps its tenth, a benchmark reads as typed), so the texts
    // never match; the numbers do, and a miss that reads 30,0% beside *Benchmark: 30%* takes the extra place.
    expect(formatRatioForStatus(0.2996, 'percent', 0.3, 'alert')).toBe('29,96%');
    expect(formatRatioForStatus(0.296, 'percent', 0.3, 'alert')).toBe('29,6%');
    expect(formatRatioForStatus(0.5696, 'percent', 0.57, 'alert')).toBe('56,96%');
  });

  it('P18.97-T3 AC-2 takes the extra place where the tenth would pass a benchmark typed to two places', () => {
    // 15,56% is below a 15,58% benchmark, and its tenth, 15,6%, would read above it.
    expect(formatRatioForStatus(0.1556, 'percent', 0.1558, 'alert')).toBe('15,56%');
    expect(formatRatioForStatus(0.1553, 'percent', 0.1558, 'alert')).toBe('15,5%');
  });

  it('writes a lean just outside the band with its decimal, and one well outside as whole points', () => {
    expect(formatRatioForStatus(30.43, 'points', 30, 'alert')).toBe('30,4 points');
    expect(formatRatioForStatus(-48, 'points', 30, 'alert')).toBe('48 points');
  });

  it('leaves an on-track figure, a clear miss and not enough data as they are', () => {
    expect(formatRatioForStatus(0.3, 'decimal', 0.3, 'success')).toBe('0,30');
    expect(formatRatioForStatus(0.09, 'percent', 0.15, 'alert')).toBe('9,0%');
    expect(formatRatioForStatus(null, 'percent', 0.15, 'neutral')).toBe('–');
  });
});


/**
 * **P18.98-T3: a ratio and its benchmark in each language** (ADR-0174 §6; the glossary's §E). Indonesian is every
 * case above, unchanged; English writes the same figure with a point — *29.6%*, *0.30*, *±30 points* — to the same
 * places. The words beside a figure (*points*) are the catalogue's, and move with their screens (P18.98-T4).
 */
describe('P18.98-T3 a ratio in each language', () => {
  it.each([
    [0.3, 'percent', '30%', '30%'],
    [0.155, 'percent', '15,5%', '15.5%'],
    [1, 'decimal', '1,00', '1.00'],
    [1.5, 'decimal', '1,50', '1.50'],
    [30, 'points', '±30 points', '±30 points'],
    [25.5, 'points', '±25,5 points', '±25.5 points'],
  ] as const)('P18.98-T3 AC-1 writes a benchmark of %d (%s) as %s, and %s in English', (value, unit, id, en) => {
    expect(formatBenchmark(value, unit, 'id')).toBe(id);
    expect(formatBenchmark(value, unit, 'en')).toBe(en);
  });

  it('P18.98-T3 AC-1 writes a computed ratio 29.6% and 0.38 in English, its tenth and its two places kept', () => {
    expect(formatRatioValue(0.296, 'percent', 'en')).toBe('29.6%');
    expect(formatRatioValue(0.3, 'percent', 'en')).toBe('30.0%');
    expect(formatRatioValue(0.38, 'decimal', 'en')).toBe('0.38');
    expect(formatRatioValue(24.4, 'points', 'en')).toBe('24 points');
    expect(formatRatioValue(null, 'percent', 'en')).toBe('–');
  });

  it('P18.98-T3 AC-2 adds the same place in both languages where the rounding would reach the benchmark', () => {
    // 8 ÷ 27 is 0.296: below 0.30, so neither language may write 0,30 or 0.30.
    expect(formatRatioForStatus(8 / 27, 'decimal', 0.3, 'alert', 'id')).toBe('0,296');
    expect(formatRatioForStatus(8 / 27, 'decimal', 0.3, 'alert', 'en')).toBe('0.296');
    expect(formatRatioForStatus(0.2996, 'percent', 0.3, 'alert', 'id')).toBe('29,96%');
    expect(formatRatioForStatus(0.2996, 'percent', 0.3, 'alert', 'en')).toBe('29.96%');
    expect(formatRatioForStatus(30.43, 'points', 30, 'alert', 'en')).toBe('30.4 points');
    // A ratio far below its benchmark, or on track, keeps its own places in both.
    expect(formatRatioForStatus(0.25, 'percent', 0.3, 'alert', 'en')).toBe('25.0%');
    expect(formatRatioForStatus(0.31, 'percent', 0.3, 'success', 'en')).toBe('31.0%');
  });

  it('P18.98-T3 AC-2 reads the figure back by its Indonesian writing, so a grouped English figure decides nothing differently', () => {
    // 12,345% — a figure past a thousand, grouped `12.345,0%` and `12,345.0%`: the same places in both.
    const id = formatRatioForStatus(123.45, 'percent', 124, 'alert', 'id');
    const en = formatRatioForStatus(123.45, 'percent', 124, 'alert', 'en');
    expect(id).toBe('12.345,0%');
    expect(en).toBe('12,345.0%');
  });

  it('P18.98-T3 AC-3 puts a stored benchmark in its input in the reader’s mark, and reads either mark back', () => {
    expect(benchmarkToInput(0.155, 'percent', 'id')).toBe('15,5');
    expect(benchmarkToInput(0.155, 'percent', 'en')).toBe('15.5');
    expect(benchmarkToInput(0.3, 'decimal', 'en')).toBe('0.3');
    expect(benchmarkFromInput('15.5', 'percent')).toBe(0.155);
    expect(benchmarkFromInput('15,5', 'percent')).toBe(0.155);
    expect(reexpress('0.3', 'decimal', 'percent', 'en')).toBe('30');
    expect(reexpress('15.5', 'percent', 'decimal', 'en')).toBe('0.155');
    expect(reexpress('15,5', 'percent', 'decimal', 'id')).toBe('0,155');
  });
});
