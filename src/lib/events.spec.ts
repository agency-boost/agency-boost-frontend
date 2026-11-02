import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api-client';
import {
  BOOTCAMP, guestEvent, KICKOFF, NPS, PRODUCT_REFRESH, PRULINK, RINA_EVENTS, TOWN_HALL,
} from '@test/events-fixtures';
import {
  audienceLine, cancelledToast, canJoin, goingToast, joined, joinName, OWN_COPY, pastBlockOf, pickScoreToast, pillOf, PROTOTYPE_COPY, refusalOf,
  scaleHighLine, scaleLowLine, scaleOf, scoredLine, sections, tagOf, whenLine,
} from './events';
import {
  attendedWords, awaitingLine, chosenCount, leftRow, markLabel, npsFigure, npsFormula, officeInstant, officeWallClock,
  responsesLine, scoreOutOf, summaryTitle,
} from './events-admin';

describe('KPM Events: what the screen derives, and nothing more (P18.5-T5, T6)', () => {
  it('P18.5-T5 AC-4 sections: Going and Upcoming soonest first, a running event among them, Past latest first', () => {
    const running = guestEvent({ id: 'ev-run', phase: 'running', startsAt: '2026-10-10T01:00:00.000Z' });
    const { going, upcoming, past } = sections([...RINA_EVENTS, running]);
    expect(going.map((e) => e.id)).toEqual(['ev-refresh']);
    expect(upcoming.map((e) => e.id)).toEqual(['ev-run', 'ev-kickoff']);
    expect(past.map((e) => e.id)).toEqual(['ev-prulink', 'ev-townhall', 'ev-bootcamp']);
  });

  it('P18.5-T5 AC-4 two events at the same instant fall in title order, not in whatever order they arrived', () => {
    const a = guestEvent({ id: 'b-ev', title: 'Beta' });
    const b = guestEvent({ id: 'a-ev', title: 'Alpha' });
    expect(sections([a, b]).upcoming.map((e) => e.title)).toEqual(['Alpha', 'Beta']);
  });

  it('P18.5-T5 AC-6 a claim joins a past event; before the end only the RSVP counts', () => {
    const claimedPast = { ...TOWN_HALL, me: { ...TOWN_HALL.me, claimed: true } };
    expect(joined(claimedPast)).toBe(true);
    expect(joined(TOWN_HALL)).toBe(false);
    expect(joined({ ...KICKOFF, me: { ...KICKOFF.me, claimed: true } })).toBe(false);
    expect(joined(PRODUCT_REFRESH)).toBe(true);
  });

  it('P18.5-T5 AC-4 the tag and the pill: five pill states, three tags (`:8502-8524`)', () => {
    expect([tagOf(PRODUCT_REFRESH), pillOf(PRODUCT_REFRESH)]).toEqual(['going', 'going']);
    expect([tagOf(KICKOFF), pillOf(KICKOFF)]).toEqual(['notJoined', 'notJoined']);
    expect([tagOf(PRULINK), pillOf(PRULINK)]).toEqual(['past', 'feedbackPending']);
    expect([tagOf(TOWN_HALL), pillOf(TOWN_HALL)]).toEqual(['notJoined', 'didntJoin']);
    expect([tagOf(BOOTCAMP), pillOf(BOOTCAMP)]).toEqual(['past', 'feedbackSent']);
    // A cancelled RSVP is not going.
    const cancelled = { ...KICKOFF, me: { ...KICKOFF.me, rsvp: 'cancelled' as const } };
    expect(pillOf(cancelled)).toBe('notJoined');
  });

  it('P18.95-T10 AC-1 Join is offered where the server allows an RSVP, the event is open and the reader not going', () => {
    const can = { rsvp: true };
    expect(canJoin(KICKOFF, can)).toBe(true);
    expect(canJoin(guestEvent({ id: 'ev-run', phase: 'running' }), can)).toBe(true);
    expect(canJoin({ ...KICKOFF, me: { ...KICKOFF.me, rsvp: 'cancelled' } }, can)).toBe(true);
    expect(canJoin(PRODUCT_REFRESH, can)).toBe(false);
    expect(canJoin(TOWN_HALL, can)).toBe(false);
    expect(canJoin(PRULINK, can)).toBe(false);
    expect(canJoin(KICKOFF, { rsvp: false })).toBe(false);
  });

  it('P18.95-T10 AC-1 the card’s Join: the client’s word, named with its event for a screen reader', () => {
    expect(OWN_COPY.join).toBe('Join');
    expect(joinName('Kickoff 2026')).toBe('Join Kickoff 2026');
  });

  it('P18.5-T5 AC-6, T6 AC-2 the past block: the didn’t-join block, the form after an RSVP or a claim, the thanks', () => {
    expect(pastBlockOf(TOWN_HALL)).toBe('didntJoin');
    expect(pastBlockOf({ ...TOWN_HALL, me: { ...TOWN_HALL.me, claimed: true } })).toBe('form');
    expect(pastBlockOf(PRULINK)).toBe('form');
    expect(pastBlockOf(BOOTCAMP)).toBe('thanks');
  });

  it('P18.5-T5 AC-4, P18.95-T1 AC-1 "{date}, {time}" from the office’s day and clock as served, never the browser’s', () => {
    expect(whenLine({ startsOn: '2026-09-20', startTime: '18:00' })).toBe('20 Sep 2026, 18.00');
    expect(whenLine({ startsOn: '2026-10-02', startTime: '00:30' })).toBe('2 Okt 2026, 00.30');
  });

  it('P18.5-T5 AC-4 the audience line in the prototype’s words, composed from the two fields (F-44)', () => {
    expect(audienceLine({ issuer: 'company', scope: 'all_agents' }, 'Prudential')).toBe('Prudential Event | All agents');
    expect(audienceLine({ issuer: 'company', scope: 'select_agents' }, 'Prudential')).toBe('Prudential Event | Select agents');
    expect(audienceLine({ issuer: 'kpm', scope: 'all_agents' }, 'Prudential')).toBe('KPM | All agents');
    expect(audienceLine({ issuer: 'kpm', scope: 'leaders' }, 'Prudential')).toBe('KPM | Leaders only');
    expect(audienceLine({ issuer: 'company', scope: 'select_leaders' }, 'Prudential')).toBe('Prudential Event | Select leaders');
    expect(audienceLine({ issuer: 'group', scope: 'select_agents' }, 'Prudential')).toBe('Group event | Select agents');
    expect(audienceLine({ issuer: 'company', scope: 'all_agents' }, '')).toBe('Event | All agents');
  });

  it('P18.5-T6 AC-2 the scale and its words carry the served constants (invariant §7)', () => {
    expect(scaleOf(NPS)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(scaleLowLine(NPS)).toBe('0 — Not at all likely');
    expect(scaleHighLine(NPS)).toBe('10 — Extremely likely');
    expect(pickScoreToast(NPS)).toBe('Pick a score from 0–10 first');
    const five = { ...NPS, scaleMax: 5 };
    expect(scaleOf(five)).toHaveLength(6);
    expect(pickScoreToast(five)).toBe('Pick a score from 0–5 first');
  });

  it('P18.5-T6 AC-4 the thanks line, its why only when there is one (`:8696`)', () => {
    expect(scoredLine({ score: 9, why: 'Great.' }, NPS)).toBe('You scored this event 9/10 — "Great."');
    expect(scoredLine({ score: 4, why: '' }, NPS)).toBe('You scored this event 4/10');
  });

  it('the prototype’s toasts and words, verbatim (`Overall.html:8656-8764`, `:10413`)', () => {
    // Led by the client's *Joined ✓* since 2026-10-26 (P18.95-T1 AC-6), the prototype's sentence after it.
    expect(goingToast('Kickoff 2026')).toBe("Joined ✓ — you're going to Kickoff 2026");
    expect(cancelledToast('Kickoff 2026')).toBe('RSVP cancelled for Kickoff 2026');
    // The nav item's words, where the prototype titled the page *KPM Events* (P18.95-T9 AC-2; UI-027).
    expect(PROTOTYPE_COPY.title).toBe('Event List');
    expect(PROTOTYPE_COPY.sub).toBe('Browse upcoming and past events from your KPM — join, and share feedback once they wrap up.');
    expect(PROTOTYPE_COPY.emptyGoing).toBe("You haven't joined any upcoming events yet.");
    expect(PROTOTYPE_COPY.didntJoinSub).toBe("Feedback is only collected from agents who attended, so there's nothing to fill out here.");
    expect(PROTOTYPE_COPY.claimed).toBe('Marked as attended — you can now leave feedback');
    expect(PROTOTYPE_COPY.feedbackSubmitted).toBe('Feedback submitted — thank you!');
  });
});

describe('the office’s side (P18.5-T5 AC-7, T6 AC-5)', () => {
  it('P18.5-T6 AC-5 the summary’s words, verbatim, with the served constants', () => {
    expect(summaryTitle('August Town Hall')).toBe('August Town Hall — Feedback Summary');
    expect(npsFormula(NPS)).toBe('= % Promoters (9–10) − % Detractors (0–6)');
    expect(responsesLine(8)).toBe('· 8 responses');
    expect(responsesLine(1)).toBe('· 1 response');
    expect(responsesLine(0)).toBe('· 0 responses');
    expect(scoreOutOf(7, NPS)).toBe('7/10');
    expect(awaitingLine(1)).toBe('· 1 awaiting attendance confirmation');
  });

  it('P18.5-T6 AC-6 the NPS figure: — with nobody to count, and 0 is a reading', () => {
    expect(npsFigure(null)).toBe('—');
    expect(npsFigure(0)).toBe('0');
    expect(npsFigure(-100)).toBe('-100');
    expect(npsFigure(29)).toBe('29');
  });

  it('P18.5-T5 AC-7 a confirmation in words, and each mark named for its person', () => {
    expect(attendedWords(true)).toBe('Attended');
    expect(attendedWords(false)).toBe('Absent');
    expect(attendedWords(null)).toBe('—');
    expect(markLabel('attended', 'Budi Santoso')).toBe('Attended — Budi Santoso');
    expect(markLabel('absent', 'Budi Santoso')).toBe('Absent — Budi Santoso');
  });

  it('P18.5-T5 AC-10 the picker’s count, and the row for people who have left', () => {
    expect(chosenCount(0)).toBe('0 chosen');
    expect(chosenCount(3)).toBe('3 chosen');
    expect(leftRow(1)).toBe('Somebody who has left');
    expect(leftRow(2)).toBe('2 people who have left');
  });

  it('P18.5-T5 AC-9 the panel’s wall clock is Jakarta’s, both ways (invariant §9)', () => {
    expect(officeInstant('2026-10-01T09:00')).toBe('2026-10-01T02:00:00.000Z');
    expect(officeInstant('2026-10-01T00:30')).toBe('2026-09-30T17:30:00.000Z');
    expect(officeInstant('2026-10-01T09:00:30')).toBe('2026-10-01T02:00:30.000Z');
    expect(officeInstant('')).toBe('');
    expect(officeWallClock('2026-10-01T02:00:00.000Z')).toBe('2026-10-01T09:00');
    expect(officeWallClock('2026-09-30T17:30:00.000Z')).toBe('2026-10-01T00:30');
    expect(officeWallClock('not a date')).toBe('');
    // Another zone, for the day `kpms.timezone` holds more than one.
    expect(officeInstant('2026-07-01T09:00', 'Europe/London')).toBe('2026-07-01T08:00:00.000Z');
    expect(officeWallClock('2026-07-01T08:00:00.000Z', 'Europe/London')).toBe('2026-07-01T09:00');
  });
});

describe('a refusal the screen can meet, in the spec’s words', () => {
  const refusal = (status: number, code: string, message: string) =>
    new ApiRequestError(status, { code, message, requestId: 'r-1' });

  it('P18.5-T5 AC-5 EVENT_RSVP_CLOSED reads "This event has already ended.", keeping its code and request id', () => {
    expect(refusalOf(refusal(409, 'EVENT_RSVP_CLOSED', 'Closed.'))).toEqual({
      code: 'EVENT_RSVP_CLOSED', message: 'This event has already ended.', requestId: 'r-1',
    });
  });

  it('P18.5-T5 AC-6 EVENT_NOT_ENDED reads "This event hasn’t ended yet."', () => {
    expect(refusalOf(refusal(409, 'EVENT_NOT_ENDED', 'Not yet.')).message).toBe('This event hasn’t ended yet.');
  });

  it('any other refusal is the server’s own line', () => {
    expect(refusalOf(refusal(409, 'EVENT_FEEDBACK_ALREADY_SUBMITTED', 'Already given.')).message).toBe('Already given.');
  });
});
