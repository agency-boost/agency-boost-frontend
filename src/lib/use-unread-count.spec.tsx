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

  it('stops listening once it unmounts', async () => {
    const { mock } = stubFetch({ '/notifications': { body: { items: [], unread: 3 } } });
    const { result, unmount } = renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(3));
    unmount();
    act(() => announceInboxChanged());
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
