import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { setAccessToken, setImpersonating, toDisplayError } from './api-client';
import { openViewAsWindow, VIEW_AS_PATH, ViewAsBlocked, viewAsUrl } from './view-as';

/** A window as `window.open` hands one back: an address to set, a document to name, an opener to cut, a close. */
function fakeWindow() {
  return { opener: {} as unknown, location: { href: '' }, document: { title: '' }, close: vi.fn() };
}

/**
 * **P19.23-T2 AC-7 — *Buka jendela baru*** (ADR-0277): the window opened first, inside the click; the session started for
 * a window (no token); the window sent to its one-time address; closed again when the start is refused.
 */
describe('P19.23-T2 AC-7 openViewAsWindow', () => {
  beforeEach(() => {
    setAccessToken('superadmin-token');
    setImpersonating(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.23-T2 AC-7 opens the window before anything is asked, then sends it to the code in its fragment', async () => {
    const opened = fakeWindow();
    const open = vi.fn(() => opened);
    vi.stubGlobal('open', open);
    const { calls } = stubFetch({
      'POST /admin/impersonate/u-agent': { status: 201, body: {
        handoffCode: 'code_123-abcdefghijklmnopqrstuv', handoffExpiresAt: '2026-11-20T03:01:00.000Z',
        expiresAt: '2026-11-20T04:00:00.000Z', sessionId: 's-1', readOnly: true,
      } },
    });

    const pending = openViewAsWindow({ userId: 'u-agent', fullName: 'RINA WIJAYA' }, 'Lihat sebagai Agent');
    // Synchronously, inside the gesture: the window is open before the request has gone anywhere.
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(opened.opener).toBeNull();
    expect(opened.document.title).toBe('RINA WIJAYA');
    await pending;

    expect(JSON.parse(String(calls[0].init.body))).toEqual({ reason: 'Lihat sebagai Agent', handoff: true });
    expect(opened.location.href).toBe(`${window.location.origin}${VIEW_AS_PATH}#code_123-abcdefghijklmnopqrstuv`);
    expect(opened.close).not.toHaveBeenCalled();
  });

  it('P19.23-T2 AC-7 a blocked window is ViewAsBlocked, and no session is started', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    const { calls } = stubFetch({});
    await expect(openViewAsWindow({ userId: 'u-agent', fullName: 'RINA' }, 'r')).rejects.toBeInstanceOf(ViewAsBlocked);
    await expect(openViewAsWindow({ userId: 'u-agent', fullName: 'RINA' }, 'r')).rejects.toMatchObject({
      code: 'VIEW_AS_BLOCKED',
    });
    expect(calls).toHaveLength(0);
  });

  it('P19.23-T2 AC-7 a refused start closes the window and rethrows the refusal as it came', async () => {
    const opened = fakeWindow();
    vi.stubGlobal('open', vi.fn(() => opened));
    stubFetch({
      'POST /admin/impersonate/u-agent': { status: 409, body: { error: {
        code: 'IMPERSONATION_OFFICE_UNAVAILABLE', message: 'KPM 0999 · Suspended Branch is suspended.', requestId: 'r-1',
      } } },
    });
    const refused = await openViewAsWindow({ userId: 'u-agent', fullName: 'RINA' }, 'r').catch((err: unknown) => err);
    // As the card shows it: through `toDisplayError`, the server's code and words.
    expect(toDisplayError(refused)).toMatchObject({
      code: 'IMPERSONATION_OFFICE_UNAVAILABLE', message: 'KPM 0999 · Suspended Branch is suspended.',
    });
    expect(opened.close).toHaveBeenCalled();
    expect(opened.location.href).toBe('');
  });

  it('P19.23-T2 AC-7 the address carries the code in its fragment, never its query', () => {
    expect(viewAsUrl('a_b-c')).toBe('/view-as#a_b-c');
  });
});
