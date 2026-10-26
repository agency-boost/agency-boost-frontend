import { describe, expect, it } from 'vitest';
import {
  coachedWords, daysAgoWords, inTeam, lastLoggedWords, leftOutWords, markerAt, moreWords, newThisMonth, officeLine,
  ofTarget, parseTarget, pctText, projectedWords, recruitPill, rungShort, showingWords, targetLegend,
  toneOf, trendWords, unitNums,
} from './kpm-overview';

const rp = (millions: number) => Math.round(millions * 1_000_000 * 100);

/**
 * P18-T1: the words the KPM Overview builds from the server's figures. Each is the prototype's sentence
 * (`KPM_Owner.html:936-1222`, `:4875-4889`) or, where the prototype draws a number it cannot have, the
 * honest form of it — a dash over nobody, *Not uploaded yet* for a file not held, never a 0.
 */
describe('KPM Overview words (P18-T1)', () => {
  it('AC-2: the sub-line is composed from the office, as the prototype writes it (`:933`)', () => {
    expect(officeLine({ companyName: 'Prudential', code: '0417', branch: 'BSD City Branch' }))
      .toBe('Prudential · KPM 0417 — BSD City Branch');
  });

  it('AC-3: *"+{n} new this month"* (`:946`)', () => {
    expect(newThisMonth(6)).toBe('+6 new this month');
    expect(newThisMonth(0)).toBe('+0 new this month');
  });

  describe('the trend against last month to the same day (AC-4, D-figures)', () => {
    it('AC-4: Up, with the rise relative to last month, rounded — 142 against 138 is +3,0% (`:977`; ADR-0167 §1)', () => {
      expect(trendWords(142, 138)).toEqual({ direction: 'up', lead: 'Up from 138 last month', change: '+3,0%' });
    });

    it('AC-4: Down, with the fall', () => {
      expect(trendWords(120, 150)).toEqual({ direction: 'down', lead: 'Down from 150 last month', change: '−20,0%' });
    });

    it('AC-4: the same count is said as the same, with no percentage', () => {
      expect(trendWords(40, 40)).toEqual({ direction: 'same', lead: 'Same as last month (40)', change: null });
    });

    it('AC-9: nothing logged by this day last month gives no percentage to divide by', () => {
      expect(trendWords(5, 0)).toEqual({ direction: 'up', lead: 'Up from 0 last month', change: null });
    });

    it('AC-4: nothing to compare against draws no line', () => {
      expect(trendWords(5, null)).toBeNull();
    });
  });

  describe('the not-logged list (AC-4)', () => {
    it('AC-4: *"Last logged {n} days ago"* or *"Never logged"* (`:991-999`)', () => {
      expect(lastLoggedWords(9)).toBe('Last logged 9 days ago');
      expect(lastLoggedWords(1)).toBe('Last logged 1 day ago');
      expect(lastLoggedWords(null)).toBe('Never logged');
    });

    it('AC-4: the more-line, verbatim with its count (`:1001`)', () => {
      expect(moreWords(66)).toBe('+ 66 more — full list on the People screen');
    });

    it('AC-4: a rung after a name is its short form — AAB, Agent — as the prototype writes it', () => {
      expect(rungShort({ code: 'AAB', label: 'Associate Agency Builder' })).toBe('AAB');
      expect(rungShort({ code: 'AGENT', label: 'Agent' })).toBe('Agent');
      expect(rungShort({ code: 'AB', label: 'Agency Builder' })).toBe('AB');
    });
  });

  describe('coverage and the leaderboard (AC-5)', () => {
    it('AC-5: *"· {n} in team"* and *"{c}/{n} · {p}%"* (`:1027-1029`), the percentage to one decimal', () => {
      expect(inTeam(31)).toBe('· 31 in team');
      expect(coachedWords({ coached: 6, teamSize: 31, pct: 19 })).toBe('6/31 · 19,0%');
      expect(coachedWords({ coached: 0, teamSize: 0, pct: null })).toBe('0/0 · —');
    });

    it('AC-5 (D-copy): the count of ABs is counted, not the prototype’s 8 (`:1045`)', () => {
      expect(showingWords(4, 11)).toBe('Showing 4 of 11 ABs · ');
    });

    it('AC-5: the status colours split at the prototype’s 70% (`:3150`, `:3220`), and nobody is neither', () => {
      // The split is the API's (`thresholds.statusSplitPct`, `KPM_REPORTING.STATUS_SPLIT_PCT`), never the screen's.
      expect(toneOf(76, 70)).toBe('success');
      expect(toneOf(70, 70)).toBe('success');
      expect(toneOf(69, 70)).toBe('alert');
      expect(toneOf(0, 70)).toBe('alert');
      expect(toneOf(null, 70)).toBe('neutral');
      expect(toneOf(76, 80)).toBe('alert');
    });

    it('AC-9: a rate over nobody is a dash, never 0%', () => {
      expect(pctText(null)).toBe('—');
      expect(pctText(0)).toBe('0,0%');
      expect(pctText(57.5)).toBe('57,5%');
    });
  });

  describe('the recruitment pill and target (AC-6)', () => {
    it('AC-6: the three sentences of `updateRecruitStatus()`, verbatim (`:4875-4889`)', () => {
      expect(recruitPill(13, 15)).toEqual({ tone: 'alert', text: '2 short of target (13 of 15)' });
      expect(recruitPill(13, 13)).toEqual({ tone: 'success', text: 'On track to hit target (13 of 13)' });
      expect(recruitPill(13, 10)).toEqual({ tone: 'success', text: '3 ahead of target (13 of 10)' });
    });

    it('AC-6 (D-recruit): no pill without a target', () => {
      expect(recruitPill(13, null)).toBeNull();
    });

    it('AC-11: a target is a whole number from 0, and nothing else is sent', () => {
      expect(parseTarget('15')).toBe(15);
      expect(parseTarget(' 0 ')).toBe(0);
      for (const typed of ['', '-1', '2.5', '1e3', 'abc', '+3']) expect(parseTarget(typed)).toBeNull();
    });
  });

  describe('production (AC-7)', () => {
    it('AC-7: the figures in the product’s compact money formatter, never *8.4B* (ADR-0167 §1)', () => {
      expect(ofTarget(rp(12500))).toBe('of Rp 12,5 M target');
      expect(projectedWords(rp(11900))).toBe('Projected: Rp 11,9 M');
      expect(targetLegend(rp(12500))).toBe('Target: Rp 12,5 M');
    });

    it('AC-7: the marker sits where the projection falls against the target, clamped to the bar', () => {
      expect(markerAt(rp(6250), rp(12500))).toBe(50);
      expect(markerAt(rp(20000), rp(12500))).toBe(100);
      expect(markerAt(null, rp(12500))).toBeNull();
      expect(markerAt(rp(100), null)).toBeNull();
      expect(markerAt(rp(100), 0)).toBeNull();
    });

    it('AC-7: a unit’s line, *"Rp {a} / {t} unit target"* on an agency and without the words on an AAB unit — one Rp (UI-030)', () => {
      expect(unitNums({ achievedMinor: rp(620), targetMinor: rp(1500) }, true)).toBe('Rp 620 jt / 1,5 M unit target');
      expect(unitNums({ achievedMinor: rp(210), targetMinor: rp(500) }, false)).toBe('Rp 210 jt / 500 jt');
    });

    it('AC-9: a unit with no file or no goal says so, never 0', () => {
      expect(unitNums({ achievedMinor: null, targetMinor: rp(600) }, true)).toBe('Not uploaded yet / Rp 600 jt unit target');
      expect(unitNums({ achievedMinor: rp(10), targetMinor: null }, true)).toBe('Rp 10 jt · No goal set');
      expect(unitNums({ achievedMinor: null, targetMinor: null }, false)).toBe('Not uploaded yet · No goal set');
    });

    it('AC-7 (D-figures): the total names in its tooltip the months and the members it leaves out', () => {
      expect(leftOutWords({ missingMonths: ['2026-08'], membersWithoutGoal: 0 }))
        .toBe('Not uploaded yet for Agu 2026, so not counted in this total.');
      expect(leftOutWords({ missingMonths: ['2026-07', '2026-08', '2026-09'], membersWithoutGoal: 1 }))
        .toBe('Not uploaded yet for Jul 2026, Agu 2026 and Sep 2026, so not counted in this total. '
          + '1 member has no goal set, so the target leaves them out.');
      expect(leftOutWords({ missingMonths: [], membersWithoutGoal: 3 }))
        .toBe('3 members have no goal set, so the target leaves them out.');
      expect(leftOutWords({ missingMonths: [], membersWithoutGoal: 0 })).toBeNull();
    });
  });

  it('AC-8 (D-directory): *Today*, *"{n} days ago"* — *"1 day ago"* at one — or *Never*', () => {
    expect(daysAgoWords(0)).toBe('Today');
    expect(daysAgoWords(1)).toBe('1 day ago');
    expect(daysAgoWords(14)).toBe('14 days ago');
    expect(daysAgoWords(null)).toBe('Never');
  });
});
