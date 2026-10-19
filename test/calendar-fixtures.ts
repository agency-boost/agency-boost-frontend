import type {
  CalendarBusy, CalendarDownlinePerson, CalendarEntry, CalendarPeopleItem, CalendarRead,
} from '@/lib/calendar';
import { makeMe } from './harness';

/**
 * The calendar's doubles, shared by its page spec and the screens' axe pass. The week is the
 * prototype's own — Monday, Sep 28 to Sunday, Oct 4, 2026, today the Monday — and the people are the
 * seed's (`functional/calendar.md`, *Seed*): Agus the AB, Sari the AAB, Rina and Indah his and her
 * agents.
 */

export const WEEK = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

const CALENDAR_PERMISSIONS = [
  'calendar_entry:read', 'calendar_entry:create', 'calendar_entry:update', 'calendar_entry:delete',
  'calendar_entry:answer', 'calendar_invitee:search',
];

const member = (
  membershipId: string,
  fullName: string,
  initials: string,
  role: 'ab' | 'aab' | 'agent',
  directCount: number,
  extra: string[] = [],
) => makeMe({
  user: {
    id: `u-${membershipId}`, email: `${membershipId}@kpm0417.test`, fullName, preferredName: null,
    pronoun: 'they', initials, platformRole: 'none',
  },
  membership: {
    membershipId, kpmId: 'kpm-1', orgLevelCode: role.toUpperCase(), hierarchyRole: role, status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount,
  },
  permissions: [...CALENDAR_PERMISSIONS, ...extra],
});

/** An AB who leads people: compares, and blocks time. */
export const AGUS = member('mem-agus', 'Agus Santoso', 'AS', 'ab', 2, ['calendar_entry:block']);
/** An Agent: a calendar of her own, nobody to compare. */
export const RINA = member('mem-rina', 'Rina Wijaya', 'RW', 'agent', 0);

export const AB_RUNG = { code: 'AB', label: 'Agency Builder' };
export const AAB_RUNG = { code: 'AAB', label: 'Associate Agency Builder' };
export const AGENT_RUNG = { code: 'AGENT', label: 'Agent' };

/** An entry Agus organises, timed, on today. */
export function entry(over: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    entryId: 'e-standup',
    version: 1,
    type: 'meeting',
    title: 'Weekly unit standup',
    notes: 'Zoom — zoom.us/j/91827364',
    allDay: false,
    date: '2026-09-28',
    start: '09:00',
    end: '09:30',
    startsOn: null,
    endsOn: null,
    startsAt: '2026-09-28T02:00:00.000Z',
    endsAt: '2026-09-28T02:30:00.000Z',
    organiser: { membershipId: 'mem-agus', name: 'Agus Santoso' },
    invitees: [],
    readerIs: 'organiser',
    myAnswer: null,
    ...over,
  };
}

/** A trip: all-day, two office dates. */
export function trip(over: Partial<CalendarEntry> = {}): CalendarEntry {
  return entry({
    entryId: 'e-trip',
    type: 'travel',
    title: 'Client trip — Surabaya',
    notes: '',
    allDay: true,
    date: null,
    start: null,
    end: null,
    startsOn: '2026-09-28',
    endsOn: '2026-09-29',
    startsAt: '2026-09-27T17:00:00.000Z',
    endsAt: '2026-09-29T17:00:00.000Z',
    ...over,
  });
}

/** A compared member's entry they only attend: its time and nothing else. */
export function busy(over: Partial<CalendarBusy> = {}): CalendarBusy {
  return {
    busy: true, allDay: false, date: '2026-09-30', start: '13:00', end: '14:00', startsOn: null, endsOn: null,
    startsAt: '2026-09-30T06:00:00.000Z', endsAt: '2026-09-30T07:00:00.000Z', ...over,
  };
}

/** The office's week, today Monday at 9:45 (the prototype's now-line, `:458`). */
export function weekRead(over: Partial<CalendarRead> = {}): CalendarRead {
  return {
    view: 'week',
    from: WEEK[0],
    to: WEEK[6],
    month: null,
    days: WEEK.map((date) => ({ date, inPeriod: true })),
    previous: '2026-09-21',
    next: '2026-10-05',
    today: '2026-09-28',
    now: { at: '2026-09-28T02:45:00.000Z', minute: 585 },
    subject: { membershipId: 'mem-agus', name: 'Agus Santoso', rung: AB_RUNG },
    entries: [
      entry(),
      entry({ entryId: 'e-prospecting', type: 'task', title: 'Prospecting call block', notes: '', date: '2026-09-29', start: '10:00', end: '11:30' }),
      trip(),
    ],
    ...over,
  };
}

/** September 2026 as the office's month: Monday Aug 31 to Sunday Oct 4, five rows. */
export const MONTH_DAYS = (() => {
  const days = ['2026-08-31'];
  for (let d = 1; d <= 30; d += 1) days.push(`2026-09-${String(d).padStart(2, '0')}`);
  return [...days, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
})();

export function monthRead(over: Partial<CalendarRead> = {}): CalendarRead {
  return {
    ...weekRead(),
    view: 'month',
    from: MONTH_DAYS[0],
    to: MONTH_DAYS[MONTH_DAYS.length - 1],
    month: '2026-09',
    days: MONTH_DAYS.map((date) => ({ date, inPeriod: date.startsWith('2026-09') })),
    previous: '2026-08-01',
    next: '2026-10-01',
    ...over,
  };
}

export function person(
  membershipId: string,
  name: string,
  group: CalendarPeopleItem['group'],
  over: Partial<CalendarPeopleItem> = {},
): CalendarPeopleItem {
  return {
    membershipId, name, rung: AGENT_RUNG, leaderName: 'Agus Santoso', direct: group === 'direct_unit', group, ...over,
  };
}

/**
 * The picker's office, relative to Agus: his agents, Sari's unit, another unit, and his upline. Who
 * is a direct report is the server's `direct`: Sari, an AAB in his group, is one.
 */
export const PEOPLE = [
  person('mem-indah', 'Indah Permata', 'direct_unit'),
  person('mem-sari', 'Sari Dewi', 'group', { rung: AAB_RUNG, direct: true }),
  person('mem-rina', 'Rina Wijaya', 'group', { leaderName: 'Sari Dewi' }),
  person('mem-budi', 'Budi Wicaksono', 'other', { rung: AB_RUNG, leaderName: 'Hendra Kusnadi' }),
  person('mem-hendra', 'Hendra Kusnadi', 'leadership', { rung: AB_RUNG, leaderName: null }),
];

export const peoplePage = (items: CalendarPeopleItem[] = PEOPLE, hasMore = false) => ({
  items,
  page: { cursor: null, nextCursor: hasMore ? 'c-2' : null, limit: 50, hasMore },
});

export function downlinePerson(
  membershipId: string,
  name: string,
  over: Partial<CalendarDownlinePerson> = {},
): CalendarDownlinePerson {
  return {
    membershipId, name, rung: AGENT_RUNG, leaderName: 'Agus Santoso', direct: true, depth: 1, group: 'direct_unit', ...over,
  };
}

/** Everyone Agus coaches: Indah directly, and Sari's unit with Rina in it (D-reach). */
export const DOWNLINE = {
  people: [
    downlinePerson('mem-indah', 'Indah Permata'),
    downlinePerson('mem-sari', 'Sari Dewi', { rung: AAB_RUNG, group: 'group' }),
    downlinePerson('mem-rina', 'Rina Wijaya', { leaderName: 'Sari Dewi', direct: false, depth: 2, group: 'group' }),
  ],
};

/** The group layout's two config reads, for a spec that renders inside `AgentLayout`. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};
