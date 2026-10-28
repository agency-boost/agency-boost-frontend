import type { Me } from '@/lib/session';
import type {
  ActionItem, AgendaItem, AgendaSection, ColumnKey, ForumPerson, MeetingCard, MeetingEditors, MeetingListView,
  MeetingView, RowKey, Scorecard, ScorecardCell, ScorecardRow,
} from '@/lib/leader-meetings';

/**
 * The forum's screens as the seed draws office 0417 (`functional/leader-forum.md`, *Seed*): #14 in three days,
 * #13 two weeks ago and frozen, #12 four weeks ago with nothing open. Every shape is the client's
 * (`lib/leader-meetings.ts`), so a field the server stops sending fails to compile here first.
 */

export const LIMITS = { titleMax: 120, textMax: 500, picMax: 80, targetMax: 40 } as const;

/** What the shells around the pages read. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};


/** A signed-in member, as `/auth/me` answers (`test/harness.tsx`'s `makeMe`, kept out of the app's own files). */
const makeMe = (overrides: Partial<Me>): Me => ({
  user: {
    id: 'u-1', email: 'rina@kpm0417.test', fullName: 'Rina Wijaya', preferredName: 'Rina',
    pronoun: 'they', initials: 'RW', platformRole: 'none',
  },
  membership: null,
  isImpersonating: false,
  impersonationReadOnly: false,
  impersonatedBy: null,
  mustChangePassword: false,
  permissions: [],
  activation: null,
  newHires: false,
  ...overrides,
});

export const OWNER_ME = makeMe({
  user: {
    id: 'u-owner', email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto', preferredName: 'Wilson',
    pronoun: 'they', initials: 'WT', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-0417', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
  permissions: [
    'member:read_profile', 'leader_meeting:read', 'leader_meeting:read_shared_link', 'leader_meeting:create', 'leader_meeting:reschedule',
    'leader_meeting:delete', 'leader_meeting:edit', 'leader_meeting:share_link', 'member:tag_core_leader',
  ],
});

/** Agus, an AB tagged Core Leader: the field view, every field's write and *Share*, nothing else. */
export const CORE_LEADER_ME = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-0417', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['leader_meeting:read', 'leader_meeting:read_shared_link', 'leader_meeting:edit', 'leader_meeting:share_link'],
});

/** Rina, an Agent not tagged: the forum answers her `404`, but a live link opens. */
export const FIELD_ME = makeMe({
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-0417', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['leader_meeting:read', 'leader_meeting:read_shared_link'],
});

export const person = (
  membershipId: string, name: string, code: string, isReader = false, tagged = true,
): ForumPerson => ({
  membershipId,
  name,
  rung: { code, label: code === 'AB' ? 'Agency Builder' : code === 'AAB' ? 'Associate Agency Builder' : 'Agent' },
  isReader,
  tagged,
});

export const WILSON = person('mem-owner', 'Wilson Tanoto', 'AB', false, false);
/** An Admin not tagged, as the seed has her: an editor, but not one of *"{n} core leaders tagged"*. */
export const MAYA = person('mem-maya', 'Maya Halim', 'AAB', false, false);
export const AGUS = person('mem-agus', 'Agus Santoso', 'AB');
export const SARI = person('mem-sari', 'Sari Dewanti', 'AAB');
export const YOSEF = person('mem-yosef', 'Yosef Pratama', 'AB');

export const editors = (overrides: Partial<MeetingEditors> = {}): MeetingEditors => ({
  owner: WILSON,
  admins: [MAYA],
  coreLeaders: [AGUS, SARI, YOSEF],
  coreLeaderCount: 3,
  frozen: false,
  ...overrides,
});

export const card = (overrides: Partial<MeetingCard> = {}): MeetingCard => ({
  id: 'm-14',
  number: 14,
  title: 'Strategic Check-in — #14',
  date: '2026-10-13',
  state: 'upcoming',
  editors: editors(),
  openItems: 4,
  ...overrides,
});

export const MEETINGS: MeetingCard[] = [
  card(),
  card({
    id: 'm-13', number: 13, title: 'Strategic Check-in — #13', date: '2026-09-26', state: 'completed',
    editors: editors({ coreLeaders: [AGUS, SARI], coreLeaderCount: 2, frozen: true }), openItems: 2,
  }),
  card({
    id: 'm-12', number: 12, title: 'Strategic Check-in — #12', date: '2026-09-12', state: 'completed',
    editors: editors({ coreLeaders: [AGUS], coreLeaderCount: 1, frozen: true }), openItems: 0,
  }),
];

export const listView = (overrides: Partial<MeetingListView> = {}): MeetingListView => ({
  meetings: MEETINGS,
  can: { create: true },
  limits: LIMITS,
  ...overrides,
});

const figure = (value: number, leavesOut: string[] = []): ScorecardCell => ({ kind: 'figure', value, leavesOut });
const cells = (make: (column: ColumnKey) => ScorecardCell): Record<ColumnKey, ScorecardCell> => ({
  fy: make('fy'), ytdLastYear: make('ytdLastYear'), ytd: make('ytd'),
  thisMonthLastYear: make('thisMonthLastYear'), lastMonth: make('lastMonth'), thisMonth: make('thisMonth'),
});
const row = (
  key: RowKey, unit: ScorecardRow['unit'], make: (column: ColumnKey) => ScorecardCell,
  monthlyTarget: ScorecardRow['monthlyTarget'], ytdChange: ScorecardRow['ytdChange'] = { kind: 'none' },
): ScorecardRow => ({ key, unit, cells: cells(make), ytdChange, monthlyTarget });
const left = (column: ColumnKey) => column === 'fy' || column === 'ytdLastYear' || column === 'ytd';
const target = (rate: number | null, value: number | null, version: number) => ({ rate, value, typed: null, version });

/** #14's scorecard, the reference slide's table: 9 units — 5 ABs and 4 AABs — and its targets as rates. */
export const scorecard = (overrides: Partial<Scorecard> = {}): Scorecard => ({
  periods: {
    fy: { from: '2025-01', to: '2025-12' }, ytdLastYear: { from: '2025-01', to: '2025-10' }, ytd: { from: '2026-01', to: '2026-10' },
    thisMonthLastYear: { from: '2025-10', to: '2025-10' }, lastMonth: { from: '2026-09', to: '2026-09' }, thisMonth: { from: '2026-10', to: '2026-10' },
  },
  chips: { manpower: 28, agents: 19, units: 9, ab: 5, aab: 4 },
  rows: [
    row('ape', 'idr_minor', (c) => (c === 'thisMonth' ? { kind: 'pending' } : figure(c === 'ytd' ? 580_000_000_000 : 490_000_000_000)), target(null, null, 1), { kind: 'figure', value: 18, unit: 'percent' }),
    row('manpower', 'count', () => figure(28), target(null, null, 0), { kind: 'figure', value: 4, unit: 'percent' }),
    row('flc', 'count', () => ({ kind: 'pending' }), target(1, 9, 1)),
    row('producing_agents', 'count', (c) => (left(c) ? figure(23) : { kind: 'blocked' }), null, { kind: 'figure', value: 10, unit: 'percent' }),
    row('new_agent_3m', 'percentage', (c) => (left(c) ? figure(50) : { kind: 'blocked' }), null, { kind: 'figure', value: 0, unit: 'points' }),
    row('avg_monthly_aa', 'count', () => figure(19), target(3, 27, 1), { kind: 'figure', value: 6, unit: 'percent' }),
    row('case_submission', 'count', (c) => (c === 'thisMonth' ? { kind: 'pending' } : figure(c === 'ytd' ? 330 : 300)), target(null, null, 1), { kind: 'figure', value: 10, unit: 'percent' }),
    row('cases_per_producing_agent', 'ratio', (c) => (left(c) ? figure(14.3) : { kind: 'blocked' }), null, { kind: 'figure', value: 0, unit: 'percent' }),
    row('average_case_size', 'idr_minor', (c) => (left(c) ? { kind: 'none' } : { kind: 'blocked' }), null),
  ],
  asOf: { kind: 'date', date: '2026-10-26' },
  partialPeriods: [],
  frozenAt: null,
  ...overrides,
});

const item = (id: string, text: string, pic = '', done = false): AgendaItem => ({ id, text, pic, done, version: 1 });

export const AGENDA: Record<AgendaSection, AgendaItem[]> = {
  preparation: [
    item('a-1', 'Compile follow-ups & commitments from prior session', 'Wilson'),
    item('a-2', 'Prepare September performance data', 'Wilson'),
  ],
  during: [item('a-3', 'Process update — review prior follow-ups'), item('a-4', 'Performance review vs. key thresholds', '', true)],
  post: [item('a-5', 'Note feedback for RBDO/BDO')],
};

export const ACTION_ITEMS: ActionItem[] = [
  {
    id: 'x-1', initiative: 'Activity tracking tool adoption', metric: 'Adoption 80% (currently 63%)',
    action: 'Socialization on Activity Tracking Tool in LWS session', pic: 'Amelia', status: 'planned',
    remarks: 'Scheduled for 2 Sept', version: 1,
  },
  {
    id: 'x-2', initiative: 'Leads Generation Playbook', metric: '# of new prospects',
    action: 'Embed into recruitment onboarding', pic: 'Ferry / Joy', status: 'not_planned', remarks: 'TBD', version: 1,
  },
];

const CAN_ALL = { edit: true, share: true, reschedule: true, delete: false, manageTags: true, print: true };

export const meetingView = (overrides: Partial<MeetingView> = {}): MeetingView => ({
  ...card(),
  version: 3,
  branch: 'BSD City Branch',
  scorecard: scorecard(),
  agenda: AGENDA,
  actionItems: ACTION_ITEMS,
  writtenIn: true,
  via: 'address',
  accessNote: { ownerName: 'Wilson Tanoto', adminNames: ['Maya Halim'] },
  can: CAN_ALL,
  limits: LIMITS,
  ...overrides,
  editors: overrides.editors ?? editors({ owner: { ...WILSON, isReader: true } }),
});

/** A Core Leader's read: every field's write and *Share*, no date control, no *Manage tags →*. */
export const CORE_LEADER_CAN = { edit: true, share: true, reschedule: false, delete: false, manageTags: false, print: true };

/** By a shared link: nothing but *Save as PDF* (contract, Noted 3). */
export const LINK_CAN = { edit: false, share: false, reschedule: false, delete: false, manageTags: false, print: true };

export const notFound = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-404' } } };

export const refusal = (status: number, code: string, message = 'Refused.', details?: Record<string, unknown>) => ({
  status, body: { error: { code, message, requestId: 'r-1', ...(details ? { details } : {}) } },
});
