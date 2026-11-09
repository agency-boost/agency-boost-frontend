import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  automaticOf, caretAfterDigits, goalBodyOf, goalInputsOf, groupDigits, monthsLeftInWords, producedFrom, saveGoal,
  typedInForceOf, type Goal,
} from './goals';

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

  it('P18.7-T7 AC-1 says the office’s year to date in the client’s words, As of its month (grey text row 18)', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-08' }, 'year')).toBe('As of Agu 2026');
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year')).toBe('As of Okt 2026');
    // The month's own figure, a correction and a coachee's keep their words.
    expect(producedFrom({ provenance: 'imported', month: '2026-08' }, 'month')).toBe('From your office’s upload, Agu 2026');
    expect(producedFrom({ provenance: 'corrected', month: '2026-08' }, 'year'))
      .toBe('Corrected by hand, year to date as of Agu 2026');
  });

  it('P19.1-T4 AC-10 names the agent’s own figure as their estimate, which has no month — and whose it is when a leader reads it', () => {
    // UI-157 (ADR-0195): the typed figure is the member's estimate, entered on Goal Settings or the Summary.
    expect(producedFrom({ provenance: 'self_reported', month: null }, 'year')).toBe('Your own estimate, not uploaded');
    // The *Whose plan* picker passed `false` here for *Their*; the picker went in P11-T7 (D-picker), and
    // a leader reads somebody else's figure on that person's coaching tabs, in their own pronoun.
    expect(producedFrom({ provenance: 'self_reported', month: null }, 'year', 'they')).toBe('Their own estimate, not uploaded');
  });

  it('names the source alone when the payload carries no month for it', () => {
    expect(producedFrom({ provenance: 'imported', month: null }, 'month')).toBe('From your office’s upload');
  });

  /* S2 (the T17–T20 permission review): a figure a coach typed is never called the member's own. */
  it('S2 names who typed it when it was not the member — on the member’s own page and a coachee’s tab alike', () => {
    const typed = { provenance: 'self_reported' as const, month: null, typedBy: { name: 'Agus Salim' } };
    expect(producedFrom(typed, 'year')).toBe('Entered by Agus Salim, not uploaded');
    expect(producedFrom(typed, 'year', 'she')).toBe('Entered by Agus Salim, not uploaded');
    expect(producedFrom(typed, 'year', undefined, 'id', 'id')).toBe('Diisi oleh Agus Salim, bukan dari unggahan');
    // Somebody the office can no longer name is still not the member.
    expect(producedFrom({ ...typed, typedBy: { name: null } }, 'year')).toBe('Entered by a leader, not uploaded');
    expect(producedFrom({ ...typed, typedBy: { name: null } }, 'year', undefined, 'id', 'id')).toBe('Diisi oleh leader, bukan dari unggahan');
  });
});

/**
 * The same marker on a coachee's tabs (P11-T7 AC-4, AC-5): in their pronoun, and naming the upload
 * without *office* — a string coaching writes uses none of ADR-0084's six words.
 */
describe('producedFrom, about a coachee', () => {
  it('P11-T7 AC-4 names a coachee’s own figure in their pronoun', () => {
    const own = { provenance: 'self_reported', month: null } as const;
    // P19.1-T4 AC-12: the member's estimate, labelled as theirs on their coach's reading of their plan (ADR-0195 §4).
    expect(producedFrom(own, 'year', 'she')).toBe('Her own estimate, not uploaded');
    expect(producedFrom(own, 'year', 'he')).toBe('His own estimate, not uploaded');
    expect(producedFrom(own, 'month', 'they')).toBe('Their own estimate, not uploaded');
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

  it('S1 a body carries the APE produced only when this edit changed it: left out, the server keeps the stored figure', () => {
    const read = { ...inputs, apeAchievedMinor: 120_000_000_00 } as typeof inputs;
    const { apeAchievedMinor: _left, ...rest } = read;
    expect(goalBodyOf({ ...read, annualApeTargetMinor: 900_000_000_00 }, read))
      .toEqual({ ...rest, annualApeTargetMinor: 900_000_000_00 });
    expect(goalBodyOf({ ...read, apeAchievedMinor: 150_000_000_00 }, read)).toEqual({ ...read, apeAchievedMinor: 150_000_000_00 });
    // Nothing read to compare with: sent whole.
    expect(goalBodyOf(read, null)).toEqual(read);
  });

  it('P11-T8 AC-4 sends back the six inputs a goal holds, its months left only when they were typed over', () => {
    const goal = {
      ...inputs, mode: 'from_savings', monthsLeft: 2.9, monthsLeftIsOverride: false, period: '2026',
      achieved: { minor: 0, provenance: 'self_reported', month: null },
    } as unknown as Goal;
    // Nothing typed is no typed figure: `null`, the automatic one (P19.8-T5, ADR-0230).
    expect(goalInputsOf(goal)).toEqual({ ...inputs, mode: 'from_savings', monthsLeft: null, apeAchievedMinor: null });
    expect(goalInputsOf({ ...goal, monthsLeftIsOverride: true }).monthsLeft).toBe(2.9);
  });
});

/**
 * **P19.8-T5 — the typed figure in force, or the automatic one** (MOB UI-190; ADR-0230): what Goal Settings' pill holds
 * as typed, what it puts back, and where the caret goes as the figure is grouped while it is typed.
 */
describe('P19.8-T5 the APE produced on Goal Settings (ADR-0230)', () => {
  const M = 1_000_000 * 100;
  const office = { minor: 67 * M, provenance: 'imported' as const, month: '2026-10' };
  const inputs = {
    mode: 'direct' as const, annualApeTargetMinor: 500 * M, savingsTargetMinor: 0, commissionRatePct: 10, monthsLeft: null,
    caseSizeMinor: 18 * M, leadsToApptPct: 30, closingRatePct: 30,
  };
  const plan = (over: Partial<Goal>) => ({
    apeAchievedMinor: 0, achieved: { minor: 0, provenance: 'self_reported', month: null }, ...over,
  }) as Goal;

  it('P19.8-T5 AC-1 the pill holds the typed figure while it is in force, else null — the automatic figure', () => {
    // Typed after the upload: the server measures against it.
    expect(typedInForceOf(plan({ apeAchievedMinor: 120 * M, achieved: { minor: 120 * M, provenance: 'self_reported', month: null } })))
      .toBe(120 * M);
    // Typed before the upload, which replaced it: stored still, and not in force.
    expect(typedInForceOf(plan({ apeAchievedMinor: 120 * M, achieved: { ...office } }))).toBeNull();
    // Nothing typed.
    expect(typedInForceOf(plan({}))).toBeNull();
  });

  it('P19.8-T5 AC-4 the automatic figure is the office’s — from `official`, or from a reply that predates it', () => {
    expect(automaticOf(plan({ official: office, achieved: { minor: 120 * M, provenance: 'self_reported', month: null } }))).toEqual(office);
    expect(automaticOf(plan({ official: null }))).toBeNull();
    expect(automaticOf(plan({ achieved: { ...office } }))).toEqual(office);
    expect(automaticOf(plan({}))).toBeNull();
  });

  it('P19.8-T5 AC-4 Pakai otomatis, saved, sends null: the typed figure cleared', () => {
    const read = { ...inputs, apeAchievedMinor: 120 * M };
    expect(goalBodyOf({ ...read, apeAchievedMinor: null }, read)).toEqual({ ...read, apeAchievedMinor: null });
    // Put back before it was saved: the plan as read, nothing to send.
    const automatic = { ...inputs, apeAchievedMinor: null };
    expect(goalBodyOf(automatic, automatic)).not.toHaveProperty('apeAchievedMinor');
  });

  it.each([
    ['67.000.000', 0, 0],
    ['67.000.000', 1, 1],
    ['67.000.000', 2, 2],
    ['67.000.000', 3, 4],
    ['67.000.000', 8, 10],
    ['67.000.000', 12, 10],
    ['1.200', 2, 3],
  ])('P19.8-T5 AC-2 in %s the caret after %i digits is at %i — the dots skipped', (grouped, digits, at) => {
    expect(caretAfterDigits(grouped, digits)).toBe(at);
  });
});

/**
 * Months left in words (P18.7-T5 AC-5; the client's UI review, UI-018): the nearest whole month, a half rounding
 * up, and *less than a month* below half of one (`metrics-and-definitions.md`, `MONTHS_LEFT_IN_YEAR`, *Display*).
 */
describe('P18.7-T5 AC-5: monthsLeftInWords', () => {
  it.each([
    [2.2, 'about 2 months'],
    [2.5, 'about 3 months'],
    [2.49, 'about 2 months'],
    [1.4, 'about 1 month'],
    [1.5, 'about 2 months'],
    [0.5, 'about 1 month'],
    [11.9, 'about 12 months'],
    [12, 'about 12 months'],
  ])('P18.7-T5 AC-5: %s months reads %s', (months, words) => {
    expect(monthsLeftInWords(months)).toBe(words);
  });

  it.each([0.49, 0.1, 0, -1, Number.NaN])('P18.7-T5 AC-5: %s months — below half a month — reads less than a month', (months) => {
    expect(monthsLeftInWords(months)).toBe('less than a month');
  });
});

/**
 * **P18.10-T3: a goal's figures in the reader's language** (AC-1, AC-3): the provenance marker's month and a money
 * field's grouping. Indonesian when nothing is passed, as every case above; the words move with the screen (T4).
 */
describe('P18.10-T3 a goal in each language', () => {
  it('P18.10-T3 AC-1 writes the marker’s month in the reader’s language', () => {
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year', undefined, 'en')).toBe('As of Oct 2026');
    expect(producedFrom({ provenance: 'imported', month: '2026-08' }, 'month', undefined, 'en')).toBe('From your office’s upload, Aug 2026');
    expect(producedFrom({ provenance: 'imported', month: '2026-10' }, 'year', undefined, 'id')).toBe('As of Okt 2026');
  });

  it('P18.10-T3 AC-3 groups a money field’s digits in the reader’s marks', () => {
    expect(groupDigits(500_000_000)).toBe('500.000.000');
    expect(groupDigits(500_000_000, 'en')).toBe('500,000,000');
  });
});
