import { describe, expect, it } from 'vitest';
import { fieldNav } from './field-nav';
import {
  coachedWords, daysAgoWords, inTeam, leftOutWords, markerAt, newThisMonth, officeLine, ofTarget, OWN_COPY, parseTarget,
  pctText, projectedWords, PROTOTYPE_COPY, RATIO_BENCHMARKS_HREF, recruitPill, REVIEWED_PAGES, rungShort,
  SETTINGS_PAGE_COUNT, SETTINGS_PAGES, settingsLine, SETUP_STEPS, showingWords, silentMeta, STEP_HREF, targetLegend,
  targetValueWords, toneOf, unitNums, uploadHref,
} from './kpm-overview';
import { makeMe } from '@test/harness';

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

  describe('P19.3-T2 the not-logged list (AC-2; UI-148, `kpm-overview-mobile` 3)', () => {
    const member = (over: Partial<Parameters<typeof silentMeta>[0]> = {}) => ({
      rung: { code: 'AGENT', label: 'Agent' }, leader: { membershipId: 'm-sari', name: 'Sari Puspita' }, daysSince: 14, ...over,
    });

    it('P19.3-T2 AC-2 a row’s meta is role · leader · last log — "Agent · ke Sari · 14 hari lalu"', () => {
      expect(silentMeta(member(), false, 'id')).toBe('Agent · ke Sari · 14 hari lalu');
      expect(silentMeta(member(), false)).toBe('Agent · under Sari · 14 days ago');
    });

    it('P19.3-T2 AC-2 never logged reads "Belum pernah"; the top of the tree names no leader', () => {
      expect(silentMeta(member({ daysSince: null, leader: { membershipId: 'm-agus', name: 'Agus Prasetyo' } }), false, 'id'))
        .toBe('Agent · ke Agus · Belum pernah');
      expect(silentMeta(member({ rung: { code: 'AB', label: 'AB' }, leader: null, daysSince: 18 }), false, 'id')).toBe('AB · 18 hari lalu');
    });

    it('P19.3-T2 AC-2 the reader’s own row reads Anda in the leader’s place', () => {
      expect(silentMeta(member({ rung: { code: 'AB', label: 'AB' }, leader: null, daysSince: 16 }), true, 'id')).toBe('AB · Anda · 16 hari lalu');
    });

    it('AC-4: a rung after a name is its short form — AAB, Agent — as the prototype writes it', () => {
      expect(rungShort({ code: 'AAB', label: 'Associate Agency Builder' })).toBe('AAB');
      expect(rungShort({ code: 'AGENT', label: 'Agent' })).toBe('Agent');
      expect(rungShort({ code: 'AB', label: 'Agency Builder' })).toBe('AB');
    });
  });

  describe('coverage and the leaderboard (AC-5)', () => {
    it('AC-5, P18.9-T3 AC-1: *"· {n} in team"* and *"{c}/{n} · {p}%"* (`:1027-1029`), the percentage whole', () => {
      expect(inTeam(31)).toBe('· 31 in team');
      expect(coachedWords({ coached: 6, teamSize: 31, pct: 19, leads: true })).toBe('6/31 · 19%');
      expect(coachedWords({ coached: 0, teamSize: 0, pct: null, leads: true })).toBe('0/0 · —');
    });

    it('P18.9-T3 AC-5 an AB who leads nobody reads No team where the figure would be — never 0/0, never 0%', () => {
      expect(coachedWords({ coached: 0, teamSize: 0, pct: null, leads: false })).toBe('No team');
      expect(OWN_COPY.noTeam).toBe('No team');
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
      expect(pctText(0)).toBe('0%');
    });

    it('P18.9-T3 AC-1: writes the server’s whole percent as it came — 96%, never 96,0% (UI-018, OD-213)', () => {
      // 27 of 28 is 96,4, which `rateOver` serves as 96: one rounding, the server's, and no ,0 after it.
      expect(pctText(96)).toBe('96%');
      expect(pctText(57)).toBe('57%');
      expect(pctText(100)).toBe('100%');
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

    it('P18.9-T3 AC-7 the Target reads as a value — its number, or No target set — with Edit and its toast', () => {
      expect(targetValueWords(15)).toBe('15');
      expect(targetValueWords(0)).toBe('0');
      expect(targetValueWords(null)).toBe('No target set');
      expect([OWN_COPY.edit, OWN_COPY.editTarget, OWN_COPY.targetSaved]).toEqual(['Edit', 'Edit target', 'Target saved ✓']);
    });

    it('P18.9-T3 AC-6 Engagement’s sub-line names the two periods its cards read (UI-020)', () => {
      expect(PROTOTYPE_COPY.engagementSub).toBe('This month · Last 7 days');
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
      expect(unitNums({ achievedMinor: rp(620), targetMinor: rp(1500) }, true)).toBe('Rp 620 Jt / 1,5 M unit target');
      expect(unitNums({ achievedMinor: rp(210), targetMinor: rp(500) }, false)).toBe('Rp 210 Jt / 500 Jt');
    });

    it('AC-9: a unit with no file or no goal says so, never 0', () => {
      expect(unitNums({ achievedMinor: null, targetMinor: rp(600) }, true)).toBe('Not uploaded yet / Rp 600 Jt unit target');
      expect(unitNums({ achievedMinor: rp(10), targetMinor: null }, true)).toBe('Rp 10 Jt · No goal set');
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

describe('P19.3-T2 the Overview’s links and its setup card (UI-148, UI-149, UI-150)', () => {
  it('P19.3-T2 AC-4 the seven steps in the card’s order: the four settings pages first, the server’s SETUP_STEPS', () => {
    expect([...SETUP_STEPS]).toEqual([
      'branch-info', 'activity-types', 'activation-checklist', 'products', 'import', 'upload', 'recruit-target',
    ]);
    expect([...REVIEWED_PAGES]).toEqual(SETUP_STEPS.slice(0, 4));
    expect(Object.values(STEP_HREF)).toEqual(REVIEWED_PAGES.map((page) => `/kpm/settings/${page}`));
  });

  it('P19.3-T2 AC-7 a month opens Data upload on itself: /kpm/data-upload?month=YYYY-MM', () => {
    expect(uploadHref('2026-10')).toBe('/kpm/data-upload?month=2026-10');
  });

  it('P19.3-T2 AC-3 the settings list is the menu’s Pengaturan group, in its order, Activity types first and Branch info last', () => {
    const owner = makeMe({
      membership: {
        membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['kpm_overview:read'],
    });
    const group = fieldNav(owner, '/kpm/overview', 'kpm_owner').groups.find((g) => g.id === 'pengaturan')!;
    // *Changed 2026-11-06 (P19.6-T1; ADR-0218 §1):* but *Tampilan KPM*, which the Overview's mockup (UI-148) does not list.
    expect(SETTINGS_PAGES.map((p) => p.href)).toEqual(group.items.map((item) => item.href).filter((href) => href !== '/kpm/settings/branding'));
    expect(SETTINGS_PAGES[0].key).toBe('activity-types');
    expect(SETTINGS_PAGES.at(-1)!.key).toBe('branch-info');
    // Ratio benchmarks under Activity types: eleven pages, every one two taps from the Overview.
    expect(RATIO_BENCHMARKS_HREF).toBe('/kpm/settings/ratio-benchmarks');
    expect(SETTINGS_PAGE_COUNT).toBe(11);
  });

  it('P19.3-T2 AC-3 Pengaturan KPM’s line: the count, then what waits — products, then the checklist’s draft', () => {
    expect(settingsLine({ productsAwaiting: 2, checklistDraftVersion: 2 }, 'id'))
      .toBe('11 pengaturan · 2 produk menunggu Anda · checklist draf versi 2');
    expect(settingsLine({ productsAwaiting: 0, checklistDraftVersion: null }, 'id')).toBe('11 pengaturan');
    expect(settingsLine({ productsAwaiting: 1, checklistDraftVersion: null })).toBe('11 settings · 1 product waiting for you');
  });
});

