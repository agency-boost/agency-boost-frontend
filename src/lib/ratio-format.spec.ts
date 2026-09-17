import { describe, expect, it } from 'vitest';
import {
  benchmarkFromInput, benchmarkToInput, formatBenchmark, reexpress, unitFor,
} from '@/lib/ratio-format';

/*
 * P4-T25. Each of the five seeded benchmarks written the way `metrics-and-definitions.md`
 * states it — the defect was that the screens printed `0.15` for a success rate.
 */
describe('formatBenchmark', () => {
  it.each([
    ['Selling success rate', 0.15, 'percent', '15.0%'],
    ['Recruitment success rate', 0.15, 'percent', '15.0%'],
    ['Leads per activity', 0.3, 'decimal', '0.30'],
    ['Meeting per approach', 1.5, 'decimal', '1.50'],
    ['Selling vs Recruitment', 30, 'points', '±30 points'],
  ] as const)('writes %s as %s', (_, value, unit, text) => {
    expect(formatBenchmark(value, unit)).toBe(text);
  });

  it('keeps a half point where one was set, and adds none where it was not', () => {
    expect(formatBenchmark(22.5, 'points')).toBe('±22.5 points');
  });

  it('does not print floating-point noise', () => {
    expect(formatBenchmark(0.155, 'percent')).toBe('15.5%');
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

  it('leaves a number and a points band as typed', () => {
    expect(benchmarkToInput(0.3, 'decimal')).toBe('0.3');
    expect(benchmarkFromInput('1.5', 'decimal')).toBe(1.5);
    expect(benchmarkFromInput('30', 'points')).toBe(30);
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
    expect(reexpress('30', 'percent', 'decimal')).toBe('0.3');
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
