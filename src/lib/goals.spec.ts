import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { goalInputsOf, producedFrom, saveGoal, type Goal } from './goals';

/**
 * The provenance marker's words (ADR-0063 §5, P10.1-T6 AC-1): where the APE produced came from, and
 * for which month — one set of words for the Summary and Goal Settings alike.
 */
describe('producedFrom', () => {
  it('names the office’s upload and the month it is for', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-09' }, 'month')).toBe('From your office’s upload, Sep 2026');
  });

  it('names a correction by hand, and who made it when the payload says (ADR-0121, F-156)', () => {
    expect(producedFrom({ provenance: 'corrected', month: '2026-09' }, 'month')).toBe('Corrected by hand, Sep 2026');
    expect(producedFrom({ provenance: 'corrected', month: '2026-09', correctedBy: { name: 'Sari Puspita' } }, 'month'))
      .toBe('Corrected by Sari Puspita, Sep 2026');
    expect(producedFrom({ provenance: 'corrected', month: '2026-09', correctedBy: null }, 'month'))
      .toBe('Corrected by hand, Sep 2026');
    // A name rides on a correction only: the file's own figure names nobody.
    expect(producedFrom({ provenance: 'imported', month: '2026-09', correctedBy: { name: 'Sari Puspita' } }, 'month'))
      .toBe('From your office’s upload, Sep 2026');
  });

  it('says a year’s figure is the year to date as of its month', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-08' }, 'year'))
      .toBe('From your office’s upload, year to date as of Agu 2026');
    expect(producedFrom({ provenance: 'corrected', month: '2026-08' }, 'year'))
      .toBe('Corrected by hand, year to date as of Agu 2026');
  });

  it('names the agent’s own figure, which has no month — and whose it is when a leader reads it', () => {
    expect(producedFrom({ provenance: 'self_reported', month: null }, 'year')).toBe('Your own figure, entered in Goal Settings');
    // The *Whose plan* picker passed `false` here for *Their*; the picker went in P11-T7 (D-picker), and
    // a leader reads somebody else's figure on that person's coaching tabs, in their own pronoun.
    expect(producedFrom({ provenance: 'self_reported', month: null }, 'year', 'they')).toBe('Their own figure, entered in Goal Settings');
  });

  it('names the source alone when the payload carries no month for it', () => {
    expect(producedFrom({ provenance: 'imported', month: null }, 'month')).toBe('From your office’s upload');
  });
});

/**
 * The same marker on a coachee's tabs (P11-T7 AC-4, AC-5): in their pronoun, and naming the upload
 * without *office* — a string coaching writes uses none of ADR-0084's six words.
 */
describe('producedFrom, about a coachee', () => {
  it('P11-T7 AC-4 names a coachee’s own figure in their pronoun', () => {
    const own = { provenance: 'self_reported', month: null } as const;
    expect(producedFrom(own, 'year', 'she')).toBe('Her own figure, entered in Goal Settings');
    expect(producedFrom(own, 'year', 'he')).toBe('His own figure, entered in Goal Settings');
    expect(producedFrom(own, 'month', 'they')).toBe('Their own figure, entered in Goal Settings');
  });

  it('P11-T7 AC-4 names the upload and a correction of it without ADR-0084’s six words', () => {
    const words = [
      producedFrom({ provenance: 'imported', month: '2026-09' }, 'month', 'she'),
      producedFrom({ provenance: 'corrected', month: '2026-08' }, 'year', 'he'),
      producedFrom({ provenance: 'imported', month: null }, 'year', 'they'),
    ];
    expect(words).toEqual([
      'From the production upload, Sep 2026',
      'Corrected after the production upload, year to date as of Agu 2026',
      'From the production upload',
    ]);
    expect(producedFrom({ provenance: 'corrected', month: '2026-08', correctedBy: { name: 'Sari Puspita' } }, 'year', 'they'))
      .toBe('Corrected after the production upload, year to date as of Agu 2026, by Sari Puspita');
    for (const w of words) expect(w).not.toMatch(/office|KPM|reports to|tagged to|untagged|unassigned/i);
  });
});

describe('saving a plan from a coaching session (P11-T8 AC-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const inputs = {
    mode: 'direct' as const, annualApeTargetMinor: 100, savingsTargetMinor: 0, commissionRatePct: 10, monthsLeft: null,
    apeAchievedMinor: 0, caseSizeMinor: 10, leadsToApptPct: 30, closingRatePct: 30,
  };

  it('P11-T8 AC-4 names the session beside the coachee, so the saves of one session are one notice', async () => {
    const { calls } = stubFetch({ '/goals/': { body: {} } });
    await saveGoal('2026', inputs, 'mem-rina', 's-1');
    await saveGoal('2026', inputs, 'mem-rina');
    await saveGoal('2026', inputs);
    expect(calls.map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', '')])).toEqual([
      ['PUT', '/goals/2026?for=mem-rina&session=s-1'],
      ['PUT', '/goals/2026?for=mem-rina'],
      ['PUT', '/goals/2026'],
    ]);
  });

  it('P11-T8 AC-4 sends back the six inputs a goal holds, its months left only when they were typed over', () => {
    const goal = {
      ...inputs, mode: 'from_savings', monthsLeft: 2.9, monthsLeftIsOverride: false, period: '2026',
    } as unknown as Goal;
    expect(goalInputsOf(goal)).toEqual({ ...inputs, mode: 'from_savings', monthsLeft: null });
    expect(goalInputsOf({ ...goal, monthsLeftIsOverride: true }).monthsLeft).toBe(2.9);
  });
});
