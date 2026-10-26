import { describe, expect, it } from 'vitest';
import {
  benchmarkFromInput, benchmarkToInput, formatBenchmark, formatRatioForStatus, formatRatioValue, reexpress,
  unitFor,
} from '@/lib/ratio-format';

/*
 * P4-T25. Each of the five seeded benchmarks written the way `metrics-and-definitions.md`
 * states it — the defect was that the screens printed `0.15` for a success rate. The client's
 * benchmarks since ADR-0160 §2, and *Set appointment to meeting* a percent.
 */
describe('formatBenchmark', () => {
  it.each([
    ['Selling success rate', 0.3, 'percent', '30,0%'],
    ['Recruitment success rate', 0.3, 'percent', '30,0%'],
    ['Leads per activity', 1, 'decimal', '1,00'],
    ['Set appointment to meeting', 0.5, 'percent', '50,0%'],
    ['Selling vs Recruitment', 30, 'points', '±30 points'],
    // The prototype's, which an office that kept them still holds.
    ['a success rate at 15%', 0.15, 'percent', '15,0%'],
    ['Meeting per approach at 1.50', 1.5, 'decimal', '1,50'],
  ] as const)('writes %s as %s', (_, value, unit, text) => {
    expect(formatBenchmark(value, unit)).toBe(text);
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
  it('writes a rate as its benchmark is written', () => {
    expect(formatRatioValue(0.0909, 'percent')).toBe('9,1%');
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

