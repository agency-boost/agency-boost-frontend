'use client';

import Link from 'next/link';
import { AgendaItem } from '@/components/calendar/agenda';
import { TaskRow } from '@/components/calendar/calendar-tasks';
import { LineIcon } from '@/components/ui/line-icon';
import { SectionHead } from '@/components/ui/section-title';
import { useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { segmentOn } from '@/lib/calendar-layout';
import { cn } from '@/lib/cn';
import type { HomeAction, HomeEntryAction, HomeEventAction } from '@/lib/home';
import { calendarToday } from './home-tiles';

/**
 * ***Aksi hari ini*** (UI-100; P19.8-T2 AC-7; ADR-0228 §5; MOB UI-169; **P19.11-T1 AC-3, AC-4** — UX-2, UXQ6): **today's
 * alone, the office's day** — never a past or a future one — at most three, the server's pick and order (`GET /home`):
 *
 * - **Tasks first**, open and ticked, in the Calendar checklist's order, **each the Calendar's own `TaskRow`**: the
 *   checkbox that ticks it at its source (the page's `CalendarTasksContext`, `useTaskTicks`), the source icon, the name
 *   in bold over the note, the green WhatsApp button, the › that opens the lead. A ticked one is drawn completed and
 *   stays.
 * - **Then today's timed things not yet ended, each the Agenda's own `AgendaItem`**: the time range, the title and the
 *   type, a joined event's calendar icon, the 3px accent bar in its tone — the day's part of one running over several
 *   days (`segmentOn`). An entry opens the Calendar's detail over Home (`onOpenEntry`); a joined event its page.
 * - ***Semua ›*** opens the Agenda from today, where the days after are.
 * - **With nothing today the card stays**, with one line saying so (AC-4) — where it disappeared (D-08).
 *
 * *Changed 2026-11-10 (P19.11-T1): the rows were Home's own — a time box with a start and no end, a lead's avatar — and
 * the list filled up with the days after (10 and 11 November on the 9th).*
 */
export function HomeActions({
  actions, today, onOpenEntry, className,
}: {
  actions: readonly HomeAction[];
  today: string;
  /** An entry's row: the Calendar's detail, opened over Home by the screen. */
  onOpenEntry: (entryId: string) => void;
  className?: string;
}) {
  const t = useMessages(homeMessages).actions;
  const href = calendarToday(today);
  const tasks = actions.flatMap((action) => (action.kind === 'task' ? [action.task] : []));
  const timed = actions.filter((action): action is HomeEntryAction | HomeEventAction => action.kind !== 'task');
  return (
    <section data-home-actions="" aria-labelledby="home-actions" className={className}>
      <SectionHead id="home-actions" title={t.heading}>
        <Link
          href={href}
          aria-label={t.allLabel}
          className="-my-3 inline-flex min-h-11 items-center gap-0.5 text-md font-semibold text-muted hover:text-navy lg:min-h-8"
        >
          {t.all}
          <LineIcon name="chevronRight" className="h-4 w-4" />
        </Link>
      </SectionHead>
      <div className="overflow-hidden rounded-lg bg-card">
        {actions.length === 0 && <p data-actions-empty="" className="px-3.5 py-4 text-md text-muted">{t.empty}</p>}
        {tasks.length > 0 && (
          <ul aria-label={t.tasks} data-home-tasks="" className="divide-y divide-divider">
            {tasks.map((task) => <TaskRow key={task.taskId} task={task} mine />)}
          </ul>
        )}
        {timed.length > 0 && (
          <ul aria-label={t.events} data-home-timed="" className={cn('flex flex-col gap-1.5 p-2', tasks.length > 0 && 'border-t border-divider')}>
            {timed.map((action) => (
              <li key={action.kind === 'entry' ? `e:${action.entry.entryId}` : `v:${action.event.eventId}`}>
                <AgendaItem
                  line={action.kind === 'entry'
                    ? { kind: 'entry', item: segmentOn(action.entry, today) ?? action.entry, who: null }
                    : { kind: 'event', item: segmentOn(action.event, today) ?? action.event, who: null }}
                  date={today}
                  onOpen={(entry) => onOpenEntry(entry.entryId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
