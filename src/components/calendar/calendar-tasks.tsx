'use client';

import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';
import { LeadContactButtons, MemberContactButtons } from '@/components/contact-buttons';
import { CenterPopup } from '@/components/ui/responsive-sheet';
import { LineIcon, type LineIconName } from '@/components/ui/line-icon';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import {
  ENTRY_TYPES, isBusy, isHiddenTask, type CalendarRead, type CalendarTask, type CalendarTaskItem, type EntryType,
  type TaskSource,
} from '@/lib/calendar';
import { myCoachingHref, coachingSessionHref } from '@/lib/coaching';
import { formatNumber, formatShortDay, formatWeekday } from '@/lib/format';
import type { Language } from '@/i18n/language';
import { cn } from '@/lib/cn';
import { Avatar } from './calendar-parts';

/**
 * **The calendar's *Tugas*, its filter and its sources** (UI V1, 2026-10-30, UI-104 points 1 to 4 and 9;
 * `functional/calendar.md`, *UI V1*). A task is a date and no time — a lead's next action, or an open coaching action
 * item — read from its source on every read. One row everywhere: the Agenda's checklist under a day's header, the
 * centred popup a count pill opens, a compared person's group. The reader's own rows carry a checkbox, which completes
 * the item at its source (`CalendarTasksContext`); **nobody else's do** (*no checkboxes on other people's tasks*).
 */

/** A day as the popup and a count pill name it: *Sen, 28 Sep* — the formatters' weekday and day. */
export const dayShort = (day: string, figures: Language) => `${formatWeekday(day, figures)}, ${formatShortDay(day, {}, figures)}`;

/** What a type chip filters: the five entry types, and the events joined (UI-104 point 9). */
export type FilterKind = EntryType | 'event';

/** The chips' order: the five types in the legend's order, then the events joined. */
export const FILTER_KINDS: readonly FilterKind[] = [...ENTRY_TYPES, 'event'];

/** **A joined event's tone**: lavender, a colour none of the five types has, so it reads as from elsewhere. */
export const EVENT_TONE = 'border-lavender bg-lavender/[0.14]';

/** Each chip's swatch, the type's own colour (the legend's, which the chips replace — D-27). */
const CHIP_SWATCH: Record<FilterKind, string> = {
  meeting: 'bg-navy-soft',
  coaching: 'bg-amber-dark',
  client: 'bg-alert',
  task: 'bg-success',
  travel: 'bg-teal',
  event: 'bg-lavender',
};

/**
 * **A read with the unticked types taken out** (UI-104 point 9): an entry of a hidden type, a joined event when *Event*
 * is off, and — when *Tugas* is off — every task, so its checklist, its row and its counts go with it. A busy block has
 * no type, so it stays.
 */
export function filterRead(read: CalendarRead, hidden: ReadonlySet<FilterKind>): CalendarRead {
  if (hidden.size === 0) return read;
  return {
    ...read,
    entries: read.entries.filter((item) => isBusy(item) || !hidden.has(item.type)),
    tasks: hidden.has('task') ? [] : read.tasks,
    events: hidden.has('event') ? read.events.filter((item) => 'busy' in item) : read.events,
  };
}

/**
 * **The *Jenis* chips** (UI-104 point 9): one tick chip per type in its colour, replacing the coloured-dot legend.
 * Pressed is shown; unticking hides that type at once in every view.
 */
export function TypeChips({ hidden, onToggle }: { hidden: ReadonlySet<FilterKind>; onToggle: (kind: FilterKind) => void }) {
  const t = useMessages(calendarMessages);
  return (
    <div role="group" aria-label={t.type} className="flex flex-wrap gap-1.5">
      {FILTER_KINDS.map((kind) => {
        const on = !hidden.has(kind);
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(kind)}
            className={cn(
              // 44px on a phone and a tablet (UI-118: *every control at 768 is at least 44px tall*), 32px on a laptop.
              'inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-hairline px-2.5 text-xs font-semibold lg:min-h-8',
              on ? 'bg-card text-navy' : 'bg-hover-row text-signal-grey',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('flex h-4 w-4 items-center justify-center rounded-[4px] text-white', on ? CHIP_SWATCH[kind] : 'bg-line')}
            >
              {on && <LineIcon name="check" className="h-3 w-3" />}
            </span>
            {kind === 'event' ? t.eventChip : t.types[kind]}
          </button>
        );
      })}
    </div>
  );
}

/** A source's line icon, the nav's own: *Leads*' funnel, *Coaching*'s chat, *Event*'s calendar. */
const SOURCE_ICON: Record<TaskSource | 'event', LineIconName> = { lead: 'funnel', coaching: 'chat', event: 'calendar' };
const SOURCE_TONE: Record<TaskSource | 'event', string> = {
  lead: 'bg-pill-amber text-primary-ink',
  coaching: 'bg-secondary/[0.08] text-navy',
  event: 'bg-lavender/[0.14] text-navy',
};

/** **Where an item comes from** (UI-104 point 1): a small round line icon, named for a screen reader. */
export function SourceIcon({ source, size = 'md' }: { source: TaskSource | 'event'; size?: 'sm' | 'md' }) {
  const t = useMessages(calendarMessages);
  return (
    <span
      role="img"
      aria-label={t.sources[source]}
      className={cn('flex shrink-0 items-center justify-center rounded-full', size === 'md' ? 'h-7 w-7' : 'h-5 w-5', SOURCE_TONE[source])}
    >
      <LineIcon name={SOURCE_ICON[source]} className={size === 'md' ? 'h-4 w-4' : 'h-3 w-3'} />
    </span>
  );
}

/** What a task row may do, held by the page (`CalendarScreen`, `HomeScreen`; `useTaskTicks`) and read by every row. */
export interface CalendarTasks {
  /**
   * **Whether a task is done** (P19.11-T1 AC-1, AC-2): the server's `done`, with this visit's taps laid over it — one
   * rule for a row's completed style and for every count, so a fresh tap and a loaded tick look and count alike.
   */
  isDone: (task: CalendarTask) => boolean;
  /** Tick or untick one of the reader's own: done at its source, the toast offering *Urungkan*. */
  toggle: (task: CalendarTask) => void;
  /** A lead row's ›: the lead's details. */
  openLead: (task: CalendarTask) => void;
  /** The reader may tick: their own calendar, outside a read-only support session. */
  canTick: boolean;
  /**
   * A coaching item may be ticked too: never in a support session of either kind. Ticking it is the coachee's own
   * declaration (*I did it*), which the server refuses to anybody acting as them (T16, L3).
   */
  canTickCoaching: boolean;
  /** After a number is saved from a row: the page reads again, so the next tap goes straight through. */
  onPhoneSaved: () => void;
}

const NOTHING: CalendarTasks = {
  isDone: (task) => task.done, toggle: () => undefined, openLead: () => undefined, canTick: false, canTickCoaching: false,
  onPhoneSaved: () => undefined,
};

export const CalendarTasksContext = createContext<CalendarTasks>(NOTHING);

/** The page's task controls; inert outside one. */
export const useCalendarTasks = () => useContext(CalendarTasksContext);

/**
 * **The open tasks: what every *Tugas* count counts** (P19.11-T1 AC-2; UXQ8 — open only) — *Tugas · n*, the popup's
 * title, the Week's and 3 Hari's count row, the Month's badge and Home's *Tugas* chip. A hidden person's task is a count
 * of an open one already (the server sends no ticked one as busy).
 */
export function openTasks<T extends CalendarTaskItem>(tasks: readonly T[], isDone: (task: CalendarTask) => boolean): T[] {
  return tasks.filter((task) => isHiddenTask(task) || !isDone(task));
}

/** How many of them are open (`openTasks`). */
export function openCount(tasks: readonly CalendarTaskItem[], isDone: (task: CalendarTask) => boolean): number {
  return openTasks(tasks, isDone).length;
}

/** **The ticked ones** (P19.11-T1 AC-1): what a day with no open task still holds, behind its muted ✓. */
export function doneTasks(tasks: readonly CalendarTaskItem[], isDone: (task: CalendarTask) => boolean): CalendarTask[] {
  return tasks.filter((task): task is CalendarTask => !isHiddenTask(task) && isDone(task));
}

/**
 * **A day whose tasks are all done** (P19.11-T1 AC-1): a muted ✓ where the count goes — the status grey, never *Tugas*
 * blue, so it is never read as work to do (4.4:1 on its pill, over the 3:1 a graphic needs; WCAG 1.4.11).
 */
export const ALL_DONE_TONE = 'bg-pill-grey text-signal-grey';

/**
 * **One task row** (UI-104 point 2; the mockup's 52–56px row): the checkbox — the reader's own only — the source icon,
 * the NAME in caps (a coaching item *Dari: NAME*), the note in grey under it, the round WhatsApp button for the name on
 * the row (*Isi nomor WhatsApp* when there is no number, UI-081), and, for a lead, the › that opens its details. A
 * coaching row opens the 1:1 it came from. *Urungkan* (the toast's, or the checkbox again) puts a tick back.
 *
 * **Completed — one style, whether ticked a moment ago or read ticked from the server** (P19.11-T1 AC-1; UX-1): the
 * checkbox filled *Tugas* blue with a white check, the name and the note struck through in grey, the WhatsApp button and
 * the › faded — WhatsApp still tappable (UXQ8). It stays on its due date across a refresh. Reused whole by Home's *Aksi
 * hari ini* (AC-3).
 */
export function TaskRow({ task, mine, owner }: {
  task: CalendarTask;
  /** The reader's own: a checkbox, and the coaching row opens their own 1:1 record. */
  mine: boolean;
  /** Whose task, when it is not the reader's: their name, for a coaching row's link. */
  owner?: { membershipId: string; name: string };
}) {
  const t = useMessages(calendarMessages);
  const { isDone, toggle, openLead, canTick, canTickCoaching, onPhoneSaved } = useCalendarTasks();
  const done = isDone(task);
  const ticks = mine && canTick && (task.source !== 'coaching' || canTickCoaching);
  const title = task.source === 'coaching' ? t.from({ name: task.name.toLocaleUpperCase('id') }) : task.name.toLocaleUpperCase('id');
  const words = (
    <span className="min-w-0 flex-1">
      <span className={cn('block truncate text-sm font-bold', done ? 'text-line line-through' : 'text-navy')}>{title}</span>
      {task.note && (
        <span className={cn('block truncate text-xs', done ? 'text-line line-through' : 'text-muted')}>{task.note}</span>
      )}
      {/* A strike is not heard: a row with no checkbox — somebody else's — says it is done in words. */}
      {done && !ticks && <span className="sr-only">{`, ${t.done}`}</span>}
    </span>
  );
  const name = task.source === 'coaching' ? t.from({ name: task.name }) : task.name;
  let body: ReactNode;
  if (task.source === 'lead' && task.lead) {
    body = (
      <button
        type="button"
        onClick={() => openLead(task)}
        aria-label={t.openLead({ name: task.name })}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <SourceIcon source="lead" />
        {words}
      </button>
    );
  } else if (task.coaching) {
    const href = mine ? myCoachingHref(task.coaching.sessionId) : coachingSessionHref(owner?.membershipId ?? task.ownerMembershipId);
    body = (
      <Link
        href={href}
        aria-label={t.openSession({ name: mine ? task.name : owner?.name ?? task.name })}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5"
      >
        <SourceIcon source="coaching" />
        {words}
      </Link>
    );
  } else {
    body = <span className="flex min-w-0 flex-1 items-center gap-2.5"><SourceIcon source={task.source} />{words}</span>;
  }
  return (
    <li data-task={task.taskId} data-done={done ? '' : undefined} className={cn('flex min-h-[52px] items-center gap-2 px-2.5', done && 'opacity-90')}>
      {ticks && (
        <label className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={done}
            onChange={() => toggle(task)}
            aria-label={t.markDone({ name })}
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden="true"
            className={cn(
              'flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border-2 text-white peer-focus-visible:ring-2 peer-focus-visible:ring-focus-ring',
              // *Tugas* blue (UI-154), never green: a ticked box filled, an unticked one's edge — 7.99:1 on the card, where
              // the grey `line` was 1.5:1, short of the 3:1 a control's edge needs (1.4.11; `tokens.md`).
              done ? 'border-tugas-ink bg-tugas-ink' : 'border-tugas-ink bg-card',
            )}
          >
            {done && <LineIcon name="check" className="h-3.5 w-3.5" />}
          </span>
        </label>
      )}
      {body}
      <span className={cn('shrink-0', done && 'opacity-40')}>
        {task.source === 'lead' && task.lead ? (
          <LeadContactButtons
            lead={{ id: task.lead.leadId, name: task.name, contact: { phone: task.phone, email: null }, version: task.lead.version }}
            channels={['whatsapp']}
            size={36}
            // The task carries no email, and its version a tick moves: the lead is read before its number is saved.
            readFirst
            onSaved={onPhoneSaved}
          />
        ) : task.coaching && task.phone ? (
          // Only with the coach's number on file: a coachee cannot fill in their coach's, and the server refuses it.
          <MemberContactButtons
            membershipId={task.coaching.coachMembershipId}
            name={task.name}
            phone={task.phone}
            channels={['whatsapp']}
            size={36}
            onSaved={onPhoneSaved}
          />
        ) : null}
      </span>
      {task.source === 'lead' && (
        // Faded with the WhatsApp button when done (P19.11-T1 AC-1): it was the one part of the row a tick left as it was.
        <span aria-hidden="true" data-chevron="" className={cn('shrink-0 text-line', done && 'opacity-40')}>
          <LineIcon name="chevronRight" className="h-4 w-4" />
        </span>
      )}
    </li>
  );
}

/** A compared person on a task group: who, their number for the one WhatsApp, and whether they hide their details. */
export interface TaskPerson {
  membershipId: string;
  name: string;
  initials: string;
  phone: string | null;
}

/**
 * **A compared person's tasks** (UI-104 point 9; mockup 5): *INDAH PERMATASARI · Tugas 2* with their avatar and one
 * WhatsApp to them, then their rows — no checkbox. **One who hides their details** shows the count alone and *Sibuk*:
 * no name of a lead, no note, no coach.
 */
export function PersonTaskGroup({ person, tasks }: { person: TaskPerson; tasks: readonly CalendarTaskItem[] }) {
  const t = useMessages(calendarMessages);
  const figures = useFigureLanguage();
  const { onPhoneSaved, isDone } = useCalendarTasks();
  const hidden = tasks.some(isHiddenTask);
  const shown = tasks.filter((task): task is CalendarTask => !isHiddenTask(task));
  return (
    <div data-person-tasks={person.membershipId} className={cn('rounded-[6px] border border-dashed bg-card', hidden ? 'border-line' : 'border-tugas-edge')}>
      <div className={cn('flex min-h-11 items-center gap-2 px-2.5 text-xs font-bold text-navy', !hidden && 'border-b border-divider')}>
        <Avatar initials={person.initials} />
        <span className="min-w-0 flex-1 truncate">
          {t.personTasks({ name: person.name.toLocaleUpperCase('id'), count: formatNumber(openCount(tasks, isDone), {}, figures) })}
        </span>
        {hidden ? (
          <span className="font-semibold text-signal-grey">{t.busy}</span>
        ) : (
          <MemberContactButtons
            membershipId={person.membershipId}
            name={person.name}
            phone={person.phone}
            channels={['whatsapp']}
            size={36}
            onSaved={onPhoneSaved}
          />
        )}
      </div>
      {!hidden && (
        <ul className="divide-y divide-divider">
          {shown.map((task) => <TaskRow key={task.taskId} task={task} mine={false} owner={person} />)}
        </ul>
      )}
    </div>
  );
}

/**
 * **The Agenda's checklist** (UI-104 point 2): *Tugas · n* under the day's header, above its timed things, the reader's
 * rows with their checkboxes. Nothing when the day has none. **Blue** (P19.1-T3 AC-6, UI-154): a dashed `tugas-edge`
 * border and a `tugas-ink` heading, at every size (*Decisions* 6).
 */
export function TaskChecklist({ tasks }: { tasks: readonly CalendarTask[] }) {
  const t = useMessages(calendarMessages);
  const figures = useFigureLanguage();
  const { isDone } = useCalendarTasks();
  if (tasks.length === 0) return null;
  return (
    <section aria-label={t.tasks} data-checklist="" className="rounded-[6px] border border-dashed border-tugas-edge bg-card">
      <p className="flex min-h-8 items-center gap-1.5 border-b border-divider px-2.5 text-xs font-bold text-tugas-ink">
        <LineIcon name="checklist" className="h-4 w-4" />
        {t.tasksCount({ count: formatNumber(openCount(tasks, isDone), {}, figures) })}
      </p>
      <ul className="divide-y divide-divider">
        {tasks.map((task) => <TaskRow key={task.taskId} task={task} mine />)}
      </ul>
    </section>
  );
}

/**
 * **A day's count pill** (UI-104 point 2): the count, a grey *·* when there is none. A button that opens the day's popup
 * when `onOpen` is given; a plain mark otherwise — a hidden person's count, which opens nothing. **A soft blue pill**
 * (P19.1-T3 AC-6, UI-154), where it was a solid orange one that shouted as loudly as today; 44px a target on a phone and
 * a tablet, 32px on a laptop.
 */
export function CountPill({ day, count, done = 0, onOpen }: {
  day: string;
  /** The open tasks (UXQ8): the number drawn. */
  count: number;
  /** The ticked ones (P19.11-T1 AC-1): with none open, a muted ✓ that still opens the day's popup. */
  done?: number;
  onOpen?: () => void;
}) {
  const t = useMessages(calendarMessages);
  const figures = useFigureLanguage();
  if (count === 0 && done > 0 && onOpen) {
    // *Changed 2026-11-10 (P19.11-T1 AC-1; UX-1):* a day whose tasks are all ticked drew `·`, so its completed tasks could
    // not be reached from the Week or 3 Hari. Its ✓ opens the same popup; the number stays the open count, 0.
    return (
      <button
        type="button"
        data-count-pill={day}
        data-all-done=""
        aria-label={t.allTasksDone({ day: dayShort(day, figures), count: formatNumber(done, {}, figures) })}
        onClick={onOpen}
        className="flex h-11 min-w-11 items-center justify-center justify-self-center lg:h-8"
      >
        <span className={cn('inline-flex h-5 min-w-[22px] items-center justify-center rounded-pill px-[7px]', ALL_DONE_TONE)}>
          <LineIcon name="check" className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }
  if (count === 0) {
    return <span aria-hidden="true" className="justify-self-center text-md font-bold text-line">·</span>;
  }
  const pill = (
    <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-pill bg-tugas px-[7px] text-xs font-bold text-tugas-ink">
      {formatNumber(count, {}, figures)}
    </span>
  );
  const name = t.tasksOn({ day: dayShort(day, figures), count: formatNumber(count, {}, figures) });
  if (!onOpen) return <span role="img" aria-label={name} className="justify-self-center">{pill}</span>;
  return (
    <button
      type="button"
      data-count-pill={day}
      aria-label={name}
      onClick={onOpen}
      className="flex h-11 min-w-11 items-center justify-center justify-self-center lg:h-8"
    >
      {pill}
    </button>
  );
}

/** Somebody compared, with their read: their tasks go in a popup and a checklist as a group of their own. */
export interface ComparedTasks {
  person: TaskPerson;
  tasks: readonly CalendarTaskItem[];
}

/**
 * **The day's tasks in a small centred popup** (UI-104 point 3): *Tugas · Sen, 28 Sep (n)* with ✕, rows like the
 * Agenda's (WhatsApp included) — the reader's own first, then each compared person's group — up to ~60% of the screen
 * and scrolling inside it; outside or ✕ closes. **A tick keeps it open**; a lead row's › closes it and opens the lead.
 */
export function TaskPopup({
  day, tasks, others, onClose,
}: {
  day: string;
  tasks: readonly CalendarTask[];
  others: readonly ComparedTasks[];
  onClose: () => void;
}) {
  const t = useMessages(calendarMessages);
  const figures = useFigureLanguage();
  const { isDone } = useCalendarTasks();
  const theirs = others.map((o) => ({ ...o, tasks: o.tasks.filter((task) => task.date === day) })).filter((o) => o.tasks.length > 0);
  const count = openCount(tasks, isDone) + theirs.reduce((n, o) => n + openCount(o.tasks, isDone), 0);
  return (
    <CenterPopup open title={t.tasksTitle({ day: dayShort(day, figures), count: formatNumber(count, {}, figures) })} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {tasks.length > 0 && (
          <ul className="-mx-1 divide-y divide-divider">
            {tasks.map((task) => <TaskRow key={task.taskId} task={task} mine />)}
          </ul>
        )}
        {theirs.map((o) => <PersonTaskGroup key={o.person.membershipId} person={o.person} tasks={o.tasks} />)}
      </div>
    </CenterPopup>
  );
}
