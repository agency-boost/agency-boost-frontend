import type { NewHireRow, NewHiresRoster } from './activation';
import type { LastOneOnOne, Roster, RosterRow, RosterStatus } from './coaching';
import type { HomeView } from './home';
import type { OrgTree, OrgTreeNode } from './org';
import type { UnitDashboardView, UnitRow } from './unit-dashboard';

/**
 * **The *Contoh* samples' data** (P19-T4 AC-3; ADR-0189 §3, UI-159 item 3): what an empty leader page draws, greyed,
 * under its normal layout — **the page's own components fed these**, never a drawing of their own.
 *
 * Fictional and obviously so (ADR-0189 §3): the people are named by the caller as what they are — *Agen contoh 1* —
 * their ids start `sample-`, every number is small and round, no phone, no photo, no agent code but `00000`. **Nothing
 * here is sent anywhere or counted**: a sample is built in the browser, drawn inert, and read by no figure.
 *
 * Pure: names in, data out (`sample-data.spec.ts`).
 */

/** How many sample people a sample shows. */
export const SAMPLE_PEOPLE = 3;

/** Every sample id starts with this, so a sample row can never be mistaken for a member. */
export const SAMPLE_ID_PREFIX = 'sample-';

/** A sample person's name, by number from 1: the catalogue's *Agen contoh {n}*. */
export type SampleName = (n: number) => string;

const ids = Array.from({ length: SAMPLE_PEOPLE }, (_, i) => `${SAMPLE_ID_PREFIX}${i + 1}`);
const STATUSES: readonly RosterStatus[] = ['on_track', 'watch_closely', 'needs_attention'];

const lastOneOnOne = (today: string, i: number): LastOneOnOne => ({
  days: 3 + i * 5, date: today, overdue: i === 2, coach: null,
});

/** Coaching's roster (`CoachingRoster`): three direct agents, one of each status. */
export function sampleRoster(name: SampleName, today: string): Roster {
  const directAgents: RosterRow[] = ids.map((membershipId, i) => ({
    membershipId,
    name: name(i + 1),
    photoUrl: null,
    rung: { code: 'AGENT', label: 'Agent' },
    depth: 1,
    lastOneOnOne: lastOneOnOne(today, i),
    status: STATUSES[i],
  }));
  return { today, overdueAfterDays: 14, directAgents, units: [] };
}

/** The Group Tree (`GroupTree`): a sample leader and three agents under them. */
export function sampleOrgTree(name: SampleName, leader: string): OrgTree {
  const head = `${SAMPLE_ID_PREFIX}leader`;
  const node = (membershipId: string, fullName: string, over: Partial<OrgTreeNode>): OrgTreeNode => ({
    membershipId,
    fullName,
    preferredName: null,
    initials: fullName.slice(0, 2).toUpperCase(),
    agentCode: '00000',
    role: 'agent',
    depth: 1,
    layer: 2,
    leaderId: head,
    directCount: 0,
    directCounts: { ab: 0, aab: 0, agent: 0, total: 0 },
    subtreeCount: 0,
    isLeader: false,
    isSelf: false,
    todayActivityCount: 0,
    photoUrl: null,
    ...over,
  });
  const agents = ids.map((id, i) => node(id, name(i + 1), { todayActivityCount: [5, 2, 0][i] }));
  return {
    nodes: [
      node(head, leader, {
        role: 'ab', depth: 0, layer: 1, leaderId: null, directCount: SAMPLE_PEOPLE, isLeader: true, isSelf: true,
        directCounts: { ab: 0, aab: 0, agent: SAMPLE_PEOPLE, total: SAMPLE_PEOPLE }, subtreeCount: SAMPLE_PEOPLE,
      }),
      ...agents,
    ],
    leader: null,
    rootIds: [head],
    selfId: head,
    counts: { ab: 1, aab: 0, agent: SAMPLE_PEOPLE, total: SAMPLE_PEOPLE + 1 },
  };
}

/** New Hires' roster (`NewHires`' group): three hires in their first months, none activated yet. */
export function sampleNewHires(name: SampleName, today: string): NewHiresRoster {
  const share = { activated: 1, notActivated: 0, late: 0, inProgress: 2, pct: 33 };
  const rows: NewHireRow[] = ids.map((membershipId, i) => ({
    // No photo (ADR-0189 §3): a sample's circle is its initials (P19.11-T2 AC-4).
    hire: { membershipId, name: name(i + 1), photoUrl: null },
    unit: { kind: 'direct', leader: null },
    joinDate: today,
    day: [12, 40, 75][i],
    firstSaleDate: null,
    firstSaleDay: null,
    firstSaleSource: null,
    status: 'not_yet',
    activation3M: 'in_progress',
    leftOn: null,
    checklist: { state: 'open', done: [2, 5, 8][i], total: 10, pct: [20, 50, 80][i], overdue: false },
  }));
  return {
    today,
    year: 'current',
    window: { from: today, to: today },
    days: 90,
    activation3M: { all: share, byMonth: [] },
    units: [{ kind: 'direct', leader: null, activation3M: { all: share, byMonth: [] } }],
    sections: { inProgress: rows, activated: [], notActivated: [] },
  };
}

/**
 * The Unit Dashboard (`UnitTiles`, `UnitRoster`): the server's own empty view — its day, month and frame — with three
 * sample agents on the roster and the tiles over them. No money is shown that could be anybody's: every goal is a
 * round sample figure.
 */
export function sampleUnitView(base: UnitDashboardView, name: SampleName): UnitDashboardView {
  const million = 100_000_000; // Rp 1 Jt in sen
  const rows: UnitRow[] = ids.map((membershipId, i) => {
    const target = 10 * million;
    const actual = [8, 5, 2][i] * million;
    return {
      membershipId,
      name: name(i + 1),
      photoUrl: null,
      // No phone (ADR-0189 §3): a sample's WhatsApp is drawn as it will look, inert.
      phone: null,
      isReader: false,
      rung: { code: 'AGENT', label: 'Agent' },
      depth: 1,
      leads: false,
      coached: i < 2,
      goal: {
        set: true, period: 'month', targetMinor: target, actualMinor: actual, attainmentPct: (actual / target) * 100,
        gapMinor: target - actual, overMinor: null, policiesNeeded: 1, caseSizeMinor: 2 * million, targetMet: false,
        source: null,
      },
      production: {
        monthly: { valueMinor: actual, provenance: null, correctedBy: null, correctedAt: null },
        ytd: { valueMinor: actual * 3, provenance: null, correctedBy: null, correctedAt: null },
      },
      leadsCounts: { salesOpen: 4 - i, salesClosing: 1, recruitOpen: i === 0 ? 1 : 0, recruitNominated: 0 },
      closings: 2 - Math.min(i, 2),
      // No sample proposals: a count of a reader's own that is not theirs would be invented (ADR-0062).
      proposalsMade: 0,
      activity: {
        leads: { logged: 6 - i * 2, target: 10 },
        appointments: { logged: 3 - i, target: 4 },
        closings: { logged: 2 - Math.min(i, 2), target: 2 },
        touches: { logged: 10 - i * 3, target: null },
      },
      lastOneOnOne: lastOneOnOne(base.today, i),
      status: STATUSES[i],
      pacingToMaa: i < 2,
      newHireBeforeFirstSale: false,
      followUp: null,
      chasingMdrt: null,
      campaigns: null,
    };
  });
  const target = SAMPLE_PEOPLE * 10 * million;
  const actual = 15 * million;
  const goal = {
    targetMinor: target, actualMinor: actual, attainmentPct: (actual / target) * 100, missing: 0,
    gapMinor: target - actual, overMinor: null,
  };
  const potentialActive = { count: 2, of: SAMPLE_PEOPLE };
  return {
    ...base,
    empty: false,
    tiles: {
      team: { total: SAMPLE_PEOPLE, direct: SAMPLE_PEOPLE, units: 0, underUnits: 0, aab: 0, ab: 0, newHires: 0 },
      directGroupProduction: { ...goal, period: base.tiles.directGroupProduction.period },
      potentialActive: { ...potentialActive, unit: potentialActive, aab: { count: 0, of: 0 }, ab: { count: 0, of: 0 } },
      potentialRecruits: { yourUnit: 1, aabs: 0, abs: 0 },
    },
    yourUnit: {
      rows,
      total: {
        goal,
        leadsCounts: { salesOpen: 9, salesClosing: 3, recruitOpen: 1, recruitNominated: 0 },
        closings: 3,
        proposalsMade: 0,
        touches: { logged: 21, target: null },
        potentialActive,
        newHires: 0,
      },
    },
    units: [],
    production: { ...base.production, canUpdate: false },
    lastUpload: null,
  };
}

/**
 * Home for somebody in no office (UI-166): the reader's tiles and the seven-day chart, at sample figures, on the
 * browser's day — no read is made for it.
 */
export function sampleHomeView(today: string, quote: HomeView['quote']): HomeView {
  const counts = [3, 5, 2, 6, 4, 0, 3];
  const day = (offset: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const days = counts.map((count, i) => ({ date: day(counts.length - 1 - i), count }));
  return {
    today,
    yesterday: day(1),
    month: today.slice(0, 7),
    // 09:00 in Jakarta on the browser's day (P19.11-T1: `now` carries its instant); nothing here counts on from it.
    now: { minute: 9 * 60, at: `${today}T02:00:00.000Z` },
    quote,
    activity: { today: 3, yesterday: 0, days, total: counts.reduce((a, b) => a + b, 0) },
    schedule: { meetings: 2, tasks: 1 },
    actions: [],
    // *Leads* (P19.8-T2 AC-4): every reader's tile, the Agent's too; *New hires* is not this reader's.
    leads: 4,
    newHires: 0,
    leader: null,
  };
}
