import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, makeSession, stubFetch } from '@test/harness';
import { SessionContext } from '@/lib/session';
import { announceInboxChanged } from './notifications';
import { useUnreadCount } from './use-unread-count';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionContext.Provider value={makeSession({ me: makeMe() })}>{children}</SessionContext.Provider>
);

describe('useUnreadCount', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the count once when it mounts, and again whenever a screen says the inbox changed', async () => {
    const { mock } = stubFetch({
      '/notifications': [{ body: { items: [], unread: 2 } }, { body: { items: [], unread: 1 } }],
    });
    const { result } = renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(2));
    expect(mock).toHaveBeenCalledTimes(1);

    act(() => announceInboxChanged());
    await waitFor(() => expect(result.current).toBe(1));
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('P12.1-T2 AC-6 takes the count a change carries, from the write’s answer, without asking again', async () => {
    const { mock, calls } = stubFetch({ '/notifications': { body: { items: [], unread: 5, total: 5, page: 1, pageSize: 1 } } });
    const { result } = renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(5));
    // A page of one: the count comes with any page, and the items are not wanted here.
    expect(calls[0].url).toBe('http://api.test/api/v1/notifications?page=1&pageSize=1');

    act(() => announceInboxChanged({ unread: 4, origin: 'the-popover' }));
    expect(result.current).toBe(4);
    act(() => announceInboxChanged({ unread: 0 }));
    expect(result.current).toBe(0);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('P18.95-T1 AC-7 moves by a change’s delta at once, never below zero, without asking again', async () => {
    const { mock } = stubFetch({ '/notifications': { body: { items: [], unread: 2, total: 2, page: 1, pageSize: 1 } } });
    const { result } = renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(2));

    act(() => announceInboxChanged({ delta: -1, local: true }));
    expect(result.current).toBe(1);
    act(() => announceInboxChanged({ delta: 1, local: true }));
    expect(result.current).toBe(2);
    act(() => announceInboxChanged({ delta: -5, local: true }));
    expect(result.current).toBe(0);
    // A count beats a delta: the answer settles whatever the moves added up to.
    act(() => announceInboxChanged({ unread: 7, delta: -1 }));
    expect(result.current).toBe(7);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('shows nothing rather than an error when the count cannot be read', async () => {
    stubFetch({ '/notifications': [{ body: { items: [], unread: 2 } }, { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } } }] });
    const { result } = renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(2));
    act(() => announceInboxChanged());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('stops listening once it unmounts', async () => {
    const { mock } = stubFetch({ '/notifications': { body: { items: [], unread: 3 } } });
    const { result, unmount } = renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(3));
    unmount();
    act(() => announceInboxChanged());
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
