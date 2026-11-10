import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfficeMinute } from './use-office-minute';

/**
 * **P19.11-T1 AC-5 — the office's minute, moved on, and the read again at its midnight**: the Calendar's now-line and
 * rollover, and Home's *Aksi hari ini*. The browser's clock only counts the minutes since the read.
 */
describe('P19.11-T1 AC-5 useOfficeMinute', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-30T16:58:00Z') }));
  afterEach(() => vi.useRealTimers());

  it('P19.11-T1 AC-5 moves on from the read’s minute, and past the office’s midnight asks for a read once', () => {
    const onMidnight = vi.fn();
    const { result } = renderHook(() => useOfficeMinute({ minute: 23 * 60 + 58, at: '2026-10-30T16:58:00.000Z' }, onMidnight));
    expect(result.current).toBe(23 * 60 + 58);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current).toBe(23 * 60 + 59);
    expect(onMidnight).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(60_000); });
    // Held at the day's last minute until the new read says what today is.
    expect(result.current).toBe(24 * 60 - 1);
    expect(onMidnight).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(onMidnight).toHaveBeenCalledTimes(1);
  });

  it('P19.11-T1 AC-5 a new read starts the count again from its own minute', () => {
    const onMidnight = vi.fn();
    const { result, rerender } = renderHook(({ now }) => useOfficeMinute(now, onMidnight), {
      initialProps: { now: { minute: 23 * 60 + 59, at: '2026-10-30T16:59:00.000Z' } },
    });
    act(() => { vi.advanceTimersByTime(75_000); });
    expect(onMidnight).toHaveBeenCalledTimes(1);
    rerender({ now: { minute: 0, at: '2026-10-30T17:00:15.000Z' } });
    expect(result.current).toBe(0);
  });

  it('P19.11-T1 AC-5 without a read, no minute and no timer; without an instant, the minute stands still', () => {
    const onMidnight = vi.fn();
    expect(renderHook(() => useOfficeMinute(undefined, onMidnight)).result.current).toBeNull();
    const still = renderHook(() => useOfficeMinute({ minute: 600 }, onMidnight));
    act(() => { vi.advanceTimersByTime(600_000); });
    expect(still.result.current).toBe(600);
    expect(onMidnight).not.toHaveBeenCalled();
  });
});
