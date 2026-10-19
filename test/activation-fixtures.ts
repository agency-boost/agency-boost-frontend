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

const LINKS = {
  'feature:goals': {
    kind: 'feature:goals', label: 'Goal Settings', route: '/goals',
    completesWhen: 'the hire has saved any goal since joining', live: true,
  },
  'feature:leads': {
    kind: 'feature:leads', label: 'Leads Management', route: '/leads',
    completesWhen: 'the hire has added at least one prospect', live: true,
  },
  'feature:activity': {
    kind: 'feature:activity', label: 'Activity Management', route: '/activity/log',
    completesWhen: 'the hire has logged activity in four consecutive weeks', live: true,
  },
} as const;

export function item(code: string, label: string, over: Partial<ActivationItemProgress> = {}): ActivationItemProgress {
  return {
    code, label, link: null, done: false, doneAt: null, source: null, doneBy: null, note: null, date: null, ...over,
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
      item('FIRST_CASE_CLOSED', 'Close first case independently', {
        done: true, doneAt: '2026-09-20T03:00:00.000Z', source: 'hire', doneBy: RINA,
      }),
    ],
    [
      item('ACTIVITY_TRACKER_WEEKLY', 'Fill Activity Tracker weekly', { link: LINKS['feature:activity'] }),
      item('WEEKLY_CHECK_IN', 'Weekly 1-on-1 check-in (4 weeks)'),
      item('INDEPENDENT_AGENT_MILESTONE', 'Reach Independent Agent milestone (3 independent closings)'),
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

export function hireRow(name: string, membershipId: string, over: Partial<NewHireRow> = {}): NewHireRow {
  return {
    hire: { membershipId, name }, startDate: '2026-08-06', day: 59, window: 90, overdue: false, pct: 38, firstCaseClosed: false, ...over,
  };
}

/** Agus's roster on the seed: his own unit, then each AAB's. */
export const ROSTER: NewHiresRoster = {
  today: '2026-10-03',
  groups: [
    {
      kind: 'direct',
      leader: null,
      hires: [
        hireRow('Indah Permata', 'mem-indah', { startDate: '2026-06-28', day: 98, overdue: true, pct: 94, firstCaseClosed: true }),
        hireRow('Dimas Saputra', 'mem-dimas', { startDate: '2026-07-01', day: 95, overdue: true, pct: 50 }),
      ],
    },
    {
      kind: 'aab',
      leader: SARI,
      hires: [
        hireRow('Budi Hartono', 'mem-budi', { startDate: '2026-08-03', day: 62, pct: 25 }),
        hireRow('Rina Wijaya', 'mem-rina', { firstCaseClosed: true }),
        hireRow('Yanti Kusuma', 'mem-yanti', { startDate: '2026-09-05', day: 29, pct: 6 }),
      ],
    },
    {
      kind: 'aab',
      leader: ARIEF,
      hires: [hireRow('Novi Lestari', 'mem-novi', { startDate: '2026-07-11', day: 85, pct: 56 })],
    },
  ],
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
  permissions: LEADER_PERMISSIONS,
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
