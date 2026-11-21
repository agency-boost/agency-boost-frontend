import type {
  ComplianceView, KpmOverviewView, OverviewPerformanceView, OverviewPerson, PerformanceRow,
} from '@/lib/kpm-overview';

/** Rp n M in sen. */
const M = 1_000_000 * 100;

/** A person on the Overview's lists (the mockup's example people). */
export function person(membershipId: string, name: string, over: Partial<OverviewPerson> = {}): OverviewPerson {
  return {
    membershipId, name, role: 'agent', photoUrl: null, phone: '+6281200000001', groupId: 'grp-top',
    abMembershipId: 'mem-agus', depth: 1, leaderIds: ['mem-agus'],
    usage: { status: 'recent', days: 1, usedInWindow: true }, coaching: { status: 'recent', days: 3 }, ...over,
  };
}

/**
 * **The KPM Overview as the mockup draws it** (`kpm-overview-v2-tablet` frame 1): *Top Producers 2026* holds Agus's AB
 * group — Agus, Dewi (AAB) over Wahyu, and Lukman — and *Tanpa group* Maya's. Dewi and Lukman never used the app; Wahyu
 * last used it 18 days ago.
 */
export const PEOPLE: OverviewPerson[] = [
  person('mem-agus', 'Agus Prasetyo', { role: 'ab', depth: 0, leaderIds: [], coaching: { status: 'never', days: null } }),
  person('mem-dewi', 'Dewi Lestari', {
    role: 'aab', leaderIds: ['mem-agus'], usage: { status: 'never', days: null, usedInWindow: false },
  }),
  person('mem-wahyu', 'Wahyu Saputra', {
    depth: 2, leaderIds: ['mem-agus', 'mem-dewi'], usage: { status: 'lapsed', days: 18, usedInWindow: true },
    coaching: { status: 'lapsed', days: 27 },
  }),
  person('mem-lukman', 'Lukman Hakim', { usage: { status: 'never', days: null, usedInWindow: false }, phone: null }),
  person('mem-maya', 'Maya Halim', {
    role: 'ab', depth: 0, leaderIds: [], groupId: null, abMembershipId: 'mem-maya',
  }),
];

export function overviewView(over: Partial<KpmOverviewView> = {}): KpmOverviewView {
  return {
    office: { companyName: 'Prudential', code: '0417', branch: 'BSD City Branch' },
    today: '2026-11-20',
    month: '2026-11',
    usageWindow: { from: '2026-10-22', to: '2026-11-20' },
    groups: [
      { groupId: 'grp-top', name: 'Top Producers 2026', people: 4 },
      { groupId: null, name: null, people: 1 },
    ],
    group: null,
    usage: {
      total: { used: 3, of: 5, pct: 60 },
      leaders: { used: 2, of: 3, pct: 67 },
      agents: { used: 1, of: 2, pct: 50 },
      byGroup: [
        {
          groupId: 'grp-top', name: 'Top Producers 2026', total: { used: 2, of: 4, pct: 50 },
          leaders: { used: 1, of: 2, pct: 50 }, agents: { used: 1, of: 2, pct: 50 },
        },
        {
          groupId: null, name: null, total: { used: 1, of: 1, pct: 100 },
          leaders: { used: 1, of: 1, pct: 100 }, agents: { used: 0, of: 0, pct: null },
        },
      ],
    },
    people: PEOPLE,
    production: {
      currency: 'IDR',
      months: [
        { month: '2026-06', apeMinor: 174 * M }, { month: '2026-07', apeMinor: 271 * M }, { month: '2026-08', apeMinor: null },
        { month: '2026-09', apeMinor: 462 * M }, { month: '2026-10', apeMinor: 597.3 * M }, { month: '2026-11', apeMinor: null },
      ],
    },
    setup: null,
    settings: { productsAwaiting: 0, checklistDraftVersion: null },
    ...over,
  };
}

const actual = (over: Partial<PerformanceRow['actual']> = {}) => ({ apeMinor: 563.5 * M, apePct: 18, activeAgents: 2, rekrut: 1, ...over });

/** *Performa vs target* for November (frame 8). */
export function performanceView(over: Partial<OverviewPerformanceView> = {}): OverviewPerformanceView {
  const agus: PerformanceRow = {
    abMembershipId: 'mem-agus', name: 'Agus Prasetyo', agentCode: '87001', photoUrl: null, isGroupLeader: true, people: 4,
    activeAgentTarget: 6, rekrutTarget: 3, source: 'set', fromMonth: '2026-11', rekrutYtdTarget: 3,
    apeTargetMinor: 3100 * M, goalsSet: 3, actual: actual(),
  };
  const maya: PerformanceRow = {
    abMembershipId: 'mem-maya', name: 'Maya Halim', agentCode: '87002', photoUrl: null, isGroupLeader: false, people: 1,
    activeAgentTarget: null, rekrutTarget: null, source: 'none', fromMonth: null, rekrutYtdTarget: 0, apeTargetMinor: 0,
    goalsSet: 0, actual: actual({ apeMinor: 0, apePct: null, activeAgents: 0, rekrut: 0 }),
  };
  const totals = (row: PerformanceRow) => ({
    activeAgentTarget: row.activeAgentTarget ?? 0, rekrutTarget: row.rekrutTarget ?? 0, rekrutYtdTarget: row.rekrutYtdTarget,
    apeTargetMinor: row.apeTargetMinor, unset: row.source === 'none' ? 1 : 0, abGroups: 1, people: row.people, actual: row.actual,
  });
  return {
    month: '2026-11', currentMonth: '2026-11', earliestMonth: '2024-01', latestMonth: '2027-11', max: 999, currency: 'IDR',
    held: true, group: null,
    total: { ...totals(agus), unset: 1, abGroups: 2, people: 5, unplacedPeople: 0, actual: actual({ rekrut: 2 }) } as OverviewPerformanceView['total'],
    groups: [
      { group: { groupId: 'grp-top', name: 'Top Producers 2026' }, leaders: [{ membershipId: 'mem-agus', name: 'Agus Prasetyo' }], totals: totals(agus), abGroups: [agus] },
      { group: null, leaders: [], totals: totals(maya), abGroups: [maya] },
    ],
    canWrite: true,
    ...over,
  };
}

/** Section 4's seven cards, lowest first (frame 6). */
export function complianceView(over: Partial<ComplianceView> = {}): ComplianceView {
  return {
    today: '2026-11-20',
    thresholds: { lowBelowPct: 34, highFromPct: 67 },
    group: null,
    cards: [
      { category: 'activity', count: 1, of: 5, pct: 20 },
      { category: 'leads', count: 2, of: 5, pct: 40 },
      { category: 'events', count: 2, of: 4, pct: 50 },
      { category: 'activation', count: 1, of: 2, pct: 50 },
      { category: 'training', count: 3, of: 5, pct: 60 },
      { category: 'goals', count: 4, of: 5, pct: 80 },
      { category: 'campaigns', count: 0, of: 0, pct: null },
    ],
    catalog: {
      training: [{
        code: 'SALES', label: 'Sales',
        skills: [{ code: 'PROSPECTING', label: 'Prospecting', modules: [{ code: 'PROSPECT_LIST', title: 'Building Your Prospect List' }, { code: 'CLOSING', title: 'Closing' }] }],
      }],
      events: [],
      campaigns: [],
    },
    selected: null,
    can: { override: true },
    ...over,
  };
}

/** The Training card opened on its first module: Dewi and Lukman not done. */
export function trainingSelected(): ComplianceView {
  return complianceView({
    selected: {
      category: 'training', item: 'PROSPECT_LIST', done: 3, of: 5,
      cells: PEOPLE.map((p) => {
        const done = !['mem-dewi', 'mem-lukman'].includes(p.membershipId);
        return { membershipId: p.membershipId, status: done ? 'done' : 'not_started', done, on: null };
      }),
    },
  });
}
