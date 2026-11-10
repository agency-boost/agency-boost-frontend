import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { coachingTask, leadTask } from '@test/calendar-fixtures';
import { openCount, openTasks } from './calendar-tasks';
import { useTaskTicks } from './task-ticks';

afterEach(() => vi.unstubAllGlobals());

/**
 * **P19.11-T1 AC-1, AC-2 — one rule for done**: the server's `done`, with this visit's taps laid over it, and every count
 * the open tasks under that rule (`openTasks`). The Calendar and Home's *Aksi hari ini* both read it (`useTaskTicks`).
 */
describe('P19.11-T1 AC-1 AC-2 useTaskTicks: a tap over the server’s done', () => {
  const ticks = (over: Partial<Parameters<typeof useTaskTicks>[0]> = {}) => renderHook(() => useTaskTicks({
    canTick: true, canTickCoaching: true, show: vi.fn(), onChanged: vi.fn(), onLead: vi.fn(), ...over,
  }));
  const bodies = (stub: ReturnType<typeof stubFetch>) => stub.calls
    .filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(String(c.init.body)));

  it('P19.11-T1 AC-1 with no tap, done is the server’s: a loaded tick reads done, an open task open', () => {
    const { result } = ticks();
    expect(result.current.value.isDone(leadTask({ done: true }))).toBe(true);
    expect(result.current.value.isDone(coachingTask())).toBe(false);
  });

  it('P19.11-T1 AC-1 a tap ticks at the source, pinned to the loaded version; the next tap pins the version it answered', async () => {
    const stub = stubFetch({
      'PUT /leads/lead-wiwik/next-action/done': [{ body: { id: 'lead-wiwik', version: 4 } }, { body: { id: 'lead-wiwik', version: 5 } }],
    });
    const show = vi.fn();
    const { result } = ticks({ show });
    const wiwik = leadTask();
    act(() => result.current.value.toggle(wiwik));
    await waitFor(() => expect(result.current.value.isDone(wiwik)).toBe(true));
    expect(show).toHaveBeenCalledWith('Done', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    act(() => result.current.value.toggle(wiwik));
    await waitFor(() => expect(result.current.value.isDone(wiwik)).toBe(false));
    expect(bodies(stub)).toEqual([{ done: true, version: 3 }, { done: false, version: 4 }]);
  });

  it('P19.11-T1 AC-1 a read that caught up wins over the tap: the lead’s next version, or a coaching item’s done turned', async () => {
    stubFetch({
      'PUT /leads/lead-wiwik/next-action/done': { body: { id: 'lead-wiwik', version: 4 } },
      'PUT /coaching/sessions/sess-1/action-items/item-1/done': { body: { sessionId: 'sess-1', itemId: 'item-1', done: true } },
    });
    const { result } = ticks();
    act(() => result.current.value.toggle(leadTask()));
    act(() => result.current.value.toggle(coachingTask()));
    await waitFor(() => expect(result.current.value.isDone(coachingTask())).toBe(true));
    await waitFor(() => expect(result.current.value.isDone(leadTask())).toBe(true));
    // A refresh reads the tick back: the server's own state, whatever the tap said.
    expect(result.current.value.isDone(leadTask({ done: true, lead: { leadId: 'lead-wiwik', version: 4 } }))).toBe(true);
    // Unticked since on another device: version 5, open — the loaded task wins; the stale tap is not laid over it.
    expect(result.current.value.isDone(leadTask({ done: false, lead: { leadId: 'lead-wiwik', version: 5 } }))).toBe(false);
    expect(result.current.value.isDone(coachingTask({ done: true }))).toBe(true);
  });

  it('P19.11-T1 AC-1 a coaching item is never ticked in a support session, nor anything without the right', () => {
    const stub = stubFetch({});
    const { result } = ticks({ canTickCoaching: false });
    act(() => result.current.value.toggle(coachingTask()));
    const none = ticks({ canTick: false });
    act(() => none.result.current.value.toggle(leadTask()));
    expect(stub.calls).toHaveLength(0);
  });

  it('P19.11-T1 AC-2 a count is of open tasks: loaded ticks and taps alike, a hidden person’s day still a count', () => {
    const isDone = (task: { taskId: string; done: boolean }) => task.done || task.taskId === 'coaching:sess-1:item-1';
    const list = [coachingTask(), leadTask({ done: true }), leadTask({ taskId: 'lead:open' }), { busy: true as const, date: '2026-09-28' }];
    expect(openTasks(list, isDone).map((t) => ('taskId' in t ? t.taskId : 'busy'))).toEqual(['lead:open', 'busy']);
    expect(openCount(list, isDone)).toBe(2);
  });
});
