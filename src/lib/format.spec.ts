import { describe, expect, it } from 'vitest';
import { formatCalendarDay, formatDay, formatDayLong } from './format';

describe('formatDay', () => {
  it('writes a date the way the prototype does', () => {
    // `Overall.html:5457-5461`. It had drifted to en-GB — `4 Sep 2026`.
    expect(formatDay('2026-09-04')).toBe('Sep 4, 2026');
  });

  it('is the same shape whatever the reader’s language is', () => {
    // A date that changes shape with the browser's locale cannot be lined up in a column.
    expect(formatDay('2026-01-31')).toBe('Jan 31, 2026');
    expect(formatDay('2026-12-01')).toBe('Dec 1, 2026');
  });

  it('answers empty for something that is not a date, rather than "Invalid Date"', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('not a date')).toBe('');
  });
});

describe('formatDayLong', () => {
  it('spells the month out, for a sentence rather than a column', () => {
    expect(formatDayLong('2026-09-13')).toBe('September 13, 2026');
  });

  it('answers empty for something that is not a date', () => {
    expect(formatDayLong('nope')).toBe('');
  });
});

describe('formatCalendarDay', () => {
  it('spells an office calendar day for a sentence', () => {
    expect(formatCalendarDay('2026-10-07')).toBe('October 7, 2026');
  });

  it('never slips a day, whatever zone the browser is in — it is not an instant', () => {
    // Built from its numbers: there is no midnight-UTC to fall back across.
    expect(formatCalendarDay('2026-01-01')).toBe('January 1, 2026');
  });

  it('gives nothing for something that is not a day', () => {
    expect(formatCalendarDay('')).toBe('');
    expect(formatCalendarDay('soon')).toBe('');
  });
});

