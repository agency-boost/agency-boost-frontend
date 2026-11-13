import type { CalendarEntry, CalendarTask } from '@/lib/calendar';
import type { HomeTeamPerson, HomeView } from '@/lib/home';
import { makeMe } from './harness';

/**
 * **Home's fixtures** (Phase 18.11 T11; UI-100, UI-101): the mockup's leader — Agus Prasetyo, AB, on 30 October 2026 at
 * 09:05 in Jakarta, nothing logged today and five yesterday — and an agent's Home, as `GET /home` answers them. Shared by
 * the page's spec and the axe sweep, so both read the same screen.
 */
export const AGUS = makeMe({
  user: { ...makeMe().user, fullName: 'Agus Prasetyo' },
  permissions: ['personal_summary:read', 'unit_dashboard:read', 'member:update_phone'],
});

/**
 * **The AB as the 7 November review signed in** (P19.8-T2): Agus with his writes — *Buat proposal* (`proposal:create`),
 * *Tambah user* (`member:invite`) and the Calendar's entries — on an AB rung, leading people.
 */
export const AGUS_AB = makeMe({
  ...AGUS,
  membership: { ...AGUS.membership!, hierarchyRole: 'ab', directCount: 3 },
  permissions: [
    ...AGUS.permissions, 'proposal:read', 'proposal:create', 'member:invite', 'member:search_untagged_pool',
    'calendar_entry:create', 'calendar_entry:update', 'calendar_entry:delete', 'calendar_entry:answer',
  ],
});

/** An AAB who leads nobody (the review's Dewi): every leader's tile and the team report, at zero. */
export const DEWI_AAB = makeMe({
  ...AGUS_AB,
  user: { ...AGUS.user, fullName: 'Dewi Lestari' },
  membership: { ...AGUS.membership!, hierarchyRole: 'aab', directCount: 0 },
});

/** An Agent: *Buat proposal* only, no leader tile; New Hires in the menu only where they coach a new hire. */
export const RINA_AGENT = makeMe({
  user: { ...makeMe().user, fullName: 'Rina Wijaya' },
  membership: { ...AGUS.membership!, hierarchyRole: 'agent', directCount: 0 },
  permissions: ['personal_summary:read', 'proposal:read', 'proposal:create', 'calendar_entry:create', 'calendar_entry:update', 'calendar_entry:delete', 'calendar_entry:answer'],
  newHires: false,
});

const person = (name: string, over: Partial<HomeTeamPerson> = {}): HomeTeamPerson => ({
  membershipId: `m-${name.split(' ')[0].toLowerCase()}`, name, phone: '+6281211002200', photoUrl: null, inUnit: true,
  rung: AGENT_RUNG, yesterday: null, today: null, ...over,
});

/** The seeded ladder's rungs, as `GET /home` names them (P19.9-T2 AC-2). */
export const AGENT_RUNG = { code: 'AGENT', label: 'Agent' };
export const AAB_RUNG = { code: 'AAB', label: 'AAB' };

/** The mockup's leader (Agus, 30 Oct 2026): nothing logged today, five yesterday; the server's order. */
export const TEAM: HomeTeamPerson[] = [
  person('Lukman Hakim', { phone: null }),
  person('Herman Widjaja', { inUnit: false, rung: AAB_RUNG }),
  person('Siti Rahmawati', { yesterday: 3 }),
  person('Dewi Lestari', { inUnit: false, rung: AAB_RUNG, yesterday: 2 }),
  person('Rina Wijaya', { inUnit: false, yesterday: 1, today: 0 }),
  person('Indah Permatasari', { yesterday: 5, today: 2 }),
  person('Novi Andriani', { inUnit: false, yesterday: 4, today: 6 }),
];

/**
 * The entry *Aksi hari ini*'s third row opens over Home (P19.8-T2 AC-7): Agus organises it, with nobody invited — **today**,
 * 15:00 to 16:00 (P19.11-T1 AC-3: Home lists today's alone; it was the next day's).
 */
export const HUDDLE_ENTRY: CalendarEntry = {
  entryId: 'e-1', type: 'meeting', title: 'Weekly unit huddle', notes: 'Kantor — Ruang Rapat A',
  date: '2026-10-30', start: '15:00', end: '16:00', startsOn: null, endsOn: null, allDay: false,
  startsAt: '2026-10-30T08:00:00.000Z', endsAt: '2026-10-30T09:00:00.000Z',
  organiser: { membershipId: 'mem-agus', name: 'Agus Prasetyo' }, invitees: [], readerIs: 'organiser',
  myAnswer: null, version: 3,
};

/** Today's coaching action item, from Wilson — *Dari: WILSON TANOTO* — as the Calendar's task (P19.11-T1 AC-3). */
export const WILSON_TASK: CalendarTask = {
  taskId: 'coaching:s-1:i-1', source: 'coaching', date: '2026-10-30', ownerMembershipId: 'mem-agus', name: 'Wilson Tanoto',
  note: 'Siapkan daftar 20 prospek baru', phone: '+6281299990000', lead: null,
  coaching: { sessionId: 's-1', itemId: 'i-1', coachMembershipId: 'm-wilson' }, done: false,
};

/** Today's lead next action, *Ibu Wiwik Setyaningsih*'s, as the Calendar's task, at version 2. */
export const WIWIK_TASK: CalendarTask = {
  taskId: 'lead:l-1', source: 'lead', date: '2026-10-30', ownerMembershipId: 'mem-agus', name: 'Ibu Wiwik Setyaningsih',
  note: 'Invite BOP', phone: '+6281211112222', lead: { leadId: 'l-1', version: 2 }, coaching: null, done: false,
};

export const LEADER: HomeView = {
  today: '2026-10-30', yesterday: '2026-10-29', month: '2026-10', now: { minute: 9 * 60 + 5, at: '2026-10-30T02:05:00.000Z' },
  quote: { index: 2, text: 'Success is the sum of small efforts, repeated day in and day out.', person: 'Robert Collier', pose: 'thinking' },
  activity: {
    today: 0, yesterday: 5, total: 18,
    days: [
      { date: '2026-10-24', count: 0 }, { date: '2026-10-25', count: 0 }, { date: '2026-10-26', count: 3 },
      { date: '2026-10-27', count: 6 }, { date: '2026-10-28', count: 4 }, { date: '2026-10-29', count: 5 },
      { date: '2026-10-30', count: 0 },
    ],
  },
  schedule: { meetings: 2, tasks: 3 },
  // P19.11-T1 AC-3: today's alone, in the Calendar's own shapes — a coaching item, a lead's next action, then the huddle.
  actions: [
    { kind: 'task', task: WILSON_TASK },
    { kind: 'task', task: WIWIK_TASK },
    { kind: 'entry', entry: HUDDLE_ENTRY },
  ],
  leads: 16,
  newHires: 3,
  leader: {
    activeAgent: { count: 4, of: 12, unit: { count: 1, of: 4 }, aab: { count: 3, of: 8 } },
    coached7d: { count: 2, of: 12, unit: { count: 1, of: 4 }, aab: { count: 1, of: 8 } },
    team: TEAM,
  },
};

/**
 * A leader by role with nobody yet (ADR-0189 §4; the review's empty AAB, MOB UI-166): the block at zero, the server's
 * answer — nothing logged, nothing to do, no lead, no new hire.
 */
export const NEW_LEADER: HomeView = {
  ...LEADER,
  activity: { today: 0, yesterday: 0, total: 0, days: LEADER.activity.days.map((d) => ({ ...d, count: 0 })) },
  schedule: { meetings: 0, tasks: 0 },
  actions: [],
  leads: 0,
  newHires: 0,
  leader: {
    activeAgent: { count: 0, of: 0, unit: { count: 0, of: 0 }, aab: { count: 0, of: 0 } },
    coached7d: { count: 0, of: 0, unit: { count: 0, of: 0 }, aab: { count: 0, of: 0 } },
    team: [],
  },
};

export const AGENT_VIEW: HomeView = {
  ...LEADER,
  activity: { ...LEADER.activity, today: 2, yesterday: 0 },
  schedule: { meetings: 0, tasks: 0 },
  actions: [],
  leads: 5,
  newHires: 0,
  leader: null,
};

