import { describe, expect, it } from 'vitest';
import {
  barWidth, complianceTone, daysAgoWords, firstRows, groupParam, officeLine, REVIEWED_PAGES, rowCount, SETTINGS_HUB_HREF,
  SETTINGS_PAGE_COUNT, SETTINGS_PAGES, settingsLine, SETUP_STEPS, shiftMonth, uploadHref, visibleRows, type OverviewPerson,
} from './kpm-overview';

/** A person on the Overview's lists. */
const person = (membershipId: string, over: Partial<OverviewPerson> = {}): OverviewPerson => ({
  membershipId, name: membershipId.toUpperCase(), role: 'agent', photoUrl: null, phone: null, groupId: 'g',
  abMembershipId: 'ab', depth: 1, leaderIds: ['ab'],
  usage: { status: 'recent', days: 1, usedInWindow: true }, coaching: { status: 'never', days: null }, ...over,
});

/** Agus (AB), Sari (AAB) over Rina, Indah his own; Maya (AB) in Tanpa group. */
const PEOPLE = [
  person('agus', { role: 'ab', depth: 0, leaderIds: [] }),
  person('sari', { role: 'aab', depth: 1, leaderIds: ['agus'] }),
  person('rina', { depth: 2, leaderIds: ['agus', 'sari'], usage: { status: 'never', days: null, usedInWindow: false } }),
  person('indah', { leaderIds: ['agus'], usage: { status: 'lapsed', days: 20, usedInWindow: true } }),
  person('maya', { role: 'ab', depth: 0, groupId: null, abMembershipId: 'maya', leaderIds: [] }),
];
const GROUPS = [{ groupId: 'g', name: 'Circle' }, { groupId: null, name: null }];

describe('P19.19-T1 AC-3 the tree for a tile', () => {
  it('P19.19-T1 AC-3 the people who match, and every leader whose team matches with “n di timnya”, never greyed', () => {
    const tree = visibleRows(PEOPLE, GROUPS, (p) => p.usage.status === 'never');
    expect(tree.map((g) => g.name)).toEqual(['Circle']);
    expect(tree[0].rows.map((r) => [r.person.membershipId, r.matches, r.inTeam])).toEqual([
      ['agus', false, 1], ['sari', false, 1], ['rina', true, 0],
    ]);
  });

  it('P19.19-T1 AC-3 a leader who matches is shown with their own count too; a group with nobody to show is left out', () => {
    const tree = visibleRows(PEOPLE, GROUPS, (p) => p.usage.status === 'recent');
    expect(tree.map((g) => [g.name, g.rows.map((r) => [r.person.membershipId, r.inTeam])])).toEqual([
      ['Circle', [['agus', 1], ['sari', 0]]], [null, [['maya', 0]]],
    ]);
  });

  it('P19.19-T1 AC-1 the first seven rows across groups, then the rest behind Lihat semua', () => {
    const tree = visibleRows(PEOPLE, GROUPS, () => true);
    expect(rowCount(tree)).toBe(5);
    expect(rowCount(firstRows(tree, 3))).toBe(3);
    expect(firstRows(tree, 3).map((g) => g.name)).toEqual(['Circle']);
    expect(rowCount(firstRows(tree, 7))).toBe(5);
  });
});

describe('P19.19-T3 AC-2 the compliance cards’ colour', () => {
  const SPLITS = { lowBelowPct: 34, highFromPct: 67 };
  it.each([[0, 'red'], [33, 'red'], [34, 'amber'], [66, 'amber'], [67, 'green'], [100, 'green'], [null, 'grey']] as const)(
    'P19.19-T3 AC-2 %s%% is %s: red below 34, yellow below 67, green from 67', (pct, tone) => {
      expect(complianceTone(pct, SPLITS)).toBe(tone);
    },
  );

  it('P19.19-T3 AC-2 a bar: a sliver for anything above zero, never past full, nothing over nobody', () => {
    expect([barWidth(1, 1000), barWidth(0, 5), barWidth(5, 0), barWidth(7, 5), barWidth(null, 5), barWidth(13, 30)])
      .toEqual([2, 0, 0, 100, 0, 43]);
  });
});

describe('P19.19 the Overview’s links, the setup card and the month switcher', () => {
  it('P19.19-T1 AC-2 the group filter’s parameter: an id, none for Tanpa group, nothing for the KPM', () => {
    expect([groupParam(null), groupParam({ groupId: 'g1', name: 'Circle' }), groupParam({ groupId: null, name: null })])
      .toEqual([null, 'g1', 'none']);
  });

  it('P19.19-T2 AC-1 the month switcher steps across a year', () => {
    expect([shiftMonth('2026-11', -1), shiftMonth('2026-01', -1), shiftMonth('2026-12', 1)]).toEqual(['2026-10', '2025-12', '2027-01']);
  });

  it('P19.3-T2 AC-4, P19.19-T4 AC-2 the seven steps in the card’s order; the last is the AB groups’ monthly targets', () => {
    expect([...SETUP_STEPS]).toEqual([
      'branch-info', 'activity-types', 'activation-checklist', 'products', 'import', 'upload', 'recruit-target',
    ]);
    expect([...REVIEWED_PAGES]).toEqual(SETUP_STEPS.slice(0, 4));
    expect(uploadHref('2026-11')).toBe('/kpm/data-upload?month=2026-11');
  });

  it('P19.19 Pengaturan KPM opens the hub; its line counts the pages and says what waits', () => {
    expect(SETTINGS_HUB_HREF).toBe('/kpm/settings');
    expect(SETTINGS_PAGE_COUNT).toBe(SETTINGS_PAGES.length + 1);
    expect(settingsLine({ productsAwaiting: 2, checklistDraftVersion: 2 }, 'id'))
      .toBe('11 pengaturan · 2 produk menunggu Anda · checklist draf versi 2');
    expect(settingsLine({ productsAwaiting: 0, checklistDraftVersion: null })).toBe('11 settings');
  });

  it('the office’s line and the directory’s days', () => {
    expect(officeLine({ companyName: 'Prudential', code: '0417', branch: 'BSD' })).toBe('Prudential · KPM 0417 — BSD');
    expect([daysAgoWords(0), daysAgoWords(1), daysAgoWords(14), daysAgoWords(null)]).toEqual(['Today', '1 day ago', '14 days ago', 'Never']);
    expect(daysAgoWords(3, 'id')).toBe('3 hari lalu');
  });
});
