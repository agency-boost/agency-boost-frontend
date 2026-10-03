import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { AAB_RUNG, AB_RUNG, AGENT_RUNG, busy, entry } from '@test/calendar-fixtures';
import {
  addDays, answerEntry, createEntry, daysInclusive, deleteEntry, DOWNLINE_GROUP_LABEL, entryDate, entryNameSuffix,
  hhmm, initialsOf, INVITEES_MAX, isBusy, NOTES_MAX, OWN_COPY, PEOPLE_GROUP_LABEL, peopleOn, personTag, placeBlock,
  PROTOTYPE_COPY, readableDate, readCalendar, readDownline, readEntry, searchPeople, TITLE_MAX, titleOf, TRIP_DAYS_MAX,
  TYPE_BADGE, TYPE_LABEL, updateEntry,
} from './calendar';

afterEach(() => vi.unstubAllGlobals());

const ok = { body: {} };

describe('the calendar’s calls (functional/calendar.md, Data contract)', () => {
  it('reads the reader’s own week with no date, so the server says which week is the office’s', async () => {
    const { calls } = stubFetch({ '/calendar/entries': ok });
    await readCalendar({ view: 'week' });
    expect(calls[0].url).toMatch(/\/calendar\/entries\?view=week$/);
  });

  it('reads a month, a date in it, and a compared member’s week through `for`', async () => {
    const { calls } = stubFetch({ '/calendar/entries': ok });
    await readCalendar({ view: 'month', date: '2026-09-14' });
    await readCalendar({ view: 'week', date: '2026-09-28', forId: 'mem-indah' });
    expect(calls[0].url).toMatch(/\?view=month&date=2026-09-14$/);
    expect(calls[1].url).toMatch(/\?view=week&date=2026-09-28&for=mem-indah$/);
  });

  it('reads one entry, writes one, and pins the edit and the delete to the version read', async () => {
    const { calls } = stubFetch({ '/calendar/entries': ok });
    const input = { type: 'task' as const, title: 'Call list', notes: '', date: '2026-09-29', start: '10:00', end: '11:00', inviteeIds: [] };
    await readEntry('e 1');
    await createEntry(input);
    await updateEntry('e-1', { ...input, version: 3 });
    await deleteEntry('e-1', 4);
    expect(calls[0].url).toMatch(/\/calendar\/entries\/e%201$/);
    expect(calls[1].init.method).toBe('POST');
    expect(JSON.parse(String(calls[1].init.body))).toEqual(input);
    expect(calls[2].init.method).toBe('PATCH');
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ ...input, version: 3 });
    expect(calls[3].init.method).toBe('DELETE');
    expect(calls[3].url).toMatch(/\/calendar\/entries\/e-1\?version=4$/);
  });

  it('answers for the reader alone, and nothing else (ADR-0097)', async () => {
    const { calls } = stubFetch({ '/calendar/entries': ok });
    await answerEntry('e-1', 'declined');
    expect(calls[0].url).toMatch(/\/calendar\/entries\/e-1\/answer$/);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ answer: 'declined' });
  });

  it('searches the picker on the server, a page at a time, and reads the downline and places a block', async () => {
    const { calls } = stubFetch({ '/calendar/people': ok, '/calendar/downline': ok, '/calendar/blocks': ok });
    await searchPeople({ q: 'ri', limit: 50 });
    await searchPeople({ q: '', cursor: 'c-2', limit: 50 });
    await readDownline();
    await placeBlock({ membershipId: 'mem-indah', type: 'coaching', title: '1:1', notes: '', date: '2026-09-28', start: '10:00', end: '10:30', inviteeIds: [] });
    expect(calls[0].url).toMatch(/\/calendar\/people\?q=ri&limit=50$/);
    expect(calls[1].url).toMatch(/\/calendar\/people\?cursor=c-2&limit=50$/);
    expect(calls[2].url).toMatch(/\/calendar\/downline$/);
    expect(calls[3].init.method).toBe('POST');
    expect(JSON.parse(String(calls[3].init.body)).membershipId).toBe('mem-indah');
  });
});

describe('the words', () => {
  it('P12-T2 AC-2 keeps the legend’s words and the badge’s apart, as the prototype has them (`:310-314`, `:824`)', () => {
    expect(Object.values(TYPE_LABEL)).toEqual(['Internal meeting', '1:1 coaching', 'Client meeting', 'Task', 'Travel']);
    expect(Object.values(TYPE_BADGE)).toEqual(['Meeting', 'Coaching', 'Client', 'Task', 'Travel']);
  });

  it('ADR-0096 keeps the prototype’s strings verbatim, KPM and every character included', () => {
    expect(PROTOTYPE_COPY.inviteLabel).toBe('Invite (optional) — anyone in your KPM');
    expect(PROTOTYPE_COPY.invitePlaceholder).toBe('Search your KPM by name…');
    expect(PEOPLE_GROUP_LABEL).toEqual({
      direct_unit: 'Your direct unit',
      group: 'Your group (AAB teams)',
      other: 'Other units in your KPM',
      leadership: 'KPM leadership',
    });
    expect(DOWNLINE_GROUP_LABEL).toEqual({ direct_unit: 'Direct unit', group: 'AAB & their teams (group)' });
    expect(PROTOTYPE_COPY.compareCap(2)).toBe('You\'re comparing 2 people already — remove one below to add another.');
    expect(PROTOTYPE_COPY.blockSub).toBe('This goes straight onto their calendar — no approval needed, they\'ll just see it appear.');
    expect(PROTOTYPE_COPY.more(2)).toBe('+2 more…');
    expect(PROTOTYPE_COPY.added).toBe(' · added ✓');
  });

  /** ADR-0084's six words, which the calendar's own strings never use (ADR-0096). */
  const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

  it('P12-T6 AC-7 / ADR-0096: none of the strings the calendar writes itself uses the six words, a phase or a code', () => {
    const strings = Object.values(OWN_COPY).map((value) => (typeof value === 'function'
      ? (value as (...args: string[]) => string)('Rina Wijaya', 'Sep 28 – Oct 4, 2026')
      : value));
    expect(strings.length).toBeGreaterThan(30);
    for (const text of strings) {
      expect(text, text).not.toMatch(SIX_WORDS);
      expect(text, text).not.toMatch(/\bphase\b/i);
      expect(text, text).not.toMatch(/[a-z]+_[a-z]+:[a-z]+/);
    }
  });

  it('m3 builds each limit’s sentence from its limit, never from the number written again', () => {
    expect(OWN_COPY.tripTooLong).toBe(`A trip can be at most ${TRIP_DAYS_MAX} days.`);
    expect(OWN_COPY.titleTooLong).toBe(`Keep the title to ${TITLE_MAX} characters.`);
    expect(OWN_COPY.notesTooLong).toBe(`Keep the notes to ${NOTES_MAX.toLocaleString('en-US')} characters.`);
    expect(OWN_COPY.tooManyInvitees).toBe(`You can invite at most ${INVITEES_MAX} people.`);
    // In the source, each sentence names its constant and holds no digit of its own.
    const source = readFileSync(join(__dirname, 'calendar.ts'), 'utf8').split('\n');
    for (const key of ['tripTooLong', 'titleTooLong', 'notesTooLong', 'tooManyInvitees']) {
      const line = source.find((l) => l.trim().startsWith(`${key}:`)) ?? '';
      expect(line, key).toMatch(/\$\{[A-Z_]+_MAX\b/);
      expect(line, key).not.toMatch(/\d/);
    }
  });

  it('M2 / F4 read what the pill and a narrow cell leave undrawn', () => {
    expect(OWN_COPY.blockPillSuffix('Indah Permata')).toBe(`: ${PROTOTYPE_COPY.blockTitle('Indah Permata')}`);
    expect(PROTOTYPE_COPY.more(3).startsWith(OWN_COPY.moreShort(3))).toBe(true);
  });

  it('asks the delete question without *This can’t be undone.* — the delete is soft (H-06, I-101)', () => {
    expect(OWN_COPY.deleteQuestion('Weekly unit standup')).toBe('Delete "Weekly unit standup"?');
  });
});

describe('reading an entry', () => {
  it('draws an empty title as the prototype does (`:782`)', () => {
    expect(titleOf({ title: '  ' })).toBe('(untitled event)');
    expect(titleOf({ title: 'Goal review' })).toBe('Goal review');
  });

  it('opens a timed entry on its date and a trip on its first', () => {
    expect(entryDate(entry())).toBe('2026-09-28');
    expect(entryDate(entry({ allDay: true, date: null, startsOn: '2026-10-01', endsOn: '2026-10-02' }))).toBe('2026-10-01');
    expect(entryDate(busy())).toBe('2026-09-30');
    expect(entryDate(busy({ date: null }))).toBe('');
  });

  it('tells a busy block from an entry', () => {
    expect(isBusy(busy())).toBe(true);
    expect(isBusy(entry())).toBe(false);
  });

  it('P12-T4 AC-4 names a pending invitation as waiting, and a placed block as placed', () => {
    expect(entryNameSuffix(entry({ readerIs: 'invitee', myAnswer: 'pending' }))).toBe(', waiting for your answer');
    expect(entryNameSuffix(entry({ readerIs: 'invitee', myAnswer: 'accepted' }))).toBe('');
    expect(entryNameSuffix(entry({ readerIs: 'placed' }))).toBe(', placed on your calendar');
    expect(entryNameSuffix(entry())).toBe('');
  });
});

describe('people', () => {
  it('writes two initials from the first and the last name', () => {
    expect(initialsOf('Rina Wijaya')).toBe('RW');
    expect(initialsOf('Sri Ayu Lestari')).toBe('SL');
    expect(initialsOf('Made')).toBe('M');
    expect(initialsOf('  ')).toBe('?');
  });

  it('P12-T4 AC-3 tags with the ladder’s label and, for anybody not a direct report, their leader’s full name', () => {
    expect(personTag({ rung: AGENT_RUNG, leaderName: 'Agus Santoso', direct: true })).toBe('Agent');
    expect(personTag({ rung: AGENT_RUNG, leaderName: 'Sari Dewi', direct: false })).toBe('Agent · under Sari Dewi');
    expect(personTag({ rung: AB_RUNG, leaderName: null, direct: false })).toBe('Agency Builder');
  });

  it('takes who is a direct report from the server’s `direct`, never from a leader’s name (invariant §2)', () => {
    // A namesake of the reader leads this agent: the same name, somebody else.
    expect(personTag({ rung: AGENT_RUNG, leaderName: 'Agus Santoso', direct: false })).toBe('Agent · under Agus Santoso');
    // The reader's direct report, whatever name the row carries for their leader.
    expect(personTag({ rung: AAB_RUNG, leaderName: 'Agus S.', direct: true })).toBe('Associate Agency Builder');
  });

  it('D-audit: names everybody a write touched, before and after, once each', () => {
    const on = (...ids: string[]) => ids.map((membershipId) => ({ membershipId, name: membershipId, placed: false, readerCoaches: false }));
    expect(peopleOn(entry())).toEqual([]);
    expect(peopleOn(entry({ invitees: [{ ...on('mem-indah')[0], placed: true }] }))).toEqual(['mem-indah']);
    // An edit that took Sari off and put Rina on touches both, and Indah once.
    expect(peopleOn(entry({ invitees: on('mem-indah', 'mem-rina') }), entry({ invitees: on('mem-indah', 'mem-sari') })))
      .toEqual(['mem-indah', 'mem-rina', 'mem-sari']);
    expect(peopleOn(entry({ invitees: on('mem-rina') }), null)).toEqual(['mem-rina']);
  });
});

describe('dates, counted on their own numbers', () => {
  it('reads a real calendar date, and ignores anything else', () => {
    expect(readableDate('2026-09-28')).toBe('2026-09-28');
    expect(readableDate('2026-02-30')).toBeUndefined();
    expect(readableDate('28/09/2026')).toBeUndefined();
    expect(readableDate(undefined)).toBeUndefined();
    expect(readableDate(['2026-09-28'])).toBeUndefined();
  });

  it('steps across a month and a year end', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('counts a trip’s days inclusively', () => {
    expect(daysInclusive('2026-09-28', '2026-09-28')).toBe(1);
    expect(daysInclusive('2026-09-28', '2026-10-28')).toBe(31);
    expect(daysInclusive('2026-12-31', '2027-01-01')).toBe(2);
  });

  it('writes minutes as a time, the end of the day as midnight', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(585)).toBe('09:45');
    expect(hhmm(1440)).toBe('00:00');
  });
});
