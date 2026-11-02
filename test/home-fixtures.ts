import type { HomeTeamPerson, HomeView } from '@/lib/home';
import { makeMe } from './harness';

/**
 * **Home's fixtures** (Phase 18.99 T11; UI-100, UI-101): the mockup's leader — Agus Prasetyo, AB, on 30 October 2026 at
 * 09:05 in Jakarta, nothing logged today and five yesterday — and an agent's Home, as `GET /home` answers them. Shared by
 * the page's spec and the axe sweep, so both read the same screen.
 */
export const AGUS = makeMe({
  user: { ...makeMe().user, fullName: 'Agus Prasetyo' },
  permissions: ['personal_summary:read', 'unit_dashboard:read', 'member:update_phone'],
});

const person = (name: string, over: Partial<HomeTeamPerson> = {}): HomeTeamPerson => ({
  membershipId: `m-${name.split(' ')[0].toLowerCase()}`, name, phone: '+6281211002200', photoUrl: null, inUnit: true,
  yesterday: null, today: null, ...over,
});

/** The mockup's leader (Agus, 30 Oct 2026): nothing logged today, five yesterday; the server's order. */
export const TEAM: HomeTeamPerson[] = [
  person('Lukman Hakim', { phone: null }),
  person('Herman Widjaja', { inUnit: false }),
  person('Siti Rahmawati', { yesterday: 3 }),
  person('Dewi Lestari', { inUnit: false, yesterday: 2 }),
  person('Rina Wijaya', { inUnit: false, yesterday: 1, today: 0 }),
  person('Indah Permatasari', { yesterday: 5, today: 2 }),
  person('Novi Andriani', { inUnit: false, yesterday: 4, today: 6 }),
];

export const LEADER: HomeView = {
  today: '2026-10-30', yesterday: '2026-10-29', month: '2026-10', now: { minute: 9 * 60 + 5 },
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
  actions: [
    {
      kind: 'coaching', sessionId: 's-1', itemId: 'i-1', text: 'Siapkan daftar 20 prospek baru',
      from: { membershipId: 'm-wilson', name: 'Wilson Tanoto', phone: '+6281299990000' },
    },
    {
      kind: 'lead', leadId: 'l-1', name: 'Ibu Wiwik Setyaningsih', type: 'sales', note: 'Invite BOP',
      contact: { phone: '+6281211112222', email: null }, version: 2,
    },
    { kind: 'agenda', source: 'entry', id: 'e-1', type: 'meeting', title: 'Weekly unit huddle', date: '2026-10-31', start: '15:00' },
  ],
  leader: {
    activeAgent: { count: 4, of: 12, unit: { count: 1, of: 4 }, aab: { count: 3, of: 8 } },
    coached7d: { count: 2, of: 12, unit: { count: 1, of: 4 }, aab: { count: 1, of: 8 } },
    team: TEAM,
  },
};

export const AGENT_VIEW: HomeView = {
  ...LEADER,
  activity: { ...LEADER.activity, today: 2, yesterday: 0 },
  schedule: { meetings: 0, tasks: 0 },
  actions: [],
  leader: null,
};

