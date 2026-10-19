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

const figure = (value: number): ScorecardCell => ({ kind: 'figure', value, leavesOut: [] });
const cells = (make: (column: ColumnKey) => ScorecardCell): Record<ColumnKey, ScorecardCell> => ({
  fy: make('fy'), ytd: make('ytd'), thisMonthLastYear: make('thisMonthLastYear'), lastMonth: make('lastMonth'), thisMonth: make('thisMonth'),
});
const row = (
  key: RowKey, unit: ScorecardRow['unit'], make: (column: ColumnKey) => ScorecardCell,
  monthlyTarget: ScorecardRow['monthlyTarget'],
): ScorecardRow => ({ key, unit, cells: cells(make), monthlyTarget });
const left = (column: ColumnKey) => column === 'fy' || column === 'ytd';

export const scorecard = (overrides: Partial<Scorecard> = {}): Scorecard => ({
  periods: { fy: '2025', ytd: '2026', thisMonthLastYear: '2025-10', lastMonth: '2026-09', thisMonth: '2026-10' },
  chips: { manpower: 187, agents: 155, units: 8, ab: 8, aab: 24 },
  rows: [
    row('ape', 'idr_minor', () => figure(84_000_000_000), { value: 'TBD', version: 1 }),
    row('manpower', 'count', () => figure(187), { value: '', version: 0 }),
    row('flc', 'count', () => ({ kind: 'pending' }), { value: '8 (1 @ unit)', version: 1 }),
    row('producing_agents', 'count', (c) => (left(c) ? figure(71) : { kind: 'blocked' }), null),
    row('new_aa', 'count', () => figure(3), { value: 'TBD', version: 1 }),
    row('new_agent_3m', 'percentage', (c) => (left(c) ? figure(24) : { kind: 'blocked' }), null),
    row('avg_monthly_aa', 'count', () => figure(11), { value: '22 (3 @ unit)', version: 1 }),
    row('case_submission', 'count', () => figure(22), { value: 'TBD', version: 1 }),
    row('average_case_size', 'idr_minor', (c) => (left(c) ? { kind: 'none' } : { kind: 'blocked' }), null),
  ],
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
