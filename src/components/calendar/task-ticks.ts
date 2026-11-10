'use client';

import { useMemo, useRef, useState } from 'react';
import type { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { setCoachingItemDone, setLeadActionDone, type CalendarTask } from '@/lib/calendar';
import { readLead, type Lead } from '@/lib/leads';
import type { CalendarTasks } from './calendar-tasks';

/**
 * **A tap laid over what the server said** (P19.11-T1 AC-1, AC-2): the task's new state, the lead's version the write
 * answered (the next write pins it), and **what the task read as when the tap was made** (`base`). The override holds
 * only while the loaded task still reads that way: once a read brings the server's newer state — a lead's next version,
 * a coaching item's `done` turned — the loaded task wins, so a stale tap never outlives the data that caught up with it.
 */
interface Override {
  done: boolean;
  version: number | undefined;
  base: string;
}

/** What a task read as: a lead's by its version (every write moves it), a coaching item's by its `done`. */
const baseOf = (task: CalendarTask) => (task.lead ? `v${task.lead.version}` : `d${task.done ? 1 : 0}`);

/**
 * **Ticking a task, at its source** (UI V1, UI-104 point 4; P19.11-T1 AC-1 to AC-3): a lead's next action (`PUT
 * /leads/:id/next-action/done`, pinned to the version the task carried) or a coaching action item (`PUT
 * /coaching/sessions/…/done`). One hook for the Calendar and Home's *Aksi hari ini*, so both tick alike.
 *
 * - **Done is the server's `task.done`, with this visit's taps laid over it** (`Override`): a ticked row is drawn
 *   completed, and every count drops, the moment the write lands — and a refresh reads it back done, since the server
 *   keeps it on its date. *Changed 2026-11-10: the taps lived in a set of their own, which a refresh lost (UX-1).*
 * - Ticked, the toast says *Selesai* and offers *Urungkan*, which — or the checkbox again — takes the tick back.
 * - One write per task at a time; a refusal is said above the list (`error`) and the row is left as it was.
 */
export function useTaskTicks({
  canTick, canTickCoaching, show, onChanged, onLead,
}: {
  canTick: boolean;
  canTickCoaching: boolean;
  show: ReturnType<typeof useToast>['show'];
  /** After a number is saved from a row: the page reads again. */
  onChanged: () => void;
  /** A lead row's ›: the lead, read, for the page's lead sheet. */
  onLead: (lead: Lead) => void;
}): { value: CalendarTasks; error: ApiError | null } {
  const t = useMessages(calendarMessages);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, Override>>(new Map());
  const [error, setError] = useState<ApiError | null>(null);
  const busy = useRef(new Set<string>());

  const value = useMemo<CalendarTasks>(() => {
    const live = (task: CalendarTask): Override | undefined => {
      const held = overrides.get(task.taskId);
      return held && held.base === baseOf(task) ? held : undefined;
    };
    const isDone = (task: CalendarTask) => live(task)?.done ?? task.done;
    const versionOf = (task: CalendarTask) => live(task)?.version ?? task.lead?.version;

    const write = async (task: CalendarTask, done: boolean, version: number | undefined): Promise<number | undefined> => {
      if (task.source === 'lead' && task.lead) {
        return (await setLeadActionDone(task.lead.leadId, done, version ?? task.lead.version)).version;
      }
      if (task.coaching) await setCoachingItemDone(task.coaching.sessionId, task.coaching.itemId, done);
      return undefined;
    };
    /** One write, and the tap laid over the task as it read when the tap was made. */
    const apply = async (task: CalendarTask, done: boolean, version: number | undefined, base: string) => {
      const next = await write(task, done, version);
      setOverrides((now) => new Map(now).set(task.taskId, { done, version: next, base }));
      return next;
    };
    const fail = (err: unknown) => setError(toDisplayError(err));

    const toggle = (task: CalendarTask) => {
      if (!canTick || (task.source === 'coaching' && !canTickCoaching) || busy.current.has(task.taskId)) return;
      busy.current.add(task.taskId);
      setError(null);
      const done = !isDone(task);
      const base = baseOf(task);
      apply(task, done, versionOf(task), base)
        .then((version) => {
          if (!done) return;
          show(t.done, {
            action: { label: t.undo, onAction: () => { apply(task, false, version, base).catch(fail); } },
          });
        })
        .catch(fail)
        .finally(() => { busy.current.delete(task.taskId); });
    };
    return {
      isDone,
      toggle,
      openLead: (task) => {
        if (!task.lead) return;
        readLead(task.lead.leadId).then(onLead).catch(fail);
      },
      canTick,
      canTickCoaching,
      onPhoneSaved: onChanged,
    };
  }, [canTick, canTickCoaching, overrides, show, onChanged, onLead, t]);

  return { value, error };
}
