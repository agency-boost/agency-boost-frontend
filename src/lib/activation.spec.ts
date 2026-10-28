import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { activationView, item, LINKS, RINA, SARI } from '@test/activation-fixtures';
import {
  ACTIVATION_3M_LABEL, ACTIVATION_NOTE_MAX, aspectTitle, attributionOf, correctionOf, correctStartDate, dayShown, earliestStart,
  FIRST_CASE_CLOSED, graduateMyActivation, groupTitle, isComplete, isDataBacked, isManual, isTickedByHandLink, isWholeDate, ITEM_NOTE_MAX,
  newHireHref, OWN_COPY, PROTOTYPE_COPY, readHireClosings, readMyActivation, readMyClosings, readNewHire, readNewHires, recordHref,
  saveActivationNote, saveHireItem, saveMyItem, sourceLineOf, startDateAllowed, startDateRangeText, takesHandWrite,
} from './activation';

const LINK = { kind: 'feature:goals', label: 'Goal Settings', route: '/goals', completesWhen: 'x', live: true, form: null };

describe('the activation’s calls (P13, the fixed contract)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads, ticks and graduates the reader’s own, at the contract’s paths and with its bodies', async () => {
    const { calls } = stubFetch({ '/activation/me': { body: activationView() } });
    await readMyActivation();
    await saveMyItem('CRM_SETUP', { done: true });
    await saveMyItem('INSURANCE_BASICS', { done: true, note: null });
    await graduateMyActivation();
    expect(calls.map((c) => [c.init.method, c.url, c.init.body])).toEqual([
      ['GET', 'http://api.test/api/v1/activation/me', undefined],
      ['PUT', 'http://api.test/api/v1/activation/me/items/CRM_SETUP', '{"done":true}'],
      ['PUT', 'http://api.test/api/v1/activation/me/items/INSURANCE_BASICS', '{"done":true,"note":null}'],
      ['POST', 'http://api.test/api/v1/activation/me/graduate', undefined],
    ]);
  });

  it('reads the roster and one hire, and writes a leader’s tick, start date and note, with the id encoded', async () => {
    const { calls } = stubFetch({ '/new-hires': { body: {} } });
    await readNewHires();
    await readNewHire('mem/1');
    await saveHireItem('mem-1', 'CRM SETUP', false);
    await correctStartDate('mem-1', '2026-08-01');
    await saveActivationNote('mem-1', 'Keep going.');
    expect(calls.map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', ''), c.init.body])).toEqual([
      ['GET', '/new-hires', undefined],
      ['GET', '/new-hires/mem%2F1', undefined],
      ['PUT', '/new-hires/mem-1/items/CRM%20SETUP', '{"done":false}'],
      ['PUT', '/new-hires/mem-1/start-date', '{"startDate":"2026-08-01"}'],
      ['PUT', '/new-hires/mem-1/note', '{"text":"Keep going."}'],
    ]);
  });

  it('P18.96-T4 AC-3 reads the closings and sends a data-backed item’s tick with its record, in one request', async () => {
    const { calls } = stubFetch({
      '/activation/me/closings': { body: { closings: [] } }, '/activation/me': { body: activationView() }, '/new-hires': { body: {} },
    });
    await readMyClosings();
    await readHireClosings('mem/1');
    await saveMyItem('FIRST_CASE_CLOSED', { done: true, record: { kind: 'closing', name: 'Ibu Ratna', date: '2026-09-03' } });
    await saveHireItem('mem-1', 'WEEKLY_CHECK_IN', true, { kind: 'one_on_one', date: '2026-09-07', note: 'Check-in' });
    expect(calls.map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', ''), c.init.body])).toEqual([
      ['GET', '/activation/me/closings', undefined],
      ['GET', '/new-hires/mem%2F1/closings', undefined],
      ['PUT', '/activation/me/items/FIRST_CASE_CLOSED', '{"done":true,"record":{"kind":"closing","name":"Ibu Ratna","date":"2026-09-03"}}'],
      ['PUT', '/new-hires/mem-1/items/WEEKLY_CHECK_IN', '{"done":true,"record":{"kind":"one_on_one","date":"2026-09-07","note":"Check-in"}}'],
    ]);
  });

  it('pins the contract’s limits and the code the Active Agent column reads', () => {
    expect(ITEM_NOTE_MAX).toBe(500);
    expect(ACTIVATION_NOTE_MAX).toBe(1000);
    expect(FIRST_CASE_CLOSED).toBe('FIRST_CASE_CLOSED');
  });
});

describe('the small readings', () => {
  it('drops the office label’s own number, which the card’s circle already draws, and keeps any other label', () => {
    expect(aspectTitle('1. Introduction')).toBe('Introduction');
    expect(aspectTitle('3. Training & Certification')).toBe('Training & Certification');
    expect(aspectTitle('2) Initial Setup')).toBe('Initial Setup');
    expect(aspectTitle('Ongoing Habits')).toBe('Ongoing Habits');
    expect(aspectTitle('2026 goals')).toBe('2026 goals');
    expect(aspectTitle('1. ')).toBe('1. ');
  });

  it('P13-T1 AC-4 prints the day, or the window and a plus past it — the office’s window, not 90', () => {
    expect(dayShown(59, 90)).toBe('59');
    expect(dayShown(90, 90)).toBe('90');
    expect(dayShown(91, 90)).toBe('90+');
    expect(dayShown(61, 60)).toBe('60+');
  });

  it('P18.95-T3 AC-4 writes a phone card’s day in words, Day 64 of 90, the window the office’s and 90+ past it', () => {
    expect(OWN_COPY.dayOf(dayShown(64, 90), 90)).toBe('Day 64 of 90');
    expect(OWN_COPY.dayOf(dayShown(91, 90), 90)).toBe('Day 90+ of 90');
    expect(OWN_COPY.dayOf(dayShown(12, 60), 60)).toBe('Day 12 of 60');
  });

  it('names the roster’s cards: Direct Unit, or AAB: {name}', () => {
    expect(groupTitle({ kind: 'direct', leader: null })).toBe('Direct Unit');
    expect(groupTitle({ kind: 'aab', leader: SARI })).toBe('AAB: Sari Puspita');
    // D-group's Fix: an AB under the reader names its rung.
    expect(groupTitle({ kind: 'ab', leader: SARI })).toBe('AB: Sari Puspita');
    expect(groupTitle({ kind: 'aab', leader: null })).toBe('Direct Unit');
    expect(newHireHref('mem 1')).toBe('/new-hires/mem%201');
  });

  it('a manual item is one with no link, or a link that does not work yet (ADR-0031)', () => {
    expect(isManual(item('A', 'a'))).toBe(true);
    expect(isManual(item('A', 'a', { link: { ...LINK, live: false } }))).toBe(true);
    expect(isManual(item('A', 'a', { link: LINK }))).toBe(false);
  });

  it('P18.5-T3 AC-4, D-orphan: a link not live is ticked by hand, unless the link already completed the item', () => {
    const orphan = { ...LINK, live: false };
    expect(isManual(item('A', 'a', { link: orphan }))).toBe(true);
    expect(isTickedByHandLink(item('A', 'a', { link: orphan }))).toBe(true);
    expect(isTickedByHandLink(item('A', 'a'))).toBe(false);
    // Sticky (ADR-0031): the record is the link's, and the server refuses a hand edit (409 ACTIVATION_ITEM_AUTOMATIC).
    const completed = item('A', 'a', { link: orphan, done: true, source: 'link', doneBy: SARI, doneAt: '2026-10-01T03:00:00.000Z' });
    expect(isManual(completed)).toBe(false);
    expect(isTickedByHandLink(completed)).toBe(false);
    // Ticked by hand while the module was withdrawn: still a hand's, still untickable by hand.
    expect(isManual(item('A', 'a', { link: orphan, done: true, source: 'hire' }))).toBe(true);
  });

  describe('the data-backed items (P18.96-T4 AC-2 to AC-4)', () => {
    const at = '2026-09-30T23:30:00.000Z';
    const sale = (over = {}) => item('FIRST_CASE_CLOSED', 'Close first case independently', { link: LINKS['sales:first'], ...over });
    const checkIn = (over = {}) => item('WEEKLY_CHECK_IN', 'Weekly 1-on-1 check-in (4 weeks)', { link: LINKS['coaching:weekly:4'], ...over });

    it('P18.96-T4 AC-2 knows one by its link’s form, never by its code', () => {
      expect(isDataBacked(sale())).toBe(true);
      expect(isDataBacked(item('FIRST_CASE_CLOSED', 'x'))).toBe(false);
      expect(isDataBacked(item('A', 'a', { link: LINK }))).toBe(false);
      // Live, so never a manual row: its form is its way in.
      expect(isManual(sale())).toBe(false);
    });

    it('P18.96-T4 AC-2 reads “Completed from Sales data · {date}” from its data, naming nobody', () => {
      const done = sale({ done: true, doneAt: at, source: 'link', doneBy: RINA, record: { collection: 'leads', id: 'l1' } });
      expect(sourceLineOf(done, 'mem-rina')).toBe('Completed from Sales data · 1 Okt 2026');
      expect(attributionOf(done, 'mem-rina')).toBe('Completed from Sales data · 1 Okt 2026');
      expect(sourceLineOf(checkIn({ done: true, doneAt: at, source: 'link', doneBy: SARI }), 'mem-rina'))
        .toBe('Completed from Coaching sessions · 1 Okt 2026');
      expect(sourceLineOf(sale(), 'mem-rina')).toBeNull();
      expect(sourceLineOf(item('A', 'a', { done: true, source: 'hire', doneBy: RINA }), 'mem-rina')).toBeNull();
    });

    it('P18.96-T4 AC-4 reads “Ticked by {name}, waiting for data” for a hand tick not yet confirmed — you, for the reader', () => {
      expect(sourceLineOf(checkIn({ done: true, doneAt: at, source: 'leader', doneBy: SARI, waiting: true }), 'mem-rina'))
        .toBe('Ticked by Sari Puspita, waiting for data');
      expect(sourceLineOf(sale({ done: true, doneAt: at, source: 'hire', doneBy: RINA, waiting: true }), 'mem-rina'))
        .toBe('Ticked by you, waiting for data');
    });

    it('P18.96-T4 AC-2 links the record its reader has a page for: the hire’s Leads and sessions, a leader’s session archive', () => {
      const session = checkIn({ done: true, source: 'link', record: { collection: 'coachingSessions', id: 's 1' } });
      expect(recordHref(session, 'hire', 'mem-rina')).toBe('/coaching/me?session=s%201');
      expect(recordHref(session, 'leader', 'mem-rina')).toBe('/coaching/mem-rina/archive/s%201');
      const lead = sale({ done: true, source: 'link', record: { collection: 'leads', id: 'l1' } });
      expect(recordHref(lead, 'hire', 'mem-rina')).toBe('/leads');
      expect(recordHref(lead, 'leader', 'mem-rina')).toBeNull();
      expect(recordHref(sale({ done: true, source: 'link', record: { collection: 'monthlyAgentData', id: 'm' } }), 'hire', 'x')).toBeNull();
      expect(recordHref(sale(), 'hire', 'x')).toBeNull();
    });

    it('P18.96-T4 AC-3 takes a hand write until its data completed it', () => {
      expect(takesHandWrite(sale())).toBe(true);
      expect(takesHandWrite(sale({ done: true, source: 'hire', waiting: true }))).toBe(true);
      expect(takesHandWrite(sale({ done: true, source: 'link' }))).toBe(false);
      expect(takesHandWrite(item('A', 'a'))).toBe(false);
    });
  });

  describe('attribution (OD-121, P13-T4 AC-5)', () => {
    const at = '2026-09-30T23:30:00.000Z';

    it('says nothing for an item not done', () => {
      expect(attributionOf(item('A', 'a'), 'mem-rina')).toBeNull();
    });

    it('names who ticked it, the reader as you, on the office’s day', () => {
      expect(attributionOf(item('A', 'a', { done: true, doneAt: at, source: 'hire', doneBy: RINA }), 'mem-rina')).toBe('Ticked by you · 1 Okt 2026');
      expect(attributionOf(item('A', 'a', { done: true, doneAt: at, source: 'leader', doneBy: SARI }), 'mem-rina')).toBe('Ticked by Sari Puspita · 1 Okt 2026');
    });

    it('names the link that completed it, and who wrote the record when it is known', () => {
      expect(attributionOf(item('A', 'a', { link: LINK, done: true, doneAt: at, source: 'link', doneBy: SARI }), 'mem-rina'))
        .toBe('Completed from Goal Settings by Sari Puspita · 1 Okt 2026');
      expect(attributionOf(item('A', 'a', { link: LINK, done: true, doneAt: at, source: 'link', doneBy: null }), 'mem-rina'))
        .toBe('Completed from Goal Settings · 1 Okt 2026');
      expect(attributionOf(item('A', 'a', { done: true, doneAt: at, source: 'link', doneBy: null }), 'mem-rina'))
        .toBe('Completed automatically · 1 Okt 2026');
    });

    it('a manual tick with nobody named says nothing rather than guessing', () => {
      expect(attributionOf(item('A', 'a', { done: true, doneAt: null, source: 'hire', doneBy: null }), 'mem-rina')).toBeNull();
    });

    it('P18.96-T2 AC-5 says who corrected a join date, or nothing when nobody did', () => {
      expect(correctionOf(activationView(), 'mem-rina')).toBeNull();
      expect(correctionOf(activationView({ startCorrected: { by: SARI, at } }), 'mem-sari')).toBe('Join date corrected by you · 1 Okt 2026');
      expect(correctionOf(activationView({ startCorrected: { by: SARI, at } }), 'mem-rina')).toBe('Join date corrected by Sari Puspita · 1 Okt 2026');
    });

    it('P18.96-T2 AC-5 one name for the one date: Join date, and its toast', () => {
      expect(PROTOTYPE_COPY.joinDate).toBe('Join date');
      expect(OWN_COPY.startSaved).toBe('Join date updated.');
      expect(PROTOTYPE_COPY).not.toHaveProperty('startDate');
      expect(PROTOTYPE_COPY).not.toHaveProperty('joined');
    });
  });

  describe('the start date’s bounds (OD-118, the contract)', () => {
    it('reaches back 365 days from the office’s today, across a leap day and a year', () => {
      expect(earliestStart('2026-10-03')).toBe('2025-10-03');
      expect(earliestStart('2028-03-01')).toBe('2027-03-02');
    });

    it('takes a whole date from the earliest to today, and nothing else', () => {
      expect(startDateAllowed('2026-10-03', '2026-10-03')).toBe(true);
      expect(startDateAllowed('2025-10-03', '2026-10-03')).toBe(true);
      expect(startDateAllowed('2026-10-04', '2026-10-03')).toBe(false);
      expect(startDateAllowed('2025-10-02', '2026-10-03')).toBe(false);
      expect(startDateAllowed('0202-10-02', '2026-10-03')).toBe(false);
      expect(startDateRangeText('2026-10-03')).toBe('Choose a date from 3 Okt 2025 to today.');
    });

    it('a date half-typed is not whole', () => {
      expect(isWholeDate('2026-08-01')).toBe(true);
      expect(isWholeDate('0002-08-01')).toBe(false);
      expect(isWholeDate('')).toBe(false);
    });
  });
});

describe('Phase 13 exit review — the nav’s amber check', () => {
  it('Phase 13 exit review: complete is the server’s own test, every item done — not the rounded percentage', () => {
    expect(isComplete({ done: 16, total: 16 })).toBe(true);
    expect(isComplete({ done: 15, total: 16 })).toBe(false);
    // 199 of 200 rounds to 100%, and is not complete: the nav and the server agree on done === total.
    expect(isComplete({ done: 199, total: 200 })).toBe(false);
  });
});

describe('the words (D-copy)', () => {
  /** Every string a copy table holds, its functions called with a stand-in. */
  const strings = (table: Record<string, string | ((...args: string[]) => string)>) =>
    Object.values(table).map((v) => (typeof v === 'function' ? v('{x}', '{y}', '{z}') : v));

  it('the module’s own strings use none of the six words (ADR-0084, D-copy)', () => {
    for (const text of strings(OWN_COPY as unknown as Record<string, string>)) {
      expect(text).not.toMatch(/\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i);
    }
  });

  it('Phase 13 exit review: the overdue word follows the day, and the hand-ticked badge says whether, never when', () => {
    expect(OWN_COPY.overdue).toBe(', overdue');
    expect(OWN_COPY.byHand).toBe('Ticked by hand');
    expect(OWN_COPY.byHandName.startsWith(OWN_COPY.byHand)).toBe(true);
    for (const text of [OWN_COPY.byHand, OWN_COPY.byHandTip, OWN_COPY.byHandName]) {
      expect(text).not.toMatch(/phase|until|\byet\b|soon|\d/i);
    }
  });

  it('P18.96-T6 AC-5 the hire’s button reads Mark checklist complete, and its reason names the checklist’s own total', () => {
    expect(PROTOTYPE_COPY.graduate).toBe('Mark checklist complete');
    expect(OWN_COPY.graduateLocked(16)).toBe('Unlocks when all 16 items are done');
    expect(OWN_COPY.graduatedTitle).toBe('Your 90-day checklist is complete.');
    expect(ACTIVATION_3M_LABEL).toEqual({ in_progress: 'In progress', activated: 'Activated', not_activated: 'Not activated' });
  });

  it('the prototype’s strings are its own, verbatim, with its straight apostrophes', () => {
    expect(PROTOTYPE_COPY.footer).toBe("Visible only to new agents, for their first 6 months. Tenured agents won't see this section.");
    expect(PROTOTYPE_COPY.rosterSubtitle).toBe("Track your new agents' 90-day activation progress.");
    // A placeholder holds no ⓘ, so *JFW* is spelled out (P18.95-T9 AC-3; UI-028): the prototype's *your first JFW*.
    expect(PROTOTYPE_COPY.noteExample).toBe("e.g. Great pace on prospecting — let's focus on booking your first joint field work this week.");
    expect(PROTOTYPE_COPY.noteSaved('Rina Wijaya')).toBe('Coaching note saved — visible to Rina Wijaya.');
    expect(PROTOTYPE_COPY.graduated).toBe('Marked as tenured agent — 90-Day Activation removed from menu.');
    // OD-28 and D-copy: the confirm speaks to the hire, without the demo's sentence. P18.96-T6 AC-5 (ADR-0173 §4): the
    // checklist is what is complete, never *activation*, which is the 3M result.
    expect(PROTOTYPE_COPY.graduateQuestion).toBe('Mark your checklist complete? The 90-Day Activation menu will be removed.');
    expect(PROTOTYPE_COPY.graduateQuestion).not.toMatch(/same as when a real agent/);
  });
});

describe('FIRST_CASE_CLOSED (invariant §7, Phase 13’s docs audit)', () => {
  it('is the backend’s ACTIVATION_FIRST_CASE_CODE, read from its constants module, so the two cannot drift', () => {
    const constants = readFileSync(
      join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'activation-checklist.ts'), 'utf8',
    );
    const declared = /export const ACTIVATION_FIRST_CASE_CODE = '([^']+)';/.exec(constants);
    expect(declared?.[1]).toBe(FIRST_CASE_CLOSED);
  });
});
