import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  AGUS_ROW, BUDI, dashboard, DIMAS, goalCell, rp, SARI, SARI_UNIT, TONO, unitRow, WULAN, YANTI,
} from '@test/unit-dashboard-fixtures';
import {
  candidates, countWords, dialogGroups, everyRow, gapWords, goalWords, inputsOf, lockedWords, missingWords,
  periodFrom, prefill, productionChanges, productionToast, provenanceWords, readUnitDashboard, readerName,
  recruitLine, regroup, rowName, salesLine, totalRecruitLine, touchesWords, updateUnitProduction,
} from './unit-dashboard';

describe('the Unit Dashboard’s client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P15-T2 AC-6 reads the period from the address, This month when it names none or one it does not know', () => {
    expect(periodFrom('7d')).toBe('7d');
    expect(periodFrom('year')).toBe('year');
    expect(periodFrom(['month', 'year'])).toBe('month');
    expect(periodFrom(undefined)).toBe('month');
    expect(periodFrom('week')).toBe('month');
    expect(periodFrom(null)).toBe('month');
  });

  it('P15-T2 asks for the period, and with for only when it names a unit below the reader', async () => {
    const { calls } = stubFetch({ '/unit/dashboard': { body: dashboard() } });
    await readUnitDashboard({ period: '7d' });
    await readUnitDashboard({ period: 'year', for: 'mem-sari' });
    await readUnitDashboard();
    expect(calls.map((c) => c.url)).toEqual([
      'http://api.test/api/v1/unit/dashboard?period=7d',
      'http://api.test/api/v1/unit/dashboard?period=year&for=mem-sari',
      'http://api.test/api/v1/unit/dashboard',
    ]);
  });

  it('P15-T3 AC-3 saves with PATCH /unit/dashboard/production, the body as given', async () => {
    const { calls } = stubFetch({ 'PATCH /unit/dashboard/production': { body: { updated: 1, state: {} } } });
    const body = { month: '2026-10', revision: 7, rows: [{ membershipId: 'mem-dimas', apeMonthlyMinor: rp(70) }] };
    await expect(updateUnitProduction(body)).resolves.toEqual({ updated: 1, state: {} });
    expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard/production');
    expect(calls[0].init.method).toBe('PATCH');
    expect(JSON.parse(calls[0].init.body as string)).toEqual(body);
  });
});

describe('the words a row is drawn in', () => {
  it('P15-T2 AC-3 names the reader’s own row You ({first name})', () => {
    expect(readerName('Agus Santoso')).toBe('You (Agus)');
    expect(rowName(AGUS_ROW)).toBe('You (Agus)');
    expect(rowName(DIMAS)).toBe('Dimas Pratama');
  });

  it('P15-T2 AC-3 writes the goal line over or short, over its achieved-of-target', () => {
    expect(goalWords(goalCell())).toEqual({ tone: 'short', line: '82% · Rp 14.400.000 short', sub: 'Rp 65.600.000 of Rp 80.000.000' });
    expect(goalWords(goalCell({ actualMinor: rp(108), attainmentPct: 135, targetMet: true, overMinor: rp(28) })))
      .toEqual({ tone: 'over', line: '135% · +Rp 28.000.000 over', sub: 'Rp 108.000.000 of Rp 80.000.000' });
  });

  it('P15-T2 AC-3 never shows a missing figure as 0: Not uploaded yet, and No goal set', () => {
    expect(goalWords(goalCell({ actualMinor: null, attainmentPct: null })))
      .toEqual({ tone: 'missing', line: 'Not uploaded yet', sub: 'of Rp 80.000.000 target' });
    expect(goalWords(goalCell({ set: false, targetMinor: null, attainmentPct: null })))
      .toEqual({ tone: 'none', line: 'No goal set', sub: 'Rp 65.600.000' });
    expect(goalWords({ targetMinor: null, actualMinor: null, attainmentPct: null }))
      .toEqual({ tone: 'none', line: 'No goal set', sub: null });
  });

  it('P15-T2 AC-3 says a month made before it began is made, never 0% of Rp 0 (ADR-0047)', () => {
    const made = goalCell({ targetMinor: 0, actualMinor: rp(12), attainmentPct: null, gapMinor: 0, overMinor: rp(12), policiesNeeded: 0, targetMet: true });
    expect(goalWords(made)).toEqual({ tone: 'over', line: 'Year’s target made', sub: 'Rp 12.000.000' });
    expect(goalWords({ ...made, actualMinor: null })).toEqual({ tone: 'over', line: 'Year’s target made', sub: 'Not uploaded yet' });
    // A total whose target-holding rows were all made sums to a target of 0, and says the same.
    expect(goalWords({ targetMinor: 0, actualMinor: rp(30), attainmentPct: null }).line).toBe('Year’s target made');
    expect(gapWords(made)).toEqual({
      value: 'Year’s target made',
      note: 'The year’s target was made before this month began — this month needs nothing more.',
    });
  });

  it('P15-T2 AC-4 works a total’s over and short from its two sums, when the server sends no gap', () => {
    expect(goalWords({ targetMinor: rp(100), actualMinor: rp(120), attainmentPct: 120 }).line).toBe('120% · +Rp 20.000.000 over');
    expect(goalWords({ targetMinor: rp(100), actualMinor: rp(40), attainmentPct: 40 }).line).toBe('40% · Rp 60.000.000 short');
    // A percentage with nothing to show is the cell's own zero, not a missing one.
    expect(goalWords({ targetMinor: rp(100), actualMinor: rp(40), attainmentPct: null }).line).toBe('0% · Rp 60.000.000 short');
  });

  it('P15-T2 AC-3 writes the leads lines, the recruit line a dash when there is nothing to recruit', () => {
    const counts = { salesOpen: 12, salesClosing: 3, recruitOpen: 2, recruitNominated: 1 };
    expect(salesLine(counts)).toEqual({ count: 12, rest: '· 3 closing' });
    expect(recruitLine(counts)).toEqual({ count: 2, rest: '· 1 nominated' });
    expect(recruitLine({ ...counts, recruitOpen: 0, recruitNominated: 0 })).toBeNull();
    expect(recruitLine({ ...counts, recruitOpen: 0, recruitNominated: 1 })).toEqual({ count: 0, rest: '· 1 nominated' });
  });

  it('P15-T2 AC-4 writes a total’s recruits as potential recruit or recruits', () => {
    const counts = { salesOpen: 1, salesClosing: 0, recruitOpen: 4, recruitNominated: 1 };
    expect(totalRecruitLine(counts)).toEqual({ count: 1, rest: 'potential recruit' });
    expect(totalRecruitLine({ ...counts, recruitNominated: 3 })).toEqual({ count: 3, rest: 'potential recruits' });
    expect(totalRecruitLine({ ...counts, recruitNominated: 0 })).toBeNull();
  });

  it('P15-T2 AC-3 writes touches against their target, pro-rated under Last 7 days, and no bar without a target', () => {
    expect(touchesWords({ logged: 85, target: 95 }, 'month')).toEqual({ logged: 85, rest: '/ 95 touches', pct: 89 });
    expect(touchesWords({ logged: 20, target: 22 }, '7d')).toEqual({ logged: 20, rest: '/ 22 pro-rated touches', pct: 91 });
    expect(touchesWords({ logged: 140, target: 95 }, 'year').pct).toBe(100);
    expect(touchesWords({ logged: 0, target: 0 }, 'month').pct).toBe(100);
    expect(touchesWords({ logged: 7, target: null }, 'month')).toEqual({ logged: 7, rest: 'touches', pct: null });
  });

  it('P15-T2 AC-5 writes the breakdown’s counts, pro-rated under Last 7 days', () => {
    expect(countWords({ logged: 63, target: 70 }, 'month')).toBe('63/70');
    expect(countWords({ logged: 14, target: 16 }, '7d')).toBe('14/16 pro-rated');
    expect(countWords({ logged: 3, target: null }, 'year')).toBe('3');
  });

  it('P15-T2 AC-5 writes the gap and the policies it needs, singular at one', () => {
    expect(gapWords(goalCell())).toEqual({
      value: 'Rp 14.400.000 remaining', note: '≈ 1 policy needed at their avg case size of Rp 18.000.000.',
    });
    expect(gapWords(goalCell({ policiesNeeded: 3 })).note).toBe('≈ 3 policies needed at their avg case size of Rp 18.000.000.');
    expect(gapWords(goalCell({ policiesNeeded: null })).note).toBeNull();
    expect(gapWords(goalCell({ set: false }))).toEqual({ value: 'No goal set', note: null });
    expect(gapWords(goalCell({ gapMinor: null }))).toEqual({ value: 'Not uploaded yet', note: null });
  });

  it('P15-T3 AC-1 marks a correction with who and when, the agent’s own figure as theirs, and the file’s with nothing', () => {
    const corrected = {
      provenance: 'corrected' as const, month: '2026-10',
      correctedBy: { membershipId: 'mem-owner', name: 'Ibu Ratna' }, correctedAt: '2026-10-05T18:00:00.000Z',
    };
    // 18:00 UTC is the next morning in Jakarta: the day is the office's.
    expect(provenanceWords(corrected, 'month', false)).toBe('Corrected after the production upload, October 2026, by Ibu Ratna on Oct 6, 2026');
    expect(provenanceWords(corrected, 'year', true))
      .toBe('Corrected after the production upload, year to date as of October 2026, by Ibu Ratna on Oct 6, 2026');
    expect(provenanceWords({ ...corrected, correctedAt: null }, 'month', false)).toBe('Corrected after the production upload, October 2026, by Ibu Ratna');
    expect(provenanceWords({ ...corrected, correctedBy: null }, 'month', false)).toBe('Corrected after the production upload, October 2026');
    const own = { provenance: 'self_reported' as const, month: null, correctedBy: null, correctedAt: null };
    expect(provenanceWords(own, 'month', true)).toBe('Your own figure, entered in Goal Settings');
    expect(provenanceWords(own, 'month', false)).toBe('Their own figure, entered in Goal Settings');
    expect(provenanceWords({ ...own, provenance: 'imported', month: '2026-10' }, 'month', false)).toBeNull();
    expect(provenanceWords(null, 'month', false)).toBeNull();
  });

  it('P15-T2 AC-4 names who a total leaves out, by name where the rows say, else by count', () => {
    expect(missingWords(0, [])).toBeNull();
    expect(missingWords(1, ['Yanti Puspita'])).toBe('Not uploaded yet for Yanti Puspita, so not counted in this total.');
    expect(missingWords(2, ['Yanti Puspita'])).toBe('Not uploaded yet for 2 people, so not counted in this total.');
    expect(missingWords(1, [])).toBe('Not uploaded yet for 1 person, so not counted in this total.');
  });

  it('P15-T2 AC-2 counts candidates and the toast’s agents, singular at one', () => {
    expect(candidates(1)).toBe('1 candidate');
    expect(candidates(0)).toBe('0 candidates');
    expect(productionToast(1)).toBe('Production updated for 1 agent.');
    expect(productionToast(3)).toBe('Production updated for 3 agents.');
  });

  it('P15-T3 says the month is locked and who reopens it, with none of the six words', () => {
    const words = lockedWords('2026-10');
    expect(words).toBe('Production for October 2026 is locked. The Owner or Admin can reopen it.');
    expect(words).not.toMatch(/office|KPM|reports to|tagged to|untagged|unassigned/i);
  });
});

describe('the roster’s order and the dialog’s groups', () => {
  it('P15-T2 AC-4 lists everybody in the server’s order: your unit, then each unit head first and nested units after', () => {
    expect(everyRow(dashboard()).map((r) => r.membershipId)).toEqual([
      'mem-agus', 'mem-dimas', 'mem-indah', 'mem-siti',
      'mem-arief', 'mem-novi', 'mem-wahyu',
      'mem-dewi',
      'mem-sari', 'mem-budi', 'mem-rina', 'mem-yanti', 'mem-wulan', 'mem-tono',
    ]);
  });

  it('P15-T3 AC-3 groups the dialog as drawn: Your direct agents, then each unit, indented by depth', () => {
    const groups = dialogGroups(dashboard());
    expect(groups.map((g) => g.label)).toEqual([
      'Your direct agents', 'Arief Wibowo’s unit', 'Dewi Kartika’s unit', 'Sari Wulandari’s unit',
    ]);
    expect(groups[0].rows.map((r) => [r.row.membershipId, r.indent])).toEqual([
      ['mem-agus', 0], ['mem-dimas', 0], ['mem-indah', 0], ['mem-siti', 0],
    ]);
    expect(groups[3].rows.map((r) => [r.row.membershipId, r.indent])).toEqual([
      ['mem-sari', 0], ['mem-budi', 1], ['mem-rina', 1], ['mem-yanti', 1], ['mem-wulan', 1], ['mem-tono', 2],
    ]);
  });

  it('P15-T4 AC-2 names the first group for the head of a unit below the reader', () => {
    expect(dialogGroups(SARI_UNIT)[0].label).toBe('Sari Wulandari’s direct agents');
  });
});

describe('the dialog’s figures', () => {
  it('P15-T3 AC-3 prefills whole rupiah, grouped, and blank where nothing is held', () => {
    expect(prefill(YANTI.production.monthly)).toBe('');
    expect(prefill(YANTI.production.ytd)).toBe('120.000.000');
    expect(inputsOf([YANTI])).toEqual({ 'mem-yanti': { monthly: '', ytd: '120.000.000' } });
  });

  it('P15-T3 AC-3 regroups what is typed, and leaves an emptied box empty', () => {
    expect(regroup('70000000')).toBe('70.000.000');
    expect(regroup('Rp 7.500.000x')).toBe('7.500.000');
    expect(regroup('')).toBe('');
    expect(regroup('abc')).toBe('');
  });

  it('P15-T3 AC-3 sends only the cells that changed, in minor units', () => {
    const rows = [DIMAS, YANTI, BUDI];
    const inputs = inputsOf(rows);
    inputs['mem-dimas'].monthly = '70.000.000';
    inputs['mem-yanti'].monthly = '12.500.000';
    inputs['mem-yanti'].ytd = '132.500.000';
    expect(productionChanges(rows, inputs)).toEqual([
      { membershipId: 'mem-dimas', apeMonthlyMinor: rp(70) },
      { membershipId: 'mem-yanti', apeMonthlyMinor: rp(12.5), apeYtdMinor: rp(132.5) },
    ]);
  });

  it('P15-T3 AC-3 treats an emptied box, an untouched one and a figure typed back as unchanged', () => {
    const rows = [DIMAS, YANTI];
    const inputs = inputsOf(rows);
    inputs['mem-dimas'].monthly = '';
    inputs['mem-dimas'].ytd = '620000000';
    expect(productionChanges(rows, inputs)).toEqual([]);
    // A figure held in sen that is not a whole rupiah is left alone unless it is typed over.
    const odd = unitRow('mem-odd', 'Odd', {
      production: { monthly: { valueMinor: 12_345, provenance: 'imported', correctedBy: null, correctedAt: null }, ytd: YANTI.production.monthly },
    });
    expect(productionChanges([odd], inputsOf([odd]))).toEqual([]);
    // A row the inputs do not hold is skipped.
    expect(productionChanges([SARI, WULAN, TONO], {})).toEqual([]);
  });

  it('P15-T3 AC-3 sends 0 for a box typed 0 where nothing was held', () => {
    const inputs = inputsOf([YANTI]);
    inputs['mem-yanti'].monthly = '0';
    expect(productionChanges([YANTI], inputs)).toEqual([{ membershipId: 'mem-yanti', apeMonthlyMinor: 0 }]);
  });
});
