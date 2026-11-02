import type {
  GoalCell, UnitActivitiesView, UnitDashboardView, UnitGroup, UnitRow, UnitTotal,
} from '@/lib/unit-dashboard';
import { makeMe } from './harness';

/**
 * The Unit Dashboard as the server answers it, for the page's specs and the axe pass (Phase 15). The cast
 * is the seed's (`phase-15-unit-dashboard.md`, *Seed*): Agus (AB) leads Dimas, Indah and Siti on the agent
 * rung, and three units — Arief's (Novi, Wahyu), Dewi alone, and Sari's (Budi, Rina, Yanti) — with one
 * unit nested two deep the seed does not hold, Wulan's (Tono) inside Sari's, as a test fixture.
 */

/** *Chasing MDRT*'s header tooltip as the server composes it from 0417's MDRT campaign (OD-152). */
export const MDRT_TOOLTIP = 'Chasing MDRT (Million Dollar Round Table) this year — APE achieved ≥ Rp 2,4 M.';

/** Rupiah in minor units: `rp(80)` is Rp 80.000.000. */
export const rp = (millions: number) => Math.round(millions * 1_000_000 * 100);

export const goalCell = (over: Partial<GoalCell> = {}): GoalCell => ({
  set: true,
  period: 'month',
  targetMinor: rp(80),
  actualMinor: rp(65.6),
  attainmentPct: 82,
  gapMinor: rp(14.4),
  overMinor: null,
  policiesNeeded: 1,
  caseSizeMinor: rp(18),
  targetMet: false,
  source: { provenance: 'imported', month: '2026-10', correctedBy: null, correctedAt: null },
  ...over,
});

export function unitRow(membershipId: string, name: string, over: Partial<UnitRow> = {}): UnitRow {
  return {
    membershipId,
    name,
    isReader: false,
    rung: { code: 'AGENT', label: 'Agent' },
    depth: 1,
    leads: false,
    coached: true,
    goal: goalCell(),
    production: {
      monthly: { valueMinor: rp(65.6), provenance: 'imported', correctedBy: null, correctedAt: null },
      ytd: { valueMinor: rp(620), provenance: 'imported', correctedBy: null, correctedAt: null },
    },
    leadsCounts: { salesOpen: 9, salesClosing: 4, recruitOpen: 0, recruitNominated: 0 },
    closings: 0,
    activity: {
      leads: { logged: 63, target: 70 },
      appointments: { logged: 18, target: 20 },
      closings: { logged: 4, target: 5 },
      touches: { logged: 85, target: 95 },
    },
    lastOneOnOne: { days: 4, date: '2026-10-04', overdue: false, coach: { membershipId: 'mem-agus', name: 'Agus Santoso' } },
    status: 'watch_closely',
    pacingToMaa: true,
    newHireBeforeFirstSale: false,
    followUp: null,
    chasingMdrt: false,
    campaigns: [],
    ...over,
  };
}

export const total = (over: Partial<UnitTotal> = {}): UnitTotal => ({
  goal: { targetMinor: rp(320), actualMinor: rp(262.4), attainmentPct: 82, missing: 0, gapMinor: rp(57.6), overMinor: 0 },
  leadsCounts: { salesOpen: 36, salesClosing: 16, recruitOpen: 2, recruitNominated: 1 },
  closings: 3,
  touches: { logged: 340, target: 380 },
  potentialActive: { count: 3, of: 4 },
  newHires: 0,
  ...over,
});

const AAB = { code: 'AAB', label: 'Associate Agency Builder' };

/** The seed's chases (`phase-18.5-agent-enablement.md`, *Seed*): Agus MDRT; Dimas and Rina MDRT and the sprint. */
const MDRT = { code: 'MDRT_QUALIFICATION', title: 'MDRT Qualification' };
const SPRINT = { code: 'APE_SPRINT', title: 'Q4 APE Sprint' };

export const AGUS_ROW = unitRow('mem-agus', 'Agus Santoso', {
  chasingMdrt: true, campaigns: [MDRT],
  isReader: true, depth: 0, leads: true, rung: { code: 'AB', label: 'Agency Builder' }, lastOneOnOne: null, status: 'on_track',
  goal: goalCell({ actualMinor: rp(108), attainmentPct: 135, targetMet: true, overMinor: rp(28), gapMinor: 0, policiesNeeded: 0 }),
});
export const DIMAS = unitRow('mem-dimas', 'Dimas Pratama', {
  chasingMdrt: true, campaigns: [MDRT, SPRINT],
  lastOneOnOne: { days: 12, date: '2026-09-26', overdue: true, coach: { membershipId: 'mem-agus', name: 'Agus Santoso' } },
  followUp: { text: 'Role-play objection handling before next presentation', dueDate: '2026-10-05', overdueDays: 3 },
});
export const INDAH = unitRow('mem-indah', 'Indah Lestari', {
  status: 'on_track', closings: 2,
  leadsCounts: { salesOpen: 6, salesClosing: 2, recruitOpen: 2, recruitNominated: 1 },
  goal: goalCell({
    source: {
      provenance: 'corrected', month: '2026-10',
      correctedBy: { membershipId: 'mem-owner', name: 'Ibu Ratna' }, correctedAt: '2026-10-06T03:00:00.000Z',
    },
  }),
  followUp: { text: 'Send the illustration to Pak Hendra', dueDate: '2026-10-12', overdueDays: null },
});
export const SITI = unitRow('mem-siti', 'Siti Rahma', {
  status: 'needs_attention', pacingToMaa: false, lastOneOnOne: null,
  goal: goalCell({ actualMinor: null, attainmentPct: null, gapMinor: rp(80), policiesNeeded: 5, source: null }),
});

export const ARIEF = unitRow('mem-arief', 'Arief Wibowo', { rung: AAB, leads: true, status: 'on_track' });
export const NOVI = unitRow('mem-novi', 'Novi Anggraini', { depth: 2 });
export const WAHYU = unitRow('mem-wahyu', 'Wahyu Hidayat', { depth: 2, status: 'needs_attention', pacingToMaa: false });
export const DEWI = unitRow('mem-dewi', 'Dewi Kartika', { rung: AAB, status: 'needs_attention', pacingToMaa: null });
export const SARI = unitRow('mem-sari', 'Sari Wulandari', {
  rung: AAB, leads: true, status: 'no_goal_set', pacingToMaa: null,
  goal: goalCell({ set: false, targetMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }),
  lastOneOnOne: { days: 12, date: '2026-09-26', overdue: true, coach: { membershipId: 'mem-agus', name: 'Agus Santoso' } },
});
export const BUDI = unitRow('mem-budi', 'Budi Santoso', {
  depth: 2, status: 'needs_attention', leadsCounts: { salesOpen: 3, salesClosing: 1, recruitOpen: 1, recruitNominated: 1 },
});
export const RINA = unitRow('mem-rina', 'Rina Wijaya', {
  chasingMdrt: true, campaigns: [MDRT, SPRINT],
  depth: 2, lastOneOnOne: { days: 0, date: '2026-10-08', overdue: false, coach: { membershipId: 'mem-sari', name: 'Sari Wulandari' } },
});
export const YANTI = unitRow('mem-yanti', 'Yanti Puspita', {
  depth: 2,
  goal: goalCell({ actualMinor: null, attainmentPct: null, source: null }),
  production: {
    monthly: { valueMinor: null, provenance: null, correctedBy: null, correctedAt: null },
    ytd: { valueMinor: rp(120), provenance: 'imported', correctedBy: null, correctedAt: null },
  },
});
export const WULAN = unitRow('mem-wulan', 'Wulan Sari', { depth: 2, rung: AAB, leads: true });
export const TONO = unitRow('mem-tono', 'Tono Saputra', { depth: 3 });

export const WULAN_UNIT: UnitGroup = { head: WULAN, members: [TONO], units: [], total: total({ potentialActive: { count: 2, of: 2 } }) };

export const UNITS: UnitGroup[] = [
  { head: ARIEF, members: [NOVI, WAHYU], units: [], total: total({ potentialActive: { count: 2, of: 3 } }) },
  { head: DEWI, members: [], units: [], total: total({ potentialActive: { count: 0, of: 1 } }) },
  {
    head: SARI,
    members: [BUDI, RINA, YANTI],
    units: [WULAN_UNIT],
    total: total({
      goal: { targetMinor: rp(240), actualMinor: rp(131.2), attainmentPct: 55, missing: 1, gapMinor: rp(108.8), overMinor: 0 },
      potentialActive: { count: 4, of: 6 },
    }),
  },
];

export function dashboard(over: Partial<UnitDashboardView> = {}): UnitDashboardView {
  return {
    today: '2026-10-08',
    month: '2026-10',
    year: '2026',
    period: 'month',
    window: { from: '2026-10-01', to: '2026-10-08' },
    overdueAfterDays: 7,
    head: { membershipId: 'mem-agus', name: 'Agus Santoso', isReader: true },
    empty: false,
    tiles: {
      team: { total: 16, direct: 4, units: 3, underUnits: 9, newHires: 0 },
      directGroupProduction: {
        targetMinor: rp(1280), actualMinor: rp(1000), attainmentPct: 78, missing: 2, gapMinor: rp(280), overMinor: 0, period: 'month',
      },
      // UI-013: out of manpower, split Unit (Agus and his three) / AAB (the twelve below).
      potentialActive: { count: 12, of: 16, unit: { count: 3, of: 4 }, aab: { count: 9, of: 12 } },
      potentialRecruits: { yourUnit: 1, aabs: 1 },
    },
    yourUnit: { rows: [AGUS_ROW, DIMAS, INDAH, SITI], total: total() },
    units: UNITS,
    production: { month: '2026-10', revision: 7, locked: false, canUpdate: true },
    mdrt: { running: true, tooltip: MDRT_TOOLTIP },
    lastUpload: '2026-10-07',
    ...over,
  };
}

/** Nobody below the reader: the empty unit (D-reach). */
export const EMPTY = dashboard({
  head: { membershipId: 'mem-rina', name: 'Rina Wijaya', isReader: true },
  empty: true,
  tiles: {
    team: { total: 0, direct: 0, units: 0, underUnits: 0, newHires: 0 },
    directGroupProduction: {
      targetMinor: null, actualMinor: null, attainmentPct: null, missing: 0, gapMinor: null, overMinor: null, period: 'month',
    },
    potentialActive: { count: 0, of: 0, unit: { count: 0, of: 0 }, aab: { count: 0, of: 0 } },
    potentialRecruits: { yourUnit: 0, aabs: 0 },
  },
  yourUnit: { rows: [], total: total({ potentialActive: { count: 0, of: 0 } }) },
  units: [],
  production: { month: '2026-10', revision: 7, locked: false, canUpdate: false },
});

/** Sari's unit, as Agus opens it from the Group tree (`?for=mem-sari`). */
export const SARI_UNIT = dashboard({
  head: { membershipId: 'mem-sari', name: 'Sari Wulandari', isReader: false },
  tiles: {
    team: { total: 6, direct: 4, units: 1, underUnits: 1, newHires: 0 },
    directGroupProduction: {
      targetMinor: rp(240), actualMinor: rp(131.2), attainmentPct: 55, missing: 1, gapMinor: rp(108.8), overMinor: 0, period: 'month',
    },
    potentialActive: { count: 4, of: 6, unit: { count: 3, of: 4 }, aab: { count: 1, of: 2 } },
    potentialRecruits: { yourUnit: 1, aabs: 0 },
  },
  yourUnit: {
    rows: [{ ...SARI, depth: 0 }, { ...BUDI, depth: 1 }, { ...RINA, depth: 1 }, { ...YANTI, depth: 1 }],
    total: total({ goal: { targetMinor: rp(160), actualMinor: rp(65.6), attainmentPct: 41, missing: 1, gapMinor: rp(94.4), overMinor: 0 } }),
  },
  units: [{ ...WULAN_UNIT, head: { ...WULAN, depth: 1 }, members: [{ ...TONO, depth: 2 }] }],
});

/**
 * **Yanti as the seed has her since P18.96-T5** (ADR-0172): rejoined weeks ago, no first sale yet — a *New hire*, in
 * Sari's unit and in Agus's team, out of every total's production and of *On pace*'s count — and, since UI V1
 * (UI-013), in its `of`: manpower. Her missing figure is no longer *missing*: the production leaves her out for the
 * other reason, and says so.
 */
export const YANTI_NEW = { ...YANTI, newHireBeforeFirstSale: true };
export const NEW_HIRE_VIEW = dashboard({
  tiles: {
    team: { total: 16, direct: 4, units: 3, underUnits: 9, newHires: 1 },
    directGroupProduction: {
      targetMinor: rp(1200), actualMinor: rp(1000), attainmentPct: 83, missing: 1, gapMinor: rp(200), overMinor: 0, period: 'month',
    },
    potentialActive: { count: 11, of: 16, unit: { count: 3, of: 4 }, aab: { count: 8, of: 12 } },
    potentialRecruits: { yourUnit: 1, aabs: 1 },
  },
  units: [
    UNITS[0],
    UNITS[1],
    {
      ...UNITS[2],
      members: [BUDI, RINA, YANTI_NEW],
      total: total({
        goal: { targetMinor: rp(160), actualMinor: rp(131.2), attainmentPct: 82, missing: 0, gapMinor: rp(28.8), overMinor: 0 },
        potentialActive: { count: 3, of: 6 },
        newHires: 1,
      }),
    },
  ],
});

export const AGUS_ME = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 7,
  },
  permissions: ['unit_dashboard:read', 'unit_dashboard:update_production', 'coaching_session:read', 'activity_ratios:read'],
});

/** The read on expand (`GET /activity/ratios?for=`): two rates, one with no data, and the balance. */
export const ratio = (over: Record<string, unknown> = {}) => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15,
  tag: null, sides: null, numerator: [], denominator: [], purpose: null, divergesFromStandard: false,
  value: 0.18, share: null, numeratorCount: 9, denominatorCount: 50, status: 'success', ...over,
});

export const RATIOS = {
  membershipId: 'mem-dimas', from: '2026-09-09', to: '2026-10-08', days: 30,
  ratios: [
    ratio(),
    ratio({ code: 'RECRUITMENT_SUCCESS_RATE', label: 'Recruitment success rate', value: null, status: 'neutral' }),
    ratio({
      code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30,
      value: 40, share: 70, numeratorCount: 7, denominatorCount: 3, sides: { numerator: 'Selling', denominator: 'Recruitment' }, status: 'alert',
    }),
  ],
};

/*
 * ── UI V1 (Phase 18.99 T4): the Activities tab ─────────────────────────────────────────────────
 */

/** The seed's office sections, as the office named them (content: never translated). */
const SECTIONS: UnitActivitiesView['sections'] = [
  { code: 'LEADS_GENERATION', label: 'Leads Generation', status: 'active', types: [
    { code: 'LEADS_CONTACTED', label: 'Set Appointment', status: 'active' },
    { code: 'NEW_PROSPECT', label: 'Mendapatkan calon prospek baru', status: 'active' },
  ] },
  { code: 'SELLING', label: 'Selling', status: 'active', types: [
    { code: 'SELL_PRESENTATION', label: 'Sales meeting', status: 'active' },
    { code: 'SELL_SUBMISSION', label: 'Submission polis', status: 'active' },
  ] },
  { code: 'RECRUITMENT', label: 'Recruitment', status: 'active', types: [
    { code: 'RECRUIT_PRESENTATION', label: 'Melakukan presentasi recruitment', status: 'active' },
  ] },
];

/**
 * `GET /unit/dashboard/activities` for Agus's week of 26 Okt – 1 Nov 2026: his Unit (Agus, Indah, Siti) and one AAB,
 * Arief, in the Group; the totals the server's sums of the columns.
 */
export function activities(over: Partial<UnitActivitiesView> = {}): UnitActivitiesView {
  return {
    today: '2026-10-30',
    period: { span: 'week', from: '2026-10-26', to: '2026-11-01', current: true, previous: '2026-10-25', next: null },
    head: { membershipId: 'mem-agus', name: 'Agus Santoso', isReader: true },
    empty: false,
    sections: SECTIONS,
    people: [
      { membershipId: 'mem-agus', name: 'Agus Santoso', isReader: true, inUnit: true, counts: [{ code: 'NEW_PROSPECT', count: 1 }], total: 1 },
      { membershipId: 'mem-indah', name: 'Indah Lestari', isReader: false, inUnit: true, counts: [
        { code: 'LEADS_CONTACTED', count: 9 }, { code: 'NEW_PROSPECT', count: 6 }, { code: 'SELL_PRESENTATION', count: 4 },
        { code: 'SELL_SUBMISSION', count: 1 },
      ], total: 20 },
      { membershipId: 'mem-siti', name: 'Siti Rahma', isReader: false, inUnit: true, counts: [], total: 0 },
      { membershipId: 'mem-arief', name: 'Arief Wibowo', isReader: false, inUnit: false, counts: [
        { code: 'RECRUIT_PRESENTATION', count: 4 },
      ], total: 4 },
    ],
    totals: {
      unit: { counts: [
        { code: 'LEADS_CONTACTED', count: 9 }, { code: 'NEW_PROSPECT', count: 7 }, { code: 'SELL_PRESENTATION', count: 4 },
        { code: 'SELL_SUBMISSION', count: 1 },
      ], total: 21 },
      group: { counts: [
        { code: 'LEADS_CONTACTED', count: 9 }, { code: 'NEW_PROSPECT', count: 7 }, { code: 'RECRUIT_PRESENTATION', count: 4 },
        { code: 'SELL_PRESENTATION', count: 4 }, { code: 'SELL_SUBMISSION', count: 1 },
      ], total: 25 },
    },
    ratios: {
      from: '2026-10-01', to: '2026-10-30', days: 30,
      unit: RATIOS.ratios as UnitActivitiesView['ratios']['unit'],
      group: [
        ratio({ value: 0.33, numeratorCount: 10, denominatorCount: 30 }),
        ratio({ code: 'RECRUITMENT_SUCCESS_RATE', label: 'Recruitment success rate', value: 0.5, numeratorCount: 2, denominatorCount: 4 }),
      ] as UnitActivitiesView['ratios']['group'],
    },
    ...over,
  };
}
