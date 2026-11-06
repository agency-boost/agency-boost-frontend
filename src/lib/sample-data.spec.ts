import { describe, expect, it } from 'vitest';
import { hasNoKpm, needsKpmHere, NO_KPM_ROUTES } from './no-kpm';
import {
  SAMPLE_ID_PREFIX, SAMPLE_PEOPLE, sampleHomeView, sampleNewHires, sampleOrgTree, sampleRoster, sampleUnitView,
} from './sample-data';
import type { UnitDashboardView } from './unit-dashboard';
import { makeMe } from '@test/harness';

const name = (n: number) => `Agen contoh ${n}`;
const TODAY = '2026-11-04';

/** The server's empty unit, as `GET /unit/dashboard` answers a leader with nobody (`unit-dashboard.service.ts`). */
const EMPTY = {
  today: TODAY, month: '2026-11', year: '2026', period: 'month', window: { from: '2026-11-01', to: TODAY },
  overdueAfterDays: 14, head: { membershipId: 'mem-1', name: 'Victor', isReader: true }, empty: true,
  tiles: {
    team: { total: 0, direct: 0, units: 0, underUnits: 0, newHires: 0 },
    directGroupProduction: { targetMinor: null, actualMinor: null, attainmentPct: null, missing: 0, gapMinor: null, overMinor: null, period: 'month' },
    potentialActive: { count: 0, of: 0, unit: { count: 0, of: 0 }, aab: { count: 0, of: 0 } },
    potentialRecruits: { yourUnit: 0, aabs: 0 },
  },
  yourUnit: { rows: [], total: {} }, units: [],
  production: { month: '2026-11', revision: 0, locked: false, canUpdate: true },
  mdrt: { running: false, tooltip: '' }, lastUpload: null,
} as unknown as UnitDashboardView;

/** Every person a sample names: id and name. */
function people(sample: unknown): { id: string; name: string }[] {
  const found: { id: string; name: string }[] = [];
  JSON.stringify(sample, (_key, value) => {
    if (value && typeof value === 'object' && typeof value.membershipId === 'string') {
      const shown = value.name ?? value.fullName;
      if (typeof shown === 'string') found.push({ id: value.membershipId, name: shown });
    }
    return value;
  });
  return found;
}

/**
 * **The samples hold nobody** (P19-T4 AC-3; ADR-0189 §3): every person in every sample is a sample — an id starting
 * `sample-`, the name the caller gives a sample, no phone, no photo — so a sample can never be read as, or counted with,
 * somebody real.
 */
describe('P19-T4 the Contoh samples’ data', () => {
  const samples = {
    roster: sampleRoster(name, TODAY),
    tree: sampleOrgTree(name, 'Leader contoh'),
    newHires: sampleNewHires(name, TODAY),
    // Its frame is the server's — the reader's own heading — and its roster the sample's.
    unit: (({ yourUnit, units }) => ({ yourUnit, units }))(sampleUnitView(EMPTY, name)),
  };

  it.each(Object.entries(samples))('P19-T4 AC-3 the %s sample names only sample people, by sample ids', (_, sample) => {
    const named = people(sample);
    expect(named.length).toBeGreaterThanOrEqual(SAMPLE_PEOPLE);
    for (const person of named) {
      expect(person.id.startsWith(SAMPLE_ID_PREFIX)).toBe(true);
      expect(person.name).toMatch(/contoh/i);
    }
    const text = JSON.stringify(sample);
    expect(text).not.toMatch(/"phone":"|"photoUrl":"|\+62|@/);
  });

  it('P19-T4 AC-3 the unit sample keeps the server’s frame and draws a roster of three, with nothing to update', () => {
    const unit = sampleUnitView(EMPTY, name);
    expect([unit.today, unit.month, unit.head]).toEqual([EMPTY.today, EMPTY.month, EMPTY.head]);
    expect(unit.empty).toBe(false);
    expect(unit.yourUnit.rows).toHaveLength(SAMPLE_PEOPLE);
    expect(unit.production.canUpdate).toBe(false);
    expect(unit.tiles.team.total).toBe(SAMPLE_PEOPLE);
    // The server's own view is untouched: the page's real tiles still read zero beside the sample.
    expect(EMPTY.tiles.team.total).toBe(0);
  });

  it('P19-T4 AC-3 the tree’s reader is the sample leader, with the three agents beneath', () => {
    const tree = samples.tree;
    const self = tree.nodes.find((n) => n.isSelf)!;
    expect(self.fullName).toBe('Leader contoh');
    expect(tree.nodes.filter((n) => n.leaderId === self.membershipId)).toHaveLength(SAMPLE_PEOPLE);
  });

  it('P19-T4 AC-4 Home’s sample for somebody in no office: seven days ending today, nobody to lead', () => {
    const view = sampleHomeView(TODAY, { index: 0, text: '', person: '', pose: 'thinking' });
    expect(view.activity.days.map((d) => d.date)).toEqual([
      '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', TODAY,
    ]);
    expect(view.activity.total).toBe(view.activity.days.reduce((n, d) => n + d.count, 0));
    expect(view.activity.today).toBe(view.activity.days[6].count);
    expect(view.leader).toBeNull();
  });
});

describe('P19-T4 who is in no office, and where they may go', () => {
  it('P19-T4 AC-4 somebody signed in with no membership, never a Super Admin', () => {
    expect(hasNoKpm(makeMe({ membership: null }))).toBe(true);
    expect(hasNoKpm(makeMe())).toBe(false);
    expect(hasNoKpm(makeMe({ membership: null, user: { ...makeMe().user, platformRole: 'super_admin' } }))).toBe(false);
    expect(hasNoKpm(null)).toBe(false);
    // Registered and waiting for a leader (UI-166's staging case, *Registered, asked nobody*), or removed.
    for (const status of ['pending', 'removed'] as const) {
      expect(hasNoKpm(makeMe({ membership: { ...makeMe().membership!, status } }))).toBe(true);
    }
  });

  it('P19-T4 AC-4 every field page needs a KPM but User Management, the profile, the inbox and an invite', () => {
    const nobody = makeMe({ membership: null });
    for (const path of ['/home', '/activity/log', '/calendar', '/summary', '/leads', '/training', '/unit/dashboard']) {
      expect([path, needsKpmHere(nobody, path)]).toEqual([path, true]);
    }
    for (const path of ['/user-management/kpm', '/user-management/leader', '/profile', '/notifications', '/join']) {
      expect([path, needsKpmHere(nobody, path)]).toEqual([path, false]);
    }
    expect(needsKpmHere(makeMe(), '/leads')).toBe(false);
    expect(NO_KPM_ROUTES).toContain('/profile');
  });
});
