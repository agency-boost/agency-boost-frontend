import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { AAB_RUNG, AB_RUNG, AGENT_RUNG, busy, entry } from '@test/calendar-fixtures';
import {
  addDays, answerEntry, createEntry, daysInclusive, deleteEntry, DOWNLINE_GROUP_LABEL, entryDate, entryNameSuffix,
  hhmm, initialsOf, INVITEES_MAX, isBusy, NOTES_MAX, OWN_COPY, PEOPLE_GROUP_LABEL, peopleOn, personTag, placeBlock,
  PROTOTYPE_COPY, readableDate, readCalendar, readCalendarSettings, readDownline, readEntry, saveCalendarSettings,
  searchPeople, TITLE_MAX, titleOf, TRIP_DAYS_MAX, TYPE_LABEL, updateEntry,
  isZoomHost, meetingUrl, notesParts, viewOf,
} from './calendar';
import * as calendarModule from './calendar';

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

describe('Hide my personal activities (P13.1-T8, ADR-0110)', () => {
  it('P13.1-T8 AC-2 reads the reader’s own setting, and saves it whole, naming nobody', async () => {
    const { calls } = stubFetch({ '/calendar/settings': { body: { hideDetails: true } } });
    expect(await readCalendarSettings()).toEqual({ hideDetails: true });
    await saveCalendarSettings({ hideDetails: false });
    expect(calls[0].url).toMatch(/\/calendar\/settings$/);
    expect(calls[0].init.method ?? 'GET').toBe('GET');
    expect(calls[1].url).toMatch(/\/calendar\/settings$/);
    expect(calls[1].init.method).toBe('PUT');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ hideDetails: false });
  });
});

describe('the words', () => {
  it('P18.95-T8 AC-2 names the types once: the legend’s and the toggle’s words, verbatim (`:310-314`), which the badge now uses too', () => {
    expect(Object.values(TYPE_LABEL)).toEqual(['Internal meeting', '1:1 coaching', 'Client meeting', 'Task', 'Travel']);
    // The prototype's badge words (`:824`) are gone from the module: there is one map, not two.
    expect(Object.keys(calendarModule)).not.toContain('TYPE_BADGE');
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
      ? (value as (...args: string[]) => string)('Rina Wijaya', '28 Sep – 4 Okt 2026')
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
    expect(OWN_COPY.notesTooLong).toBe('Keep the notes to 1.000 characters.');
    expect(NOTES_MAX).toBe(1000);
    expect(OWN_COPY.tooManyInvitees).toBe(`You can invite at most ${INVITEES_MAX} people.`);
    // In the source, each sentence names its constant and holds no digit of its own.
    const source = readFileSync(join(__dirname, 'calendar.ts'), 'utf8').split('\n');
    for (const key of ['tripTooLong', 'titleTooLong', 'notesTooLong', 'tooManyInvitees']) {
      const line = source.find((l) => l.trim().startsWith(`${key}:`)) ?? '';
      // Through `formatNumber` where the limit can reach a thousand, so it is grouped `1.000` (ADR-0167 §1). Since
      // P18.98-T4 the words are the catalogue's and the limit is handed to them as a value (`limitWords`, `max:`).
      expect(line, key).toMatch(/(?:\$\{|max: )(?:formatNumber\()?[A-Z_]+_MAX\b/);
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

  it('P12-T4 AC-3, P18.95-T9 AC-1 tags with the rung’s badge name — the ladder’s long label never — and, for anybody not a direct report, their leader’s full name', () => {
    expect(personTag({ rung: AGENT_RUNG, leaderName: 'Agus Santoso', direct: true })).toBe('Agent');
    expect(personTag({ rung: AGENT_RUNG, leaderName: 'Sari Dewi', direct: false })).toBe('Agent · under Sari Dewi');
    expect(personTag({ rung: AB_RUNG, leaderName: null, direct: false })).toBe('AB');
  });

  it('takes who is a direct report from the server’s `direct`, never from a leader’s name (invariant §2)', () => {
    // A namesake of the reader leads this agent: the same name, somebody else.
    expect(personTag({ rung: AGENT_RUNG, leaderName: 'Agus Santoso', direct: false })).toBe('Agent · under Agus Santoso');
    // The reader's direct report, whatever name the row carries for their leader.
    expect(personTag({ rung: AAB_RUNG, leaderName: 'Agus S.', direct: true })).toBe('AAB');
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

describe('P18.95-T8 AC-2 meeting links in Location / notes', () => {
  const links = (notes: string) => notesParts(notes).filter((p): p is { href: string; label: string } => 'href' in p);

  it('P18.95-T8 AC-2 Join Zoom on a zoom.us host and its own subdomains, the address kept as the href', () => {
    expect(notesParts('Zoom — https://us02web.zoom.us/j/81234567890?pwd=abc')).toEqual([
      { text: 'Zoom — ' },
      { href: 'https://us02web.zoom.us/j/81234567890?pwd=abc', label: 'Join Zoom' },
    ]);
    // The seed's own notes, typed without the scheme, read as https.
    expect(notesParts('Zoom — zoom.us/j/91827364')).toEqual([
      { text: 'Zoom — ' }, { href: 'https://zoom.us/j/91827364', label: 'Join Zoom' },
    ]);
    expect(isZoomHost('zoom.us')).toBe(true);
    expect(isZoomHost('us02web.zoom.us')).toBe(true);
  });

  it('P18.95-T8 AC-2 Join meeting on any other http(s) address, and a look-alike Zoom host is another host', () => {
    expect(links('Meet: https://meet.google.com/abc-defg-hij')).toEqual([{ href: 'https://meet.google.com/abc-defg-hij', label: 'Join meeting' }]);
    expect(links('teams.microsoft.com/l/meetup-join/19%3a')).toEqual([{ href: 'https://teams.microsoft.com/l/meetup-join/19%3a', label: 'Join meeting' }]);
    expect(links('http://intranet.example.co.id/room-2')).toEqual([{ href: 'http://intranet.example.co.id/room-2', label: 'Join meeting' }]);
    for (const host of ['https://zoom.us.evil.com/j/1', 'https://evilzoom.us/j/1', 'https://notzoom.us/j/1']) {
      expect([host, links(host)[0].label]).toEqual([host, 'Join meeting']);
    }
    expect(isZoomHost('zoom.us.evil.com')).toBe(false);
  });

  it('P18.95-T8 AC-2 makes nothing but http(s) a link: other schemes, bare words, sums and an email stay text', () => {
    for (const notes of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'mailto:agus@kpm0417.test',
      'ftp://files.example.com/agenda',
      'Kusuma residence, Jl. Melati 4',
      'Rp 1.000/bulan, dll./lain',
      'agenda.docx/notes',
      'agus@zoom.us/j/1',
      'Office — Meeting Room 2',
    ]) {
      expect([notes, links(notes)]).toEqual([notes, []]);
      expect(notesParts(notes)).toEqual([{ text: notes }]);
    }
    expect(meetingUrl('javascript:alert(1)')).toBeNull();
    expect(meetingUrl('https://localhost/x')).toBeNull();
  });

  it('P18.95-T8 AC-2 leaves a sentence’s closing mark to the sentence, finds every link, and keeps every other word', () => {
    expect(notesParts('Join here (https://zoom.us/j/1). Backup: meet.google.com/xyz, thanks!')).toEqual([
      { text: 'Join here (' },
      { href: 'https://zoom.us/j/1', label: 'Join Zoom' },
      { text: '). Backup: ' },
      { href: 'https://meet.google.com/xyz', label: 'Join meeting' },
      { text: ', thanks!' },
    ]);
    expect(notesParts('www.example.com/room')).toEqual([{ href: 'https://www.example.com/room', label: 'Join meeting' }]);
    expect(notesParts('')).toEqual([]);
  });
});

describe('P18.95-T8 AC-1 the agenda reads the week', () => {
  it('P18.95-T8 AC-1 asks the server for a week for the Agenda and the Week, and a month for the Month', () => {
    expect([viewOf('agenda'), viewOf('week'), viewOf('month')]).toEqual(['week', 'week', 'month']);
  });

  it('P18.95-T8 AC-1 counts a phone cell’s entries in words, and names its new strings with none of the six words', () => {
    expect([OWN_COPY.eventCount(1), OWN_COPY.eventCount(4), OWN_COPY.eventCount(1250)]).toEqual(['1 event', '4 events', '1.250 events']);
    expect([OWN_COPY.agenda, OWN_COPY.filters, OWN_COPY.noEvents, OWN_COPY.joinZoom, OWN_COPY.joinMeeting, OWN_COPY.newTab])
      .toEqual(['Agenda', 'Filters', 'No events', 'Join Zoom', 'Join meeting', ', opens in a new tab']);
  });
});
