import { describe, expect, it } from 'vitest';
import { producedFrom } from './goals';

/**
 * The provenance marker's words (ADR-0063 §5, P10.1-T6 AC-1): where the APE produced came from, and
 * for which month — one set of words for the Summary and Goal Settings alike.
 */
describe('producedFrom', () => {
  it('names the office’s upload and the month it is for', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-09' }, 'month')).toBe('From your office’s upload, September 2026');
  });

  it('names a correction by the office', () => {
    expect(producedFrom({ provenance: 'corrected', month: '2026-09' }, 'month')).toBe('Corrected by your office, September 2026');
  });

  it('says a year’s figure is the year to date as of its month', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-08' }, 'year'))
      .toBe('From your office’s upload, year to date as of August 2026');
    expect(producedFrom({ provenance: 'corrected', month: '2026-08' }, 'year'))
      .toBe('Corrected by your office, year to date as of August 2026');
  });

  it('names the agent’s own figure, which has no month — and whose it is when a leader reads it', () => {
    expect(producedFrom({ provenance: 'self_reported', month: null }, 'year')).toBe('Your own figure, entered in Goal Settings');
    expect(producedFrom({ provenance: 'self_reported', month: null }, 'year', false)).toBe('Their own figure, entered in Goal Settings');
  });

  it('names the source alone when the payload carries no month for it', () => {
    expect(producedFrom({ provenance: 'imported', month: null }, 'month')).toBe('From your office’s upload');
  });
});
