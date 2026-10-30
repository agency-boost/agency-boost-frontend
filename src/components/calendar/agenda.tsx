'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { itemsOnDay, tripDay } from '@/lib/calendar-layout';
import {
  entryName, isBusy, isHiddenTask, titleOf, type CalendarEntry, type CalendarItem, type CalendarJoinedItem,
  type CalendarRead, type CalendarTask,
} from '@/lib/calendar';
import { formatTimeSpan, formatWeekdayDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Avatar, ENTRY_TONE } from './calendar-parts';
import { EVENT_TONE, PersonTaskGroup, SourceIcon, TaskChecklist, type TaskPerson } from './calendar-tasks';

/** Somebody compared beside the reader, and their read of the same days (`null` while it is on its way). */
export interface AgendaPerson {
  person: TaskPerson;
  read: CalendarRead | null;
}

/** One thing on a day of the Agenda, whoever's it is. */
type AgendaLine =
  | { kind: 'entry'; item: CalendarItem; who: TaskPerson | null }
  | { kind: 'event'; item: CalendarJoinedItem; who: TaskPerson | null };

const startOf = (line: AgendaLine) => line.item.start ?? '';
const keyOf = (line: AgendaLine, i: number) => {
  const item = line.item as Partial<{ entryId: string; eventId: string }>;
  return `${line.who?.membershipId ?? 'me'}-${item.entryId ?? item.eventId ?? `busy-${line.item.startsAt}-${i}`}`;
};

/**
 * **The Agenda** (P18.95-T8 AC-1; UI V1, 2026-10-30, UI-104 points 2, 8, 9 and 10). The owner likes it as it was — a
 * bordered list, grey day bands, cards with a 3px coloured left border, the time, the title and the type — and keeps
 * it; what UI V1 adds:
 *
 * - **It starts on today** with no past day (point 10): its own read, seven days from the day asked for (`agenda`),
 *   ‹ a week back when needed. Today's band says *Hari ini*.
 * - **A trip** is a line at the top of each day it covers: the plane line icon and *Hari x/y* in the time's place.
 * - ***Tugas*** — the reader's tasks for the day — a checklist under the day's band, above its timed things.
 * - **Events joined** among the timed things, in their own tone with the event source icon; a tap opens the event.
 * - **Compared people** (point 9): their timed things in the same list, each with the person's small avatar, and their
 *   tasks grouped per person with one WhatsApp to them, no checkbox; a person who hides their details shows *Sibuk*
 *   at the time and their tasks as a count.
 *
 * A day with nothing on it says so. Its region is named as before, *Calendar, {range}*, and takes the focus after a
 * delete (m7).
 */
export function AgendaPane({
  read,
  others = [],
  regionLabel,
  onOpen,
  className,
}: {
  read: CalendarRead;
  others?: readonly AgendaPerson[];
  regionLabel: string;
  onOpen: (entry: CalendarEntry) => void;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden bg-card', className)}>
      <div role="region" aria-label={regionLabel} tabIndex={-1} className="bg-card">
        {read.days.map(({ date }) => (
          <AgendaDay key={date} read={read} others={others} date={date} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/** One day: its band, its trips, the reader's checklist, its timed things, then each compared person's tasks. */
export function AgendaDay({
  read, others = [], date, onOpen,
}: {
  read: CalendarRead;
  others?: readonly AgendaPerson[];
  date: string;
  onOpen: (entry: CalendarEntry) => void;
}) {
  const t = useMessages(calendarMessages);
  const language = useFigureLanguage();
  const today = date === read.today;
  const heading = `agenda-${read.subject.membershipId}-${date}`;

  const all: AgendaLine[] = [
    ...itemsOnDay(read.entries, date).map((item): AgendaLine => ({ kind: 'entry', item, who: null })),
    ...itemsOnDay(read.events, date).map((item): AgendaLine => ({ kind: 'event', item, who: null })),
    ...others.flatMap(({ person, read: theirs }) => (theirs ? [
      ...itemsOnDay(theirs.entries, date).map((item): AgendaLine => ({ kind: 'entry', item, who: person })),
      ...itemsOnDay(theirs.events, date).map((item): AgendaLine => ({ kind: 'event', item, who: person })),
    ] : [])),
  ];
  const trips = all.filter((line) => line.item.allDay);
  const timed = all.filter((line) => !line.item.allDay).sort((a, b) => startOf(a).localeCompare(startOf(b)));
  const mine = read.tasks.filter((task): task is CalendarTask => !isHiddenTask(task) && task.date === date);
  const theirs = others
    .map(({ person, read: r }) => ({ person, tasks: (r?.tasks ?? []).filter((task) => task.date === date) }))
    .filter((o) => o.tasks.length > 0);
  const empty = trips.length + timed.length + mine.length + theirs.length === 0;

  return (
    <div data-day={date} className="border-b border-hairline last:border-b-0">
      <h2
        id={heading}
        aria-current={today ? 'date' : undefined}
        className={cn('px-3.5 py-2 text-sm', today ? 'bg-amber/[0.08] font-bold text-amber-ink' : 'bg-base font-bold text-navy')}
      >
        {formatWeekdayDay(date, language)}
        {today && <> · {t.today}</>}
      </h2>
      {empty ? (
        <p className="px-3.5 py-2.5 text-sm text-muted">{t.noEvents}</p>
      ) : (
        <div className="flex flex-col gap-1.5 p-2">
          {trips.map((line, i) => <AgendaItem key={keyOf(line, i)} line={line} date={date} onOpen={onOpen} />)}
          <TaskChecklist tasks={mine} />
          {timed.length > 0 && (
            <ul aria-labelledby={heading} className="flex flex-col gap-1.5">
              {timed.map((line, i) => (
                <li key={keyOf(line, i)}><AgendaItem line={line} date={date} onOpen={onOpen} /></li>
              ))}
            </ul>
          )}
          {theirs.map((o) => <PersonTaskGroup key={o.person.membershipId} person={o.person} tasks={o.tasks} />)}
        </div>
      )}
    </div>
  );
}

/**
 * A line: its time, `09.00–09.30` — or, for a trip, the plane and *Hari x/y* — then the title, whole, and the type in
 * words, so colour is never the only thing that says what it is. **Named as the grid names it**, *{type}: {title},
 * {time}*. A compared person's line starts with their avatar. A busy block reads *Sibuk* and its time and opens nothing.
 */
function AgendaItem({ line, date, onOpen }: { line: AgendaLine; date: string; onOpen: (entry: CalendarEntry) => void }) {
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  const language = useFigureLanguage();
  const { item, who } = line;
  const span = item.allDay ? '' : formatTimeSpan(item.start ?? '', item.end ?? '', language);
  const day = item.allDay ? tripDay(item, date) : null;
  const shape = 'flex min-h-11 w-full items-start gap-3 rounded-[6px] border-l-[3px] px-2.5 py-2 text-left text-navy';
  const when: ReactNode = (
    <span className="flex w-[88px] shrink-0 items-center gap-1 text-sm font-bold">
      {who && <Avatar initials={who.initials} />}
      {day ? (
        <>
          <LineIcon name="plane" className="h-3.5 w-3.5" />
          <span className="whitespace-nowrap text-xs">{t.tripDay(day)}</span>
        </>
      ) : <span className={who ? 'text-xs' : undefined}>{span}</span>}
    </span>
  );
  if (isBusy(item)) {
    return (
      <div data-busy="" className={cn(shape, 'border-line bg-pill-grey')}>
        {when}
        <span className="min-w-0 flex-1 text-md font-semibold text-signal-grey">{t.busy}</span>
      </div>
    );
  }
  if (line.kind === 'event') {
    const event = item as Extract<CalendarJoinedItem, { eventId: string }>;
    return (
      <Link
        href={`/events/${encodeURIComponent(event.eventId)}`}
        data-event=""
        aria-label={t.joinedName({ title: event.title, type: event.type.label, time: span })}
        className={cn(shape, 'hover:brightness-[0.96]', EVENT_TONE)}
      >
        {when}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-md font-semibold">{event.title}</span>
          <span className="block text-xs">{event.type.label}</span>
        </span>
        <SourceIcon source="event" size="sm" />
      </Link>
    );
  }
  const entry = item as CalendarEntry;
  return (
    <button
      type="button"
      data-entry=""
      aria-label={entryName(entry, span, words)}
      onClick={() => onOpen(entry)}
      className={cn(shape, 'hover:brightness-[0.96]', ENTRY_TONE[entry.type])}
    >
      {when}
      <span className="min-w-0 flex-1">
        <span className="block break-words text-md font-semibold">{titleOf(entry, words)}</span>
        <span className="block text-xs">{t.types[entry.type]}</span>
      </span>
    </button>
  );
}

/** The agenda's frame while its read is on its way: three days' headings and lines, nothing in them (L-01). */
export function AgendaSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="border-b border-hairline last:border-b-0">
          <div className="bg-base px-3.5 py-2.5">
            <span className="block h-3 w-32 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none" />
          </div>
          <div className="flex flex-col gap-1.5 p-2">
            <span className="block h-11 animate-pulse rounded-[6px] bg-hairline/60 motion-reduce:animate-none" />
            <span className="block h-11 animate-pulse rounded-[6px] bg-hairline/60 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
