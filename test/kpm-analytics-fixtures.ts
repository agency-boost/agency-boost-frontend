import { makeMe } from './harness';
import type {
  AabUnitRow, AgencyRow, AnalyticsHead, AnalyticsPeriod, KpmAnalyticsView, Moc, UnitFigures,
} from '@/lib/kpm-analytics';

/**
 * KPM analytics as the server answers it (P18-T2): three AB agencies — Hendra's with two AAB units and
 * *Star Club*, the Owner's own with *Chairman's Club*, and Budi's, furthest behind, with no file this
 * month — plus Fajar, an AB two levels down under Hendra, in a row of his own (D-units). The total is the
 * sum of the rows, as the server makes it.
 */

/** Rupiah millions to minor units (sen). */
export const rp = (millions: number) => millions * 1_000_000 * 100;

const head = (membershipId: string, name: string, isReader = false, leads = true): AnalyticsHead =>
  ({ membershipId, name, isReader, leads });

type Figures = Omit<UnitFigures, 'head'>;

function figures(over: Partial<Figures> = {}): Figures {
  return {
    apeMonth: { achievedMinor: rp(50), targetMinor: rp(100), pct: 50 },
    apeAnnual: { achievedMinor: rp(600), targetMinor: rp(1200), pct: 50 },
    coached7d: { count: 2, of: 4, pct: 50 },
    activeAgents: 3,
    leads: { sales: 4, salesPotential: 2, recruit: 1, recruitPotential: 1 },
    manpower: { aab: 0, agents: 3, total: 4 },
    ...over,
  };
}

export const MOC_MET: Moc = {
  status: 'met',
  path: 'Met via the standard three-criteria path.',
  missing: null,
  criteria: [
    { code: 'NET_APE', label: 'Net APE', current: rp(1300), required: rp(600), met: true, period: '2026-01..2026-09' },
    { code: 'MONTHLY2_AA_DU', label: 'Monthly2 AA — DU', current: 5, required: 4, met: true, period: '2026-08..2026-09' },
    { code: 'MONTHLY2_AA_DG', label: 'Monthly2 AA — DG', current: 9, required: 6, met: true, period: '2026-08..2026-09' },
    { code: 'MOC_PERSISTENCY', label: 'Rolling Persistency — DU/DG', current: 82, required: 75, met: true, period: '2026-09' },
    { code: 'DIRECT_AB_COUNT', label: '— OR — Direct AB (AB on AB)', current: 1, required: 5, met: false, period: '2026-10' },
  ],
};

export const MOC_NOT_MET: Moc = {
  status: 'not_met',
  path: 'Needs to clear either the three standard criteria together, or reach 5 Direct ABs.',
  missing: null,
  criteria: [
    { code: 'NET_APE', label: 'Net APE', current: rp(180), required: rp(600), met: false, period: '2026-01..2026-09' },
    { code: 'MONTHLY2_AA_DU', label: 'Monthly2 AA — DU', current: 1, required: 4, met: false, period: '2026-08..2026-09' },
    { code: 'MONTHLY2_AA_DG', label: 'Monthly2 AA — DG', current: 2, required: 6, met: false, period: '2026-08..2026-09' },
    { code: 'MOC_PERSISTENCY', label: 'Rolling Persistency — DU/DG', current: 70, required: 75, met: false, period: '2026-09' },
    { code: 'DIRECT_AB_COUNT', label: '— OR — Direct AB (AB on AB)', current: 0, required: 5, met: false, period: '2026-10' },
  ],
};

export const MOC_UNKNOWN: Moc = {
  status: 'unknown',
  path: 'Needs to clear either the three standard criteria together, or reach 5 Direct ABs.',
  missing: 'Not uploaded yet: Rolling Persistency — DU/DG.',
  criteria: [
    { code: 'NET_APE', label: 'Net APE', current: rp(2100), required: rp(600), met: true, period: '2026-01..2026-09' },
    { code: 'MOC_PERSISTENCY', label: 'Rolling Persistency — DU/DG', current: null, required: 75, met: null, period: '2026-09' },
  ],
};

const AAB_MOC_NOT_MET: Moc = {
  status: 'not_met',
  path: 'AAB requirements have no alternate path — all three must be met.',
  missing: null,
  criteria: [
    { code: 'NET_APE', label: 'Net APE', current: rp(150), required: rp(200), met: false, period: '2026-01..2026-09' },
    { code: 'MONTHLY2_AA', label: 'Monthly2 AA', current: 2, required: 2, met: true, period: '2026-08..2026-09' },
  ],
};

const direct = (h: AnalyticsHead, over: Partial<Figures> = {}): UnitFigures => ({ head: h, ...figures(over) });
const aab = (h: AnalyticsHead, moc: Moc | null, over: Partial<Figures> = {}): AabUnitRow => ({ head: h, ...figures(over), moc });

export const HENDRA = head('mem-hendra', 'Hendra Wibowo');
export const IKA = head('mem-ika', 'Ika Wirawan');
export const YOGA = head('mem-yoga', 'Yoga Pratama');
export const OWNER = head('mem-owner', 'Wilson Tanoto', true);
export const BUDI = head('mem-budi', 'Budi Santoso');
export const FAJAR = head('mem-fajar', 'Fajar Nugroho');

/** The figures that move with the period: the month's APE, *Active*, and the leads. */
const MONTH: Record<AnalyticsPeriod, Partial<Figures>> = {
  this_month: {
    apeMonth: { achievedMinor: rp(62), targetMinor: rp(150), pct: 41 },
    activeAgents: 21,
    leads: { sales: 15, salesPotential: 9, recruit: 8, recruitPotential: 5 },
  },
  previous_month: {
    apeMonth: { achievedMinor: rp(130), targetMinor: rp(150), pct: 87 },
    activeAgents: 18,
    leads: { sales: 13, salesPotential: 8, recruit: 7, recruitPotential: 4 },
  },
};

export function agencies(period: AnalyticsPeriod = 'this_month'): AgencyRow[] {
  return [
    {
      head: HENDRA,
      ...figures({
        ...MONTH[period],
        apeAnnual: { achievedMinor: rp(1300), targetMinor: rp(1500), pct: 87 },
        coached7d: { count: 6, of: 31, pct: 19 },
        manpower: { aab: 2, agents: 28, total: 31 },
      }),
      club: { code: 'STAR_CLUB', label: 'Star Club' },
      moc: MOC_MET,
      direct: direct(HENDRA, { manpower: { aab: 0, agents: 8, total: 9 } }),
      aabUnits: [
        aab(IKA, AAB_MOC_NOT_MET, { manpower: { aab: 0, agents: 10, total: 11 } }),
        aab(YOGA, null, { manpower: { aab: 0, agents: 10, total: 11 } }),
      ],
      members: [
        { membershipId: 'mem-dimas', name: 'Dimas Pratama', rung: { code: 'AGENT', label: 'Agent' } },
        { membershipId: 'mem-indah', name: 'Indah Lestari', rung: { code: 'AGENT', label: 'Agent' } },
      ],
    },
    {
      head: OWNER,
      ...figures({
        apeMonth: { achievedMinor: rp(140), targetMinor: rp(140), pct: 100 },
        apeAnnual: { achievedMinor: rp(3600), targetMinor: rp(1700), pct: 212 },
        coached7d: { count: 23, of: 28, pct: 82 },
        activeAgents: period === 'this_month' ? 27 : 23,
        manpower: { aab: 0, agents: 27, total: 28 },
      }),
      club: { code: 'CHAIRMANS_CLUB', label: "Chairman's Club" },
      moc: MOC_UNKNOWN,
      direct: direct(OWNER),
      aabUnits: [],
      members: [{ membershipId: 'mem-putri', name: 'Putri Ramadhani', rung: { code: 'AGENT', label: 'Agent' } }],
    },
    {
      head: BUDI,
      ...figures({
        apeMonth: { achievedMinor: null, targetMinor: rp(75), pct: null },
        apeAnnual: { achievedMinor: rp(180), targetMinor: rp(900), pct: 20 },
        coached7d: { count: 0, of: 5, pct: 0 },
        activeAgents: null,
        manpower: { aab: 0, agents: 4, total: 5 },
      }),
      club: null,
      moc: MOC_NOT_MET,
      direct: direct(BUDI),
      aabUnits: [],
      members: [],
    },
    {
      // Two levels down, under Hendra (ADR-0014's promotion): a row of his own, his people out of Hendra's.
      head: FAJAR,
      ...figures({ apeAnnual: { achievedMinor: rp(700), targetMinor: rp(1100), pct: 64 }, manpower: { aab: 0, agents: 3, total: 4 } }),
      club: null,
      moc: null,
      direct: direct(FAJAR),
      aabUnits: [],
      members: [],
    },
  ];
}

export function analyticsView(period: AnalyticsPeriod = 'this_month', over: Partial<KpmAnalyticsView> = {}): KpmAnalyticsView {
  return {
    period,
    month: period === 'this_month' ? '2026-10' : '2026-09',
    thresholds: { statusSplitPct: 70 },
    // What the server composes from the seeded MOC rules (the prototype's numbers, `KPM_Owner.html:1248`).
    mocRulesText: [
      'AAB: Net APE ≥ Rp200M AND Monthly2 AA ≥ 2 AND Rolling Persistency DU ≥ 75%.',
      'AB: (Net APE ≥ Rp600M AND Monthly2 AA DU ≥ 4 / DG ≥ 6 AND Rolling Persistency DU/DG ≥ 75%) OR Direct AB (AB on AB) ≥ 5.',
    ].join('\n'),
    agencies: agencies(period),
    total: {
      leaversExcludedMinor: null,
      apeMonth: period === 'this_month'
        ? { achievedMinor: rp(302), targetMinor: rp(465), pct: 65 }
        : { achievedMinor: rp(370), targetMinor: rp(465), pct: 80 },
      apeAnnual: { achievedMinor: rp(5780), targetMinor: rp(5200), pct: 111 },
      coached7d: { count: 31, of: 68, pct: 46 },
      activeAgents: period === 'this_month' ? 54 : 47,
      leads: { sales: 27, salesPotential: 15, recruit: 11, recruitPotential: 8 },
      manpower: { aab: 2, agents: 62, total: 68 },
      abCount: 4,
      mocMet: 1,
      mocOf: 4,
    },
    monthly: [
      { month: '2026-04', apeMinor: rp(520) },
      { month: '2026-05', apeMinor: rp(610) },
      { month: '2026-06', apeMinor: rp(580) },
      { month: '2026-07', apeMinor: rp(700) },
      { month: '2026-08', apeMinor: null },
      { month: '2026-09', apeMinor: rp(800) },
    ],
    ...over,
  };
}

/** A team with no AB yet: no row to compare, the months still drawn. */
export const NO_AB = analyticsView('this_month', {
  agencies: [],
  total: {
    leaversExcludedMinor: null,
    apeMonth: { achievedMinor: null, targetMinor: null, pct: null },
    apeAnnual: { achievedMinor: null, targetMinor: null, pct: null },
    coached7d: { count: 0, of: 0, pct: null },
    activeAgents: null,
    leads: { sales: 0, salesPotential: 0, recruit: 0, recruitPotential: 0 },
    manpower: { aab: 0, agents: 0, total: 0 },
    abCount: 0,
    mocMet: 0,
    mocOf: 0,
  },
  monthly: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month) => ({ month, apeMinor: null })),
});

/** The Owner, who leads an agency of their own. */
export const OWNER_ME = makeMe({
  user: {
    id: 'u-owner', email: 'wilson@kpm0417.test', fullName: 'Wilson Tanoto', preferredName: 'Wilson',
    pronoun: 'they', initials: 'WT', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['member:read_profile', 'kpm_analytics:read', 'org_tree:read'],
});

/** An Admin on the Agent rung, who leads nobody. */
export const ADMIN_ME = makeMe({
  membership: {
    membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: true, directCount: 0,
  },
  permissions: ['member:read_profile', 'kpm_analytics:read'],
});

/** The office shell's own reads, answered so nothing reaches a network. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};
