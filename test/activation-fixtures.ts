import type {
  ActivationAspectProgress, ActivationItemProgress, ActivationView, NewHireRow, NewHiresRoster,
} from '@/lib/activation';
import { makeMe } from './harness';

/**
 * The activation's shapes as the API serves them (`lib/activation.ts`), for the four screens' specs and
 * the axe pass: Rina's checklist on the seed's sixteen items in five aspects, with the office's
 * numbered aspect labels (*1. Introduction*) and the three feature links live.
 */

export const RINA = { membershipId: 'mem-rina', name: 'Rina Wijaya' };
export const SARI = { membershipId: 'mem-sari', name: 'Sari Puspita' };
export const ARIEF = { membershipId: 'mem-arief', name: 'Arief Hidayat' };

export const LINKS = {
  'feature:goals': {
    kind: 'feature:goals', label: 'Goal Settings', route: '/goals',
    completesWhen: 'the hire has saved any goal since joining', live: true, form: null,
  },
  'feature:leads': {
    kind: 'feature:leads', label: 'Leads Management', route: '/leads',
    completesWhen: 'the hire has added at least one prospect', live: true, form: null,
  },
  'feature:activity': {
    kind: 'feature:activity', label: 'Activity Management', route: '/activity/log',
    completesWhen: 'the hire has logged activity in four consecutive weeks', live: true, form: null,
  },
  // P18.96-T4 (ADR-0171 §3): the three data-backed items, bound by their codes on the server.
  'sales:first': {
    kind: 'sales:first', label: 'Sales data', route: null,
    completesWhen: 'the hire has a first sale since joining: a sales lead paid and issued, or a policy in the production file',
    live: true, form: 'closing',
  },
  'sales:closings:3': {
    kind: 'sales:closings:3', label: 'Sales data', route: null,
    completesWhen: 'the hire has 3 sales leads paid and issued since joining', live: true, form: 'closing',
  },
  'coaching:weekly:4': {
    kind: 'coaching:weekly:4', label: 'Coaching sessions', route: null,
    completesWhen: '4 1:1s with the hire are recorded in coaching sessions since joining', live: true, form: 'one_on_one',
  },
} as const;

export function item(code: string, label: string, over: Partial<ActivationItemProgress> = {}): ActivationItemProgress {
  return {
    code, label, link: null, done: false, doneAt: null, source: null, doneBy: null, note: null, date: null,
    waiting: false, record: null, ...over,
  };
}

/** The seed's sixteen, with Rina's state on the seed: the three links done, some manual ticks by her and Sari. */
export function rinaItems(): ActivationItemProgress[][] {
  return [
    [
      item('INSURANCE_BASICS', 'Learn insurance basics', {
        done: true, doneAt: '2026-08-10T03:00:00.000Z', source: 'hire', doneBy: RINA, note: 'Read the handbook', date: '2026-08-09',
      }),
      item('CAREER_MINDSET', 'Learn agency career mindset', {
        done: true, doneAt: '2026-08-12T03:00:00.000Z', source: 'leader', doneBy: SARI,
      }),
      item('COMPANY_PROFILE', 'Learn company profile'),
      item('KPM_INTRO_SESSION', 'Join KPM introduction session'),
    ],
    [
      item('GOAL_SETTING', 'Goal setting: APE & activity targets', {
        link: LINKS['feature:goals'], done: true, doneAt: '2026-08-15T03:00:00.000Z', source: 'link', doneBy: RINA,
      }),
      item('CRM_SETUP', 'Set up company CRM system'),
      item('ADD_PROSPECTS', 'Add prospects in Leads Management', {
        link: LINKS['feature:leads'], done: true, doneAt: '2026-08-16T03:00:00.000Z', source: 'link', doneBy: SARI,
      }),
      item('CHECK_CONTEST', 'Check nearest contest'),
    ],
    [
      item('MANDATORY_TRAINING', 'Mandatory training: selling skill & product knowledge'),
      item('CERTIFY_PRODUCTS', 'Certify priority products'),
      item('ROLE_PLAY', 'Role play with leader'),
    ],
    [
      item('JOINT_FIELD_WORK', 'Joint Field Work with leader'),
      // P18.96-T4: completed from her sales data, naming the lead.
      item('FIRST_CASE_CLOSED', 'Close first case independently', {
        link: LINKS['sales:first'], done: true, doneAt: '2026-09-20T03:00:00.000Z', source: 'link', doneBy: RINA,
        record: { collection: 'leads', id: 'lead-ratna' },
      }),
    ],
    [
      item('ACTIVITY_TRACKER_WEEKLY', 'Fill Activity Tracker weekly', { link: LINKS['feature:activity'] }),
      item('WEEKLY_CHECK_IN', 'Weekly 1-on-1 check-in (4 weeks)', { link: LINKS['coaching:weekly:4'] }),
      item('INDEPENDENT_AGENT_MILESTONE', 'Reach Independent Agent milestone (3 independent closings)', {
        link: LINKS['sales:closings:3'],
      }),
    ],
  ];
}

const ASPECTS = [
  ['INTRODUCTION', '1. Introduction'],
  ['INITIAL_SETUP', '2. Initial Setup'],
  ['TRAINING_AND_CERTIFICATION', '3. Training & Certification'],
  ['FIRST_SALE', '4. First Sale'],
  ['ONGOING_HABITS', '5. Ongoing Habits'],
] as const;

/** Aspects from items, with each one's counts and verdict as the server would serve them. */
export function aspectsOf(items: ActivationItemProgress[][]): ActivationAspectProgress[] {
  return ASPECTS.map(([code, label], i) => {
    const list = items[i] ?? [];
    const done = list.filter((it) => it.done).length;
    return {
      code, label, done, total: list.length, items: list,
      status: done === 0 ? 'not_started' : done === list.length ? 'done' : 'in_progress',
    };
  });
}

/** Rina's view, as her own read serves it: day 59 of 90, 5 of 16 done, 31%. */
export function activationView(over: Partial<ActivationView> = {}, items = rinaItems()): ActivationView {
  const aspects = aspectsOf(items);
  const done = aspects.reduce((n, a) => n + a.done, 0);
  const total = aspects.reduce((n, a) => n + a.total, 0);
  return {
    hire: RINA,
    state: 'open',
    startDate: '2026-08-06',
    startCorrected: null,
    today: '2026-10-03',
    day: 59,
    window: 90,
    overdue: false,
    endsOn: '2027-02-06',
    done,
    total,
    pct: Math.round((done / total) * 100),
    aspects,
    firstCaseClosed: true,
    graduatedAt: null,
    graduatedBy: null,
    note: {
      text: 'Great pace on prospecting — let’s book your first JFW this week.',
      by: SARI,
      at: '2026-09-30T03:00:00.000Z',
    },
    ...over,
  };
}

/** Every item done: 100%, the graduation button enabled. */
export function completeView(over: Partial<ActivationView> = {}): ActivationView {
  const items = rinaItems().map((list) => list.map((it) => ({
    ...it, done: true, doneAt: it.doneAt ?? '2026-10-01T03:00:00.000Z', source: it.source ?? (it.link ? 'link' : 'hire'), doneBy: it.doneBy ?? RINA,
  } satisfies ActivationItemProgress)));
  return activationView(over, items);
}

/** A leader's read: the hire's own note and date are `null` on every item (P13-T2 AC-4). */
export function leaderView(over: Partial<ActivationView> = {}): ActivationView {
  const items = rinaItems().map((list) => list.map((it) => ({ ...it, note: null, date: null })));
  return activationView(over, items);
}

const checklist = (pct: number, overdue = false) => ({ state: 'open' as const, done: Math.round((pct * 16) / 100), total: 16, pct, overdue });
const DIRECT = { kind: 'direct' as const, leader: null };
const SARI_UNIT = { kind: 'aab' as const, leader: SARI };
const ARIEF_UNIT = { kind: 'aab' as const, leader: ARIEF };

export function hireRow(name: string, membershipId: string, over: Partial<NewHireRow> = {}): NewHireRow {
  return {
    hire: { membershipId, name }, unit: DIRECT, joinDate: '2026-08-30', day: 59, firstSaleDate: null, firstSaleDay: null,
    firstSaleSource: null, status: 'not_yet', activation3M: 'in_progress', leftOn: null, checklist: checklist(38), ...over,
  };
}

/** A row with a first sale on `day` of its join date (UI-023): Teraktivasi by day 90, in amber after it. */
const sold = (day: number, date: string): Partial<NewHireRow> => ({
  firstSaleDate: date, firstSaleDay: day, firstSaleSource: 'sales',
  status: day <= 90 ? 'activated' : 'activated_late', activation3M: day <= 90 ? 'activated' : 'not_activated',
});

const share = (activated: number, notActivated: number, inProgress: number, pct: number | null, late = 0) =>
  ({ activated, notActivated, late, inProgress, pct });

/**
 * Agus's `/new-hires` on the seed (P18.96-T6; UI V1, UI-023): a year of new hires by their status — his own unit,
 * Arief's and Sari's — with *Aktivasi 3M* at the top, overall and by join month, and each unit's. Rule A: Novi, Rina,
 * Dimas and Indah activated by day 90; Kemal past day 90 with none; Lukman's day-96 sale in amber and in neither part;
 * Tari (marked left — it decides nothing), Budi and Fikri inside their 90 days with none. 4 of 5 decided: 80%.
 */
export const ROSTER: NewHiresRoster = {
  today: '2026-10-27',
  window: { from: '2025-10-28', to: '2026-10-27' },
  days: 90,
  activation3M: {
    all: share(4, 1, 3, 80, 1),
    byMonth: [
      { month: '2026-09', ...share(0, 0, 2, null) },
      { month: '2026-08', ...share(2, 0, 1, 100) },
      { month: '2026-07', ...share(2, 1, 0, 67, 1) },
    ],
  },
  units: [
    { ...DIRECT, activation3M: { all: share(2, 1, 1, 67, 1), byMonth: [{ month: '2026-09', ...share(0, 0, 1, null) }, { month: '2026-07', ...share(2, 1, 0, 67, 1) }] } },
    { ...ARIEF_UNIT, activation3M: { all: share(1, 0, 1, 100), byMonth: [{ month: '2026-09', ...share(0, 0, 1, null) }, { month: '2026-08', ...share(1, 0, 0, 100) }] } },
    { ...SARI_UNIT, activation3M: { all: share(1, 0, 1, 100), byMonth: [{ month: '2026-08', ...share(1, 0, 1, 100) }] } },
  ],
  sections: {
    inProgress: [
      hireRow('Budi Hartono', 'mem-budi', { unit: SARI_UNIT, joinDate: '2026-08-27', day: 62, checklist: checklist(25) }),
      // Marked left on day 35, before any sale: kept as data, and deciding nothing (D-24).
      hireRow('Tari Wulandari', 'mem-tari', { unit: ARIEF_UNIT, joinDate: '2026-09-17', day: 41, leftOn: '2026-10-21', checklist: checklist(19) }),
      // An AAB placed as a new hire: no checklist (ADR-0103).
      hireRow('Fikri Ramadhan', 'mem-fikri', { joinDate: '2026-09-20', day: 38, checklist: null }),
    ],
    activated: [
      hireRow('Rina Wijaya', 'mem-rina', { unit: SARI_UNIT, joinDate: '2026-08-30', day: 59, ...sold(49, '2026-10-17'), checklist: checklist(69) }),
      hireRow('Novi Lestari', 'mem-novi', { unit: ARIEF_UNIT, joinDate: '2026-08-04', day: 85, ...sold(20, '2026-08-23'), checklist: checklist(56) }),
      hireRow('Dimas Saputra', 'mem-dimas', { joinDate: '2026-07-25', day: 95, ...sold(39, '2026-09-01'), checklist: checklist(50, true) }),
      hireRow('Indah Permata', 'mem-indah', { joinDate: '2026-07-22', day: 98, ...sold(42, '2026-09-01'), checklist: checklist(94, true) }),
      hireRow('Lukman Hakim', 'mem-lukman', { joinDate: '2026-07-20', day: 100, ...sold(96, '2026-10-23'), checklist: checklist(25, true) }),
    ],
    notActivated: [
      // Past day 90 with no first sale: the one result that counts against the share.
      hireRow('Kemal Pratama', 'mem-kemal', { joinDate: '2026-07-10', day: 110, activation3M: 'not_activated', checklist: checklist(31, true) }),
    ],
  },
};

export const AGENT_PERMISSIONS = [
  'activation:read', 'activation:update_manual_item', 'activation:graduate', 'coaching_session:read',
];

export const LEADER_PERMISSIONS = [
  ...AGENT_PERMISSIONS, 'activation:set_start_date', 'new_hires:read_roster', 'activation_note:write',
];

/** Rina, an Agent in her activation. */
export const RINA_ME = makeMe({
  user: {
    id: 'u-rina', email: 'rina@kpm0417.test', fullName: 'Rina Wijaya', preferredName: 'Rina',
    pronoun: 'she', initials: 'RW', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: AGENT_PERMISSIONS,
  activation: { open: true, complete: false },
});

/** Sari, the AAB above her, with hires. */
export const SARI_ME = makeMe({
  user: {
    id: 'u-sari', email: 'sari@kpm0417.test', fullName: 'Sari Puspita', preferredName: 'Sari',
    pronoun: 'she', initials: 'SP', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-sari', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3,
  },
  // An AAB runs coaching sessions, so she logs a 1:1 and names a closing for her hires (P18.96-T4 AC-3).
  permissions: [...LEADER_PERMISSIONS, 'coaching_session:create', 'coaching_session:finalize'],
  newHires: true,
});

/** A read-only support session standing in for somebody (§3.13). */
export const readOnlySession = <T extends ReturnType<typeof makeMe>>(me: T): T => ({
  ...me, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root',
});

export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

export const notFound = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-404' } } };

/**
 * P18.96-T4 AC-4: *Weekly 1-on-1 check-in* ticked by Sari with a 1:1 she logged, waiting for the fourth — on `items`,
 * Rina's own by default.
 */
export function withWaitingCheckIn(items = rinaItems()): ActivationItemProgress[][] {
  return items.map((list) => list.map((it) => (it.code === 'WEEKLY_CHECK_IN'
    ? {
      ...it, done: true, doneAt: '2026-09-25T03:00:00.000Z', source: 'leader' as const, doneBy: SARI, waiting: true,
      record: { collection: 'coachingSessions', id: 'session-0925' },
    }
    : it)));
}
