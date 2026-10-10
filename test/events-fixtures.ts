import { makeMe } from './harness';
import type { GuestEvent, GuestEventList, NpsConstants } from '@/lib/events';
import type { EventInvitee, FeedbackRow, FeedbackSummary, RollCall, RollCallRow } from '@/lib/events-admin';

/**
 * **Events, as the reads answer them** (P18.5-T5, T6): shaped as `scratchpad/p185/contract-events.md` and
 * the events module's response DTOs give them, with the seed's names (`seed/events-fixture.ts`, *Seed* in
 * `phase-18.5-agent-enablement.md`).
 */

export const FIELD_PERMISSIONS = [
  'event:read_list', 'event:rsvp', 'event:cancel_rsvp', 'event_attendance:self_claim',
  'event_feedback:submit', 'event_feedback:read',
];

/** Rina, an Agent of 0417. */
export const RINA_ME = makeMe({
  user: {
    id: 'u-rina', email: 'rina@kpm0417.test', fullName: 'Rina Wijaya', preferredName: 'Rina',
    pronoun: 'she', initials: 'RW', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-rina', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: FIELD_PERMISSIONS,
});

/** A Super Admin in a read-only support session, acting as Rina (roles §3.13): the read answers `can` all false. */
export const READ_ONLY_RINA = {
  ...RINA_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root',
  permissions: ['event:read_list', 'event_feedback:read'],
};

/** What the agent shell reads, so a page renders inside it. */
export const SHELL_STUBS = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

export const NPS: NpsConstants = { scaleMin: 0, scaleMax: 10, promoterMin: 9, detractorMax: 6 };

export const CAN_ALL = { rsvp: true, cancelRsvp: true, claim: true, feedback: true };
export const CAN_NONE = { rsvp: false, cancelRsvp: false, claim: false, feedback: false };

export const notFound = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Event not found.', requestId: 'r-404' } } };
export const serverError = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-500' } } };
export const conflict = (code: string, message: string) => ({ status: 409, body: { error: { code, message, requestId: 'r-409' } } });

const TRAINING = { code: 'TRAINING', label: 'Training', emoji: '📚', color: '#2D9CDB' };
const RECOGNITION = { code: 'RECOGNITION', label: 'Recognition', emoji: '🏆', color: '#27AE60' };

export function guestEvent(over: Partial<GuestEvent> & { id: string }): GuestEvent {
  return {
    code: over.id.toUpperCase(), title: over.id, blurb: `${over.id}'s line.`, description: `About ${over.id}.`,
    type: TRAINING, audience: { issuer: 'kpm', scope: 'all_agents' },
    startsAt: '2026-10-15T02:00:00.000Z', endsAt: '2026-10-15T05:00:00.000Z', startsOn: '2026-10-15', startTime: '09:00',
    location: 'BSD City Branch', locationUrl: null, phase: 'upcoming', ended: false,
    me: { rsvp: null, claimed: false, feedback: null },
    ...over,
  };
}

/** The seed's 0417, as Rina reads it: all five card states (the phase file's *Who walks what*). */
export const PRODUCT_REFRESH = guestEvent({
  id: 'ev-refresh', title: 'Product refresh briefing', startsAt: '2026-10-15T07:00:00.000Z', endsAt: '2026-10-15T09:00:00.000Z',
  startsOn: '2026-10-15', startTime: '14:00', location: 'Online — Zoom', locationUrl: 'https://zoom.us/j/1234567890',
  audience: { issuer: 'company', scope: 'all_agents' }, me: { rsvp: 'going', claimed: false, feedback: null },
});
export const KICKOFF = guestEvent({
  id: 'ev-kickoff', title: 'Kickoff 2026', type: RECOGNITION, startsAt: '2026-10-24T11:00:00.000Z', endsAt: '2026-10-24T14:00:00.000Z',
  startsOn: '2026-10-24', startTime: '18:00',
});
export const PRULINK = guestEvent({
  id: 'ev-prulink', title: 'PRULink briefing', startsAt: '2026-09-19T02:00:00.000Z', endsAt: '2026-09-19T04:00:00.000Z',
  startsOn: '2026-09-19', startTime: '09:00', phase: 'past', ended: true,
  audience: { issuer: 'company', scope: 'all_agents' }, me: { rsvp: 'going', claimed: false, feedback: null },
});
export const TOWN_HALL = guestEvent({
  id: 'ev-townhall', title: 'August Town Hall', startsAt: '2026-09-05T02:00:00.000Z', endsAt: '2026-09-05T04:00:00.000Z',
  startsOn: '2026-09-05', startTime: '09:00', phase: 'past', ended: true,
});
export const BOOTCAMP = guestEvent({
  id: 'ev-bootcamp', title: 'New Agent Bootcamp', startsAt: '2026-08-21T01:00:00.000Z', endsAt: '2026-08-21T09:00:00.000Z',
  startsOn: '2026-08-21', startTime: '08:00', phase: 'past', ended: true,
  audience: { issuer: 'kpm', scope: 'select_agents' },
  me: { rsvp: 'going', claimed: false, feedback: { score: 9, why: 'Clear and practical.', improve: '', submittedAt: '2026-08-21T10:00:00.000Z' } },
});

export const RINA_EVENTS: GuestEvent[] = [PRODUCT_REFRESH, KICKOFF, PRULINK, TOWN_HALL, BOOTCAMP];

export function eventList(events: GuestEvent[] = RINA_EVENTS, over: Partial<GuestEventList> = {}): GuestEventList {
  return {
    events, companyName: 'Prudential', timezone: 'Asia/Jakarta',
    limits: { feedbackTextMax: 1000, nps: NPS }, can: CAN_ALL, ...over,
  };
}

/*
 * ── The office's side ───────────────────────────────────────────────────────────────────────────
 */

/** Maya Halim, the Owner of 0417, in the console. */
export const OWNER_ME = makeMe({
  user: {
    id: 'u-maya', email: 'owner@kpm0417.test', fullName: 'Maya Halim', preferredName: 'Maya',
    pronoun: 'she', initials: 'MH', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
  permissions: [
    'tenant_config:read', 'tenant_config:write', 'event_settings:read', 'event_attendance:confirm', 'event_feedback:read',
  ],
});

/** A read-only support session as the Owner: it reads, and the roll call's `can.confirm` is false. */
export const READ_ONLY_OWNER = {
  ...OWNER_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root',
  permissions: ['tenant_config:read', 'event_settings:read', 'event_feedback:read'],
};

export function rollRow(over: Partial<RollCallRow> & { membershipId: string; name: string }): RollCallRow {
  return { orgLevelCode: 'AGENT', rung: 'Agent', said: null, attended: null, status: 'not_registered', self: false, ...over };
}

/** *PRULink briefing*'s roll call: Budi confirmed, Indah claimed and unconfirmed, Dimas marked absent, the Owner's own row. */
export function rollCall(over: Partial<RollCall> = {}): RollCall {
  return {
    eventId: 'ev-prulink', title: 'PRULink briefing', phase: 'past', ended: true, startsOn: '2026-09-19',
    people: [
      rollRow({ membershipId: 'mem-budi', name: 'Budi Santoso', said: 'rsvp', attended: true, status: 'attended' }),
      rollRow({ membershipId: 'mem-dimas', name: 'Dimas Pratama', said: 'rsvp', attended: false, status: 'no_show' }),
      rollRow({ membershipId: 'mem-indah', name: 'Indah Permata', said: 'claimed', status: 'unconfirmed' }),
      rollRow({
        membershipId: 'mem-owner', name: 'Maya Halim', orgLevelCode: 'AB', rung: 'Agency Builder', said: 'rsvp',
        status: 'unconfirmed', self: true,
      }),
      rollRow({ membershipId: 'mem-siti', name: 'Siti Rahma' }),
    ],
    can: { confirm: true },
    ...over,
  };
}

export function feedbackRow(over: Partial<FeedbackRow> & { membershipId: string; name: string; score: number }): FeedbackRow {
  const bucket = over.score >= NPS.promoterMin ? 'promoter' : over.score <= NPS.detractorMax ? 'detractor' : 'passive';
  return { bucket, why: '', improve: '', attendance: 'confirmed', counted: true, ...over };
}

/** *PRULink briefing*'s summary: Budi's 9 counted, Indah's 6 awaiting her confirmation. */
export function feedbackSummary(over: Partial<FeedbackSummary> = {}): FeedbackSummary {
  return {
    eventId: 'ev-prulink', title: 'PRULink briefing', nps: 100, counted: 1, responses: 2, awaitingConfirmation: 1,
    rows: [
      feedbackRow({ membershipId: 'mem-budi', name: 'Budi Santoso', score: 9, why: 'Clear on the riders.', improve: 'Share the deck after.' }),
      feedbackRow({
        membershipId: 'mem-indah', name: 'Indah Permata', score: 6, why: 'Too long.', attendance: 'unconfirmed', counted: false,
      }),
    ],
    constants: NPS,
    ...over,
  };
}

/** The August Town Hall as drawn (`KPM_Owner.html:2990-2998`): eight confirmed answers, NPS 0. */
export const TOWN_HALL_SUMMARY = feedbackSummary({
  eventId: 'ev-townhall', title: 'August Town Hall', nps: 0, counted: 8, responses: 8, awaitingConfirmation: 0,
  rows: [
    feedbackRow({ membershipId: 'm1', name: 'Wilson Tanoto', score: 10, why: 'Great energy — the recognition segment really landed.', improve: 'Keep leaning into recognition moments — repeat this format.' }),
    feedbackRow({ membershipId: 'm2', name: 'Putri Ramadhani', score: 9, why: 'Loved the live Q&A, felt very transparent.', improve: 'Keep the live Q&A as a permanent segment.' }),
    feedbackRow({ membershipId: 'm3', name: 'Rina Agustina', score: 9, why: 'Best town hall yet — very clear on Q3 priorities.', improve: 'Keep leading with clear quarterly priorities.' }),
    feedbackRow({ membershipId: 'm4', name: 'Fajar Nugroho', score: 8, why: 'Solid updates, would love more time for Q&A.', improve: 'Extend the Q&A window by 10–15 minutes.' }),
    feedbackRow({ membershipId: 'm5', name: 'Yoga Pratama', score: 7, why: 'Good content, but audio cut out twice.', improve: 'Test the mic/AV setup before going live.' }),
    feedbackRow({ membershipId: 'm6', name: 'Ika Wirawan', score: 6, why: 'Ran a bit long, energy dipped toward the end.', improve: 'Trim the agenda — end while energy is still high.' }),
    feedbackRow({ membershipId: 'm7', name: 'Putri Lestari', score: 5, why: 'Too long — could be tightened up.', improve: 'Cut 15–20 minutes from the overall runtime.' }),
    feedbackRow({ membershipId: 'm8', name: 'Dewi Anggraini', score: 4, why: 'Felt repetitive compared to last quarter\'s.', improve: 'Refresh the content — avoid repeating last quarter\'s deck.' }),
  ],
});

export const INVITEES: EventInvitee[] = [
  { membershipId: 'mem-agus', name: 'Agus Wibowo', orgLevelCode: 'AB', rung: 'Agency Builder', leads: true },
  { membershipId: 'mem-budi', name: 'Budi Santoso', orgLevelCode: 'AGENT', rung: 'Agent', leads: false },
  { membershipId: 'mem-dewi', name: 'Dewi Lestari', orgLevelCode: 'AAB', rung: 'Associate Agency Builder', leads: false },
  { membershipId: 'mem-rina', name: 'Rina Wijaya', orgLevelCode: 'AGENT', rung: 'Agent', leads: false },
  { membershipId: 'mem-sari', name: 'Sari Puspita', orgLevelCode: 'AAB', rung: 'Associate Agency Builder', leads: true },
];
