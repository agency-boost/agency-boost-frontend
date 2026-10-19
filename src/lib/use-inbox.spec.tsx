import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, makeSession, stubFetch } from '@test/harness';
import { SessionContext, type Me } from './session';
import { useCanMark, useInbox } from './use-inbox';

const item = (over: Record<string, unknown> = {}) => ({
  notificationId: 'n-1', templateId: 'join_request.approved', title: 'You are in', detail: null, href: null,
  kpmId: 'kpm-1', createdAt: '2026-09-01T00:00:00.000Z', readAt: null as string | null, ...over,
});
const failure = { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'r' } } };

/** The edges of the one hook the popover and the page share (P12.1-T3, T4); the screens' specs walk the rest. */
describe('useInbox', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends nothing to mark a row as it already is, and moves no count', async () => {
    const { mock } = stubFetch({ '/notifications': { body: { items: [item({ readAt: '2026-09-02T00:00:00.000Z' })], unread: 0, total: 1, page: 1, pageSize: 20 } } });
    const { result } = renderHook(() => useInbox(20));
    await act(() => result.current.load(1));

    let took = false;
    await act(async () => { took = await result.current.setRead(result.current.inbox!.items[0], true); });
    expect(took).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(result.current.inbox?.unread).toBe(0);
  });

  it('answers false for a mark the server refused, and puts the row and the count back', async () => {
    stubFetch({
      'POST /notifications/n-1/unread': failure,
      '/notifications': { body: { items: [item({ readAt: '2026-09-02T00:00:00.000Z' })], unread: 0, total: 1, page: 1, pageSize: 20 } },
    });
    const { result } = renderHook(() => useInbox(20));
    await act(() => result.current.load(1));

    let took = true;
    await act(async () => { took = await result.current.setRead(result.current.inbox!.items[0], false); });
    expect(took).toBe(false);
    expect(result.current.inbox?.items[0].readAt).toBe('2026-09-02T00:00:00.000Z');
    expect(result.current.inbox?.unread).toBe(0);
    expect(result.current.error?.message).toBe('Something broke.');
  });

  it('drops a failed read that a later one overtook, so its error never shows over the newer page', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let asked = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (++asked === 1) {
        await held;
        return { ok: false, status: 500, json: async () => failure.body } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ items: [item()], unread: 1, total: 1, page: 1, pageSize: 20 }) } as Response;
    }));
    const { result } = renderHook(() => useInbox(20));

    let first: Promise<void> | undefined;
    act(() => { first = result.current.load(1); });
    await act(() => result.current.load(1));
    await act(async () => { release?.(); await first; });

    expect(result.current.error).toBeNull();
    expect(result.current.inbox?.items).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it('marks all read before anything was read, without a page to change', async () => {
    const { calls } = stubFetch({
      'POST /notifications/read-all': { body: { unread: 0 } },
      '/notifications': { body: { items: [], unread: 0, total: 0, page: 1, pageSize: 20 } },
    });
    const { result } = renderHook(() => useInbox(20));
    await act(() => result.current.readAll());
    await waitFor(() => expect(result.current.inbox?.total).toBe(0));
    expect(calls.map((c) => c.init.method ?? 'GET')).toEqual(['POST', 'GET']);
  });

  it('marks all read at once, leaving a row already read with the time it was read', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const read = item({ notificationId: 'n-0', readAt: '2026-09-02T00:00:00.000Z' });
    stubFetch({
      'POST /notifications/read-all': { body: { unread: 0 } },
      '/notifications': { body: { items: [item(), read], unread: 1, total: 2, page: 1, pageSize: 20 } },
    });
    const { result } = renderHook(() => useInbox(20));
    await act(() => result.current.load(1));
    // Hold the re-read, to see what the click itself did.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (!url.includes('read-all')) await held;
      return { ok: true, status: 200, json: async () => (url.includes('read-all') ? { unread: 0 } : { items: [], unread: 0, total: 2, page: 1, pageSize: 20 }) } as Response;
    }));

    let done: Promise<void> | undefined;
    act(() => { done = result.current.readAll(); });
    expect(result.current.inbox?.unread).toBe(0);
    expect(result.current.inbox?.items[0].readAt).not.toBeNull();
    expect(result.current.inbox?.items[1].readAt).toBe('2026-09-02T00:00:00.000Z');
    await act(async () => { release?.(); await done; });
  });
});

/**
 * Whether the reader may mark at all (the Phase 12.1 exit review, N2): the bell's and the page's specs
 * walk the read-only session; these are the edges either side of it.
 */
describe('useCanMark', () => {
  const MARKS = ['notification:read_inbox', 'notification:mark_read'];
  const canMark = (me: Me | null) => renderHook(() => useCanMark(), {
    wrapper: ({ children }) => <SessionContext.Provider value={makeSession({ me })}>{children}</SessionContext.Provider>,
  }).result.current;
  const session = (impersonationReadOnly: boolean) =>
    makeMe({ isImpersonating: true, impersonationReadOnly, impersonatedBy: 'u-admin', permissions: MARKS });

  it('is true for a reader who holds notification:mark_read, and false for one who does not', () => {
    expect(canMark(makeMe({ permissions: MARKS }))).toBe(true);
    expect(canMark(makeMe({ permissions: ['notification:read_inbox'] }))).toBe(false);
  });

  it('is false in a read-only support session, whatever permissions it lists, and true in an elevated one', () => {
    expect(canMark(session(true))).toBe(false);
    expect(canMark(session(false))).toBe(true);
  });

  it('is false with nobody signed in, and outside a SessionProvider — AppShell’s spec mounts the bell bare', () => {
    expect(canMark(null)).toBe(false);
    expect(renderHook(() => useCanMark()).result.current).toBe(false);
  });
});
