import type {
  KpmOverviewView, LeaderboardRow, NotLoggedList, OverviewAgency,
} from '@/lib/kpm-overview';

/**
 * The KPM Overview as the server answers it, for the page's spec and the axe pass (P18-T1). The figures are
 * the prototype's own (`KPM_Owner.html:936-1222`) — 187 members, 142 logged this month, the four ABs
 * furthest behind — so a test reads against the screen it was drawn from. `EMPTY` is 0701's: an Owner and
 * one agent, no file, no session, no lead. `NOBODY` is an office with no member at all.
 */

/** Rupiah in minor units: `rp(620)` is Rp 620.000.000. */
export const rp = (millions: number) => Math.round(millions * 1_000_000 * 100);

const leader = (membershipId: string, name: string, coached: number, teamSize: number, pct: number | null): LeaderboardRow => ({
  membershipId, name, coached, teamSize, pct,
});

/** Eight ABs with a downline, lowest first, as the server orders them (D-coverage). */
export const LEADERBOARD: LeaderboardRow[] = [
  leader('mem-hendra', 'Hendra Wibowo', 6, 31, 19),
  leader('mem-budi', 'Budi Santoso', 5, 18, 28),
  leader('mem-fajar', 'Fajar Nugroho', 9, 22, 41),
  leader('mem-lina', 'Lina Chandra', 8, 15, 53),
  leader('mem-rudi', 'Rudi Hartono', 7, 12, 58),
  leader('mem-maya', 'Maya Kusuma', 9, 14, 64),
  leader('mem-putri', 'Putri Wijaya', 8, 10, 80),
  leader('mem-wilson', 'Wilson Tanoto', 23, 28, 82),
];

const agency = (
  membershipId: string, name: string, achieved: number | null, target: number | null, pct: number | null,
  aabUnits: OverviewAgency['aabUnits'] = [],
): OverviewAgency => ({
  membershipId, name, achievedMinor: achieved === null ? null : rp(achieved), targetMinor: target === null ? null : rp(target), pct, aabUnits,
});

const aab = (membershipId: string, name: string, achieved: number, target: number, pct: number) => ({
  membershipId, name, achievedMinor: rp(achieved), targetMinor: rp(target), pct,
});

/** Six AB agencies, lowest attainment first; the last with no figure held sorts last (D-units). */
export const AGENCIES: OverviewAgency[] = [
  agency('mem-hendra', 'Hendra Wibowo', 620, 1500, 41, [
    aab('mem-ika', 'Ika Wirawan', 210, 500, 42),
    aab('mem-yoga', 'Yoga Pratama', 180, 400, 45),
  ]),
  agency('mem-budi', 'Budi Santoso', 540, 900, 60, [aab('mem-dewi', 'Dewi Anggraini', 290, 500, 58)]),
  agency('mem-fajar', 'Fajar Nugroho', 700, 1100, 64, [
    aab('mem-putri-l', 'Putri Lestari', 350, 500, 70),
    aab('mem-agus', 'Agus Setiawan', 175, 300, 58),
  ]),
  agency('mem-lina', 'Lina Chandra', 480, 700, 69),
  agency('mem-wilson', 'Wilson Tanoto', 1600, 1700, 94),
  agency('mem-rudi', 'Rudi Hartono', null, 600, null),
];

export function overviewView(over: Partial<KpmOverviewView> = {}): KpmOverviewView {
  return {
    office: { companyName: 'Prudential', code: '0417', branch: 'BSD City Branch' },
    thresholds: { statusSplitPct: 70 },
    today: '2026-10-09',
    month: '2026-10',
    year: '2026',
    composition: {
      total: 187,
      newThisMonth: 6,
      rungs: [
        { code: 'AB', label: 'Agency Builder', count: 8 },
        { code: 'AAB', label: 'Associate Agency Builder', count: 24 },
        { code: 'AGENT', label: 'Agent', count: 155 },
      ],
    },
    engagement: {
      loggedThisMonth: { count: 142, of: 187, pct: 76, lastMonthToDate: 138 },
      loggedThisWeek: { logged: 118, notLogged: 69, pct: 63 },
    },
    coaching: {
      coverage7d: { count: 112, of: 187, pct: 60 },
      coverage30d: { count: 148, of: 187, pct: 79 },
      leaderboard: LEADERBOARD,
    },
    recruitment: { expectedToClose: 13, pipelineNow: 80, closedLastMonth: 11, target: 15, targetMonth: '2026-10' },
    production: {
      ytd: {
        achievedMinor: rp(8400), targetMinor: rp(12500), pct: 67, missingMonths: ['2026-08'], membersWithoutGoal: 3,
      },
      projectionMinor: rp(11900),
      agencies: AGENCIES,
    },
    ...over,
  };
}

/** 0701: Hadi, the Owner, leads Nadia; nothing logged, no session, no lead, no file, no goal. */
export const EMPTY: KpmOverviewView = overviewView({
  office: { companyName: 'Sejahtera Baru Life', code: '0701', branch: 'Cempaka Putih' },
  thresholds: { statusSplitPct: 70 },
  composition: {
    total: 2,
    newThisMonth: 0,
    rungs: [
      { code: 'AB', label: 'Agency Builder', count: 1 },
      { code: 'AAB', label: 'Associate Agency Builder', count: 0 },
      { code: 'AGENT', label: 'Agent', count: 1 },
    ],
  },
  engagement: {
    loggedThisMonth: { count: 0, of: 2, pct: 0, lastMonthToDate: null },
    loggedThisWeek: { logged: 0, notLogged: 2, pct: 0 },
  },
  coaching: {
    coverage7d: { count: 0, of: 2, pct: 0 },
    coverage30d: { count: 0, of: 2, pct: 0 },
    leaderboard: [leader('mem-hadi', 'Hadi Gunawan', 0, 1, 0)],
  },
  recruitment: { expectedToClose: 0, pipelineNow: 0, closedLastMonth: 0, target: null, targetMonth: '2026-10' },
  production: {
    ytd: {
      achievedMinor: null,
      targetMinor: null,
      pct: null,
      missingMonths: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'],
      membersWithoutGoal: 2,
    },
    projectionMinor: null,
    agencies: [agency('mem-hadi', 'Hadi Gunawan', null, null, null)],
  },
});

/** An office with no member at all: every rate is over nobody. */
export const NOBODY: KpmOverviewView = overviewView({
  composition: {
    total: 0,
    newThisMonth: 0,
    rungs: [
      { code: 'AB', label: 'Agency Builder', count: 0 },
      { code: 'AAB', label: 'Associate Agency Builder', count: 0 },
      { code: 'AGENT', label: 'Agent', count: 0 },
    ],
  },
  engagement: {
    loggedThisMonth: { count: 0, of: 0, pct: null, lastMonthToDate: null },
    loggedThisWeek: { logged: 0, notLogged: 0, pct: null },
  },
  coaching: { coverage7d: { count: 0, of: 0, pct: null }, coverage30d: { count: 0, of: 0, pct: null }, leaderboard: [] },
  recruitment: { expectedToClose: 0, pipelineNow: 0, closedLastMonth: 0, target: null, targetMonth: '2026-10' },
  production: {
    ytd: { achievedMinor: null, targetMinor: null, pct: null, missingMonths: [], membersWithoutGoal: 0 },
    projectionMinor: null,
    agencies: [],
  },
});

/** The not-logged list, longest silent first and never-logged first, as the server orders it. */
export const NOT_LOGGED: NotLoggedList = {
  total: 69,
  members: [
    { membershipId: 'mem-sinta', name: 'Sinta Halim', rung: { code: 'AGENT', label: 'Agent' }, lastLoggedOn: null, daysSince: null },
    { membershipId: 'mem-dedy', name: 'Dedy Pranata', rung: { code: 'AGENT', label: 'Agent' }, lastLoggedOn: '2026-09-27', daysSince: 12 },
    { membershipId: 'mem-rina', name: 'Rina Agustina', rung: { code: 'AAB', label: 'Associate Agency Builder' }, lastLoggedOn: '2026-09-30', daysSince: 9 },
    { membershipId: 'mem-tono', name: 'Tono Wibisono', rung: { code: 'AGENT', label: 'Agent' }, lastLoggedOn: '2026-10-01', daysSince: 8 },
  ],
};
