import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { clockMinutes, endMinutes } from './format';
import {
  NOTES_MAX, TITLE_MAX, TRIP_DAYS_MAX, INVITEES_MAX, addDays, calendarWordsIn, daysInclusive, limitWords, readableDate,
  type CalendarEntry, type EntryInput, type EntryType,
} from './calendar';

/**
 * The entry dialog's fields and their rules (P12-T2 AC-4, AC-5).
 *
 * **Every open resets every field** (contradiction 18): the prototype's *+ New event* reopened on
 * whatever the last open left there (`:763-769`), and its Travel dates were never reset at all. A form
 * here is always built from a seed — a slot, the office's today, or the entry being edited — and never
 * from the form before it.
 */
export interface EntryForm {
  type: EntryType;
  title: string;
  notes: string;
  date: string;
  start: string;
  end: string;
  startsOn: string;
  endsOn: string;
}

/** Where a new entry starts: a date, and a slot on it. */
export interface Slot {
  date: string;
  start: string;
  end: string;
}

/** *Start* 10:00 and *End* 10:30 (`:394`, `:398`) — the slot *+ New event* opens on. */
export const DEFAULT_START = '10:00';
export const DEFAULT_END = '10:30';

/** A new entry on a slot: an *Internal meeting*, untitled, with Travel's dates that day and the next. */
export function blankForm(slot: Slot, type: EntryType = 'meeting', title = ''): EntryForm {
  return {
    type,
    title,
    notes: '',
    date: slot.date,
    start: slot.start,
    end: slot.end,
    startsOn: slot.date,
    endsOn: slot.date ? addDays(slot.date, 1) : '',
  };
}

/**
 * The entry being edited. **Travel edits as its two dates** (contradiction 6: the prototype's edit
 * showed it *Date*, *Start* and *End*, `:730-731`); its timed fields wait at the default slot on its
 * first day, should the organiser change its type.
 */
export function formFromEntry(entry: CalendarEntry): EntryForm {
  const first = (entry.allDay ? entry.startsOn : entry.date) ?? '';
  return {
    type: entry.type,
    title: entry.title,
    notes: entry.notes,
    date: entry.date ?? first,
    start: entry.start ?? DEFAULT_START,
    end: entry.end ?? DEFAULT_END,
    startsOn: entry.startsOn ?? first,
    endsOn: entry.endsOn ?? (first ? addDays(first, 1) : ''),
  };
}

export type FormField = 'date' | 'end' | 'startsOn' | 'endsOn' | 'title' | 'notes' | 'invitees';
export type FormErrors = Partial<Record<FormField, string>>;

/** The rules' sentences, each said under its field. */
export type FormWords = ReturnType<typeof formWords>;

/**
 * **The rules' sentences in a language** (P18.98-T4): their words in `language` (English when none is passed), a
 * limit's figure in `figures` (Indonesian when none is passed, as before). The dialog passes the reader's.
 */
export function formWords(language: Language = SOURCE_LANGUAGE, figures: Language = DEFAULT_LANGUAGE) {
  const t = calendarWordsIn(language);
  return {
    chooseDate: t.chooseDate,
    endAfterStart: t.endAfterStart,
    returnAfterDeparture: t.returnAfterDeparture,
    ...limitWords(language, figures),
  };
}

/**
 * The rules, each a message under its own field (a Fill, in the calendar's own words, ADR-0096). The
 * server holds the same rules and refuses whatever this misses with 400 `VALIDATION_FAILED`.
 */
export function validateForm(form: EntryForm, inviteeCount: number, words: FormWords = formWords()): FormErrors {
  const errors: FormErrors = {};
  if (form.type === 'travel') {
    if (!readableDate(form.startsOn)) errors.startsOn = words.chooseDate;
    if (!readableDate(form.endsOn) || (readableDate(form.startsOn) && form.endsOn < form.startsOn)) {
      errors.endsOn = words.returnAfterDeparture;
    } else if (readableDate(form.startsOn) && daysInclusive(form.startsOn, form.endsOn) > TRIP_DAYS_MAX) {
      errors.endsOn = words.tripTooLong;
    }
  } else {
    if (!readableDate(form.date)) errors.date = words.chooseDate;
    const start = clockMinutes(form.start);
    const end = endMinutes(form.end);
    // Nothing but Travel crosses midnight: an end of 00:00 is the end of this date.
    if (start === null || end === null || end <= start) errors.end = words.endAfterStart;
  }
  if (form.title.length > TITLE_MAX) errors.title = words.titleTooLong;
  if (form.notes.length > NOTES_MAX) errors.notes = words.notesTooLong;
  if (inviteeCount > INVITEES_MAX) errors.invitees = words.tooManyInvitees;
  return errors;
}

/** What a save sends: the timing its type needs, and nothing of the other's. */
export function toInput(form: EntryForm, inviteeIds: string[]): EntryInput {
  const common = { type: form.type, title: form.title, notes: form.notes, inviteeIds };
  return form.type === 'travel'
    ? { ...common, startsOn: form.startsOn, endsOn: form.endsOn }
    : { ...common, date: form.date, start: form.start, end: form.end };
}

/**
 * A server refusal's `details.violations`, put under the fields they name. The server words each
 * violation as a sentence beginning with its field (`error-catalog.md`, `VALIDATION_FAILED`), in either language; one
 * this cannot place is left to the dialog's banner, so nothing is lost. `words` are the sentences put in its place.
 */
export function violationsToErrors(
  details: Record<string, unknown> | undefined, words: FormWords = formWords(),
): FormErrors | null {
  const violations = Array.isArray(details?.violations) ? (details.violations as unknown[]) : [];
  const errors: FormErrors = {};
  const place: [RegExp, FormField, string][] = [
    [/^title\b/i, 'title', words.titleTooLong],
    [/^notes\b/i, 'notes', words.notesTooLong],
    // Only the limit: an invitee refused for who they are is the 404 the dialog marks on their chip.
    [new RegExp(`^inviteeIds\\b.*(more than|at most|\\b${INVITEES_MAX}\\b)`, 'i'), 'invitees', words.tooManyInvitees],
    [/^(startsOn|departure)\b/i, 'startsOn', words.chooseDate],
    // The API's sentence in the reader's language (P18.98-T5): *"endsOn paling lambat 31 hari …"* in Indonesian.
    [/^endsOn (?:must be at most|paling lambat)\b/i, 'endsOn', words.tripTooLong],
    [/^endsOn\b/i, 'endsOn', words.returnAfterDeparture],
    [/^date\b/i, 'date', words.chooseDate],
    [/^(start|end)\b/i, 'end', words.endAfterStart],
  ];
  for (const violation of violations) {
    if (typeof violation !== 'string') continue;
    const hit = place.find(([pattern]) => pattern.test(violation.trim()));
    if (hit) errors[hit[1]] ??= hit[2];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
