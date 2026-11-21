import type { Me } from '@/lib/session';
import type {
  ActionItem, AgendaItem, ForumPerson, MeetingCan, MeetingCard, MeetingListView, MeetingView,
} from '@/lib/leader-meetings';

/**
 * **The forum's screens as the seed draws office 0417** (`functional/leader-forum.md`, *Seed*; P19.22-T8): #15 in eight
 * days at 14:00 — *Forum berikutnya* — #14 five days ago with two action items *dari forum #13*, #13 and #12 before it.
 * Every shape is the client's (`lib/leader-meetings.ts`), so a field the server stops sending fails to compile here first.
 */

export const LIMITS = { textMax: 500 } as const;

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

/** A steward's grants in the forum, held under `permissions` so the copy guard reads them as the gates they are. */
const STEWARD = {
  permissions: [
    'leader_meeting:read', 'leader_meeting:read_shared_link', 'leader_meeting:create', 'leader_meeting:reschedule',
    'leader_meeting:delete', 'leader_meeting:edit', 'leader_meeting:share_link',
  ],
};

export const OWNER_ME = makeMe({
  user: {
    id: 'u-owner', email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto', preferredName: 'Wilson',
    pronoun: 'they', initials: 'WT', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-0417', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['member:read_profile', ...STEWARD.permissions],
});

/** Agus, an AB tagged *Core leader*: the Owner's rights in the forum (ADR-0268), in the field shell. */
export const CORE_LEADER_ME = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-0417', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: STEWARD.permissions,
});

/** Rina, an Agent: the forum answers her `404`, but a live link opens. */
export const FIELD_ME = makeMe({
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-0417', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['leader_meeting:read', 'leader_meeting:read_shared_link'],
});

export const person = (membershipId: string, name: string, code: string, tagged = true, pickable = true): ForumPerson => ({
  membershipId,
  name,
  firstName: name.split(' ')[0],
  photoUrl: null,
  rung: { code, label: code },
  isReader: membershipId === 'mem-owner',
  tagged,
  pickable,
});

export const WILSON = person('mem-owner', 'Wilson Tanoto', 'AB', false);
export const MAYA = person('mem-maya', 'Maya Halim', 'AAB', false);
export const AGUS = person('mem-agus', 'Agus Santoso', 'AB');
export const SARI = person('mem-sari', 'Sari Dewanti', 'AAB');
export const YOSEF = person('mem-yosef', 'Yosef Pratama', 'AB');
/** A PIC named once who is no longer an editor: drawn, not offered. */
export const HENDRA = person('mem-hendra', 'Hendra Gunawan', 'AB', false, false);

export const CORE_LEADERS = [AGUS, SARI, YOSEF];

export const card = (overrides: Partial<MeetingCard> = {}): MeetingCard => ({
  id: 'm-14', number: 14, date: '2026-11-15', time: '14:00', state: 'completed', daysUntil: -5, agendaCount: 5,
  actionProgress: { done: 1, total: 5 },
  ...overrides,
});

export const MEETINGS: MeetingCard[] = [
  card({ id: 'm-15', number: 15, date: '2026-11-28', state: 'upcoming', daysUntil: 8, agendaCount: 3, actionProgress: { done: 0, total: 4 } }),
  card(),
  card({ id: 'm-13', number: 13, date: '2026-11-01', daysUntil: -19, agendaCount: 3, actionProgress: { done: 2, total: 4 } }),
  card({ id: 'm-12', number: 12, date: '2026-10-18', time: null, daysUntil: -33, agendaCount: 3, actionProgress: { done: 3, total: 3 } }),
];

export const listView = (overrides: Partial<MeetingListView> = {}): MeetingListView => ({
  today: '2026-11-20',
  meetings: MEETINGS,
  nextId: 'm-15',
  coreLeaders: CORE_LEADERS,
  can: { create: true },
  limits: LIMITS,
  ...overrides,
});

const line = (id: string, text: string, pic: string | null, done: boolean, picAll = false): AgendaItem => ({
  id, text, picMembershipId: pic, picAll, done, version: 1,
});

export const AGENDA: AgendaItem[] = [
  line('a-1', 'Review angka MAPA driver dan informal group', 'mem-owner', true),
  line('a-2', 'Update action items forum #13', null, true, true),
  line('a-3', 'Strategi rekrut Q4: tiap AB 1 presentasi rekrut per minggu', 'mem-agus', true),
  line('a-4', 'Rencana Closing Clinic Desember', 'mem-sari', false),
  line('a-5', 'Kesepakatan dan action items baru', null, false),
];

const action = (
  id: string, text: string, pic: string | null, dueOn: string | null, status: ActionItem['status'], fromNumber: number | null,
): ActionItem => ({ id, lineageId: `l-${id}`, text, picMembershipId: pic, dueOn, status, fromNumber, version: 1 });

export const ACTION_ITEMS: ActionItem[] = [
  action('x-1', 'Aktifkan 3 agent yang belum aktif di Tanpa group', 'mem-yosef', '2026-11-27', 'doing', 13),
  action('x-2', '1 presentasi rekrut per AB per minggu', 'mem-agus', '2026-11-30', 'doing', null),
  action('x-3', 'Coaching 1-on-1 tiap minggu untuk agent baru', 'mem-sari', '2026-11-20', 'done', 13),
  action('x-4', 'Siapkan Closing Clinic Desember', 'mem-sari', '2026-12-02', 'todo', null),
  action('x-5', 'Naikkan pemakaian AgencyBoost Tanpa group ke 80%', 'mem-hendra', null, 'todo', null),
];

/** Every write: a steward by the forum's address, the forum written in (no delete), held. */
export const CAN_ALL: MeetingCan = { edit: true, share: true, reschedule: false, delete: false, print: true };

/** By a shared link: nothing but *PDF*. */
export const LINK_CAN: MeetingCan = { edit: false, share: false, reschedule: false, delete: false, print: true };

export const meetingView = (overrides: Partial<MeetingView> = {}): MeetingView => ({
  ...card(),
  version: 1,
  coreLeaders: CORE_LEADERS,
  people: [WILSON, MAYA, AGUS, SARI, YOSEF, HENDRA],
  agenda: AGENDA,
  actionItems: ACTION_ITEMS,
  writtenIn: true,
  via: 'address',
  can: CAN_ALL,
  limits: LIMITS,
  ...overrides,
});

export const notFound = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-404' } } };

export const refusal = (status: number, code: string, message = 'Refused.', details?: Record<string, unknown>) => ({
  status, body: { error: { code, message, requestId: 'r-1', ...(details ? { details } : {}) } },
});
