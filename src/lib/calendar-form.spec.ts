import { describe, expect, it } from 'vitest';
import { entry, trip } from '@test/calendar-fixtures';
import { blankForm, formFromEntry, toInput, validateForm, violationsToErrors } from './calendar-form';

const slot = { date: '2026-09-28', start: '10:00', end: '10:30' };

describe('every open starts from its seed (P12-T2 AC-4, contradiction 18)', () => {
  it('opens a new entry as an untitled Internal meeting, Travel’s dates that day and the next', () => {
    expect(blankForm(slot)).toEqual({
      type: 'meeting', title: '', notes: '', date: '2026-09-28', start: '10:00', end: '10:30',
      startsOn: '2026-09-28', endsOn: '2026-09-29',
    });
    expect(blankForm({ ...slot, date: '2026-12-31' }).endsOn).toBe('2027-01-01');
    expect(blankForm({ date: '', start: '10:00', end: '10:30' }).endsOn).toBe('');
  });

  it('fills an edit from the entry, and Travel from its two dates (contradiction 6)', () => {
    expect(formFromEntry(entry())).toMatchObject({ type: 'meeting', date: '2026-09-28', start: '09:00', end: '09:30' });
    expect(formFromEntry(trip())).toMatchObject({
      type: 'travel', startsOn: '2026-09-28', endsOn: '2026-09-29', date: '2026-09-28', start: '10:00', end: '10:30',
    });
    expect(formFromEntry(trip({ startsOn: null, endsOn: null }))).toMatchObject({ startsOn: '', endsOn: '' });
  });
});

describe('the rules (P12-T2 AC-5)', () => {
  const form = blankForm(slot);

  it('passes a well-formed entry', () => {
    expect(validateForm(form, 0)).toEqual({});
  });

  it('asks for a date, and an end after the start on that date', () => {
    expect(validateForm({ ...form, date: '' }, 0)).toEqual({ date: 'Choose a date.' });
    expect(validateForm({ ...form, start: '11:00', end: '10:00' }, 0)).toEqual({ end: 'Choose an end time after the start.' });
    expect(validateForm({ ...form, start: '11:00', end: '11:00' }, 0)).toEqual({ end: 'Choose an end time after the start.' });
    expect(validateForm({ ...form, start: '', end: '10:00' }, 0)).toEqual({ end: 'Choose an end time after the start.' });
  });

  it('takes an end of 00:00 as midnight at the end of the date — nothing but Travel crosses midnight', () => {
    expect(validateForm({ ...form, start: '23:00', end: '00:00' }, 0)).toEqual({});
  });

  it('asks Travel for a return on or after its departure, at most 31 days, inclusive', () => {
    const travel = { ...form, type: 'travel' as const };
    expect(validateForm({ ...travel, startsOn: '2026-09-28', endsOn: '2026-09-28' }, 0)).toEqual({});
    expect(validateForm({ ...travel, startsOn: '2026-09-28', endsOn: '2026-09-27' }, 0))
      .toEqual({ endsOn: 'Choose a return date on or after the departure date.' });
    expect(validateForm({ ...travel, startsOn: '2026-09-28', endsOn: '2026-10-28' }, 0)).toEqual({});
    expect(validateForm({ ...travel, startsOn: '2026-09-28', endsOn: '2026-10-29' }, 0))
      .toEqual({ endsOn: 'A trip can be at most 31 days.' });
    expect(validateForm({ ...travel, startsOn: '', endsOn: '2026-10-01' }, 0)).toEqual({ startsOn: 'Choose a date.' });
    expect(validateForm({ ...travel, endsOn: '' }, 0)).toEqual({ endsOn: 'Choose a return date on or after the departure date.' });
  });

  it('holds the title to 120 characters, the notes to 1,000 and the invitees to 50', () => {
    expect(validateForm({ ...form, title: 'x'.repeat(120) }, 50)).toEqual({});
    expect(validateForm({ ...form, title: 'x'.repeat(121), notes: 'y'.repeat(1001) }, 51)).toEqual({
      title: 'Keep the title to 120 characters.',
      notes: 'Keep the notes to 1,000 characters.',
      invitees: 'You can invite at most 50 people.',
    });
  });
});

describe('what a save sends', () => {
  it('sends the timing its type needs, and none of the other’s', () => {
    expect(toInput(blankForm(slot), ['mem-1'])).toEqual({
      type: 'meeting', title: '', notes: '', date: '2026-09-28', start: '10:00', end: '10:30', inviteeIds: ['mem-1'],
    });
    expect(toInput({ ...blankForm(slot), type: 'travel' }, [])).toEqual({
      type: 'travel', title: '', notes: '', startsOn: '2026-09-28', endsOn: '2026-09-29', inviteeIds: [],
    });
  });
});

describe('a server refusal, under its fields', () => {
  it('places each violation by the field it names', () => {
    expect(violationsToErrors({
      violations: ['title must be 0–120 characters.', 'end must be after start.', 'endsOn must be on or after startsOn.', 42],
    })).toEqual({
      title: 'Keep the title to 120 characters.',
      end: 'Choose an end time after the start.',
      endsOn: 'Choose a return date on or after the departure date.',
    });
    expect(violationsToErrors({ violations: ['notes is too long', 'inviteeIds must have at most 50', 'date must be a date', 'startsOn is required.'] }))
      .toEqual({
        notes: 'Keep the notes to 1,000 characters.',
        invitees: 'You can invite at most 50 people.',
        date: 'Choose a date.',
        startsOn: 'Choose a date.',
      });
  });

  it('reads the server’s own sentences (`calendar-time.ts`, the DTOs)', () => {
    expect(violationsToErrors({ violations: ['end must be after start on the same date.'] })).toEqual({ end: 'Choose an end time after the start.' });
    expect(violationsToErrors({ violations: ['endsOn must be at most 31 days from startsOn, inclusive.'] })).toEqual({ endsOn: 'A trip can be at most 31 days.' });
    expect(violationsToErrors({ violations: ['title must be shorter than or equal to 120 characters'] })).toEqual({ title: 'Keep the title to 120 characters.' });
    expect(violationsToErrors({ violations: ['inviteeIds must contain no more than 50 elements'] })).toEqual({ invitees: 'You can invite at most 50 people.' });
    expect(violationsToErrors({ violations: ['inviteeIds must not include you: you are on your own entry already.'] })).toBeNull();
  });

  it('leaves what it cannot place to the banner', () => {
    expect(violationsToErrors({ violations: ['property colour should not exist'] })).toBeNull();
    expect(violationsToErrors(undefined)).toBeNull();
  });
});
