import { render as renderDom, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { setAccessToken } from '@/lib/api-client';
import { RequireSession } from './require-session';
import { SessionList, describeDevice } from './session-list';
import { SessionProvider } from './session-provider';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/profile',
}));

const session = (over: Record<string, unknown> = {}) => ({
  sessionId: 's1',
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit Chrome/120 Mobile Safari',
  ip: '103.10.1.2',
  lastUsedAt: '2026-09-10T08:00:00.000Z',
  startedAt: '2026-09-01T08:00:00.000Z',
  expiresAt: '2026-10-01T08:00:00.000Z',
  current: false,
  ...over,
});

function render(body: unknown = [session({ current: true }), session({ sessionId: 's2' })]) {
  const stub = stubFetch({
    '/auth/sessions': { body },
    '/auth/logout-all': { status: 204, body: null },
  });
  return { ...stub, ...renderWithSession(<SessionList />, { me: makeMe() }) };
}

describe('where you are signed in (P4-T13)', () => {
  afterEach(() => { vi.unstubAllGlobals(); replace.mockClear(); });

  describe('naming a device', () => {
    it('says something a person would recognise', () => {
      // The question is "is that my phone?", not an inventory. A full user-agent string
      // makes somebody close the page rather than act on it.
      expect(describeDevice('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari'))
        .toBe('Chrome on Android');
      expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605'))
        .toBe('Safari on Mac');
    });

    it('says unknown rather than guessing', () => {
      // A wrong guess is worse than none when the question is whether to sign a device out.
      expect(describeDevice(null)).toBe('Unknown device');
      expect(describeDevice('curl/8.4.0')).toBe('Unknown device');
    });
  });

  it('marks the device the reader is on', async () => {
    render();
    expect(await screen.findByText('This device')).toBeInTheDocument();
  });

  it('P18.95-T7 AC-5 says what Sign out everywhere is for in the client’s words: Use this if you lose your phone.', async () => {
    render();
    await screen.findByText('This device');
    const line = screen.getByText(/^Ends every session including this one\./);
    expect(line).toHaveTextContent(/^Ends every session including this one\. Use this if you lose your phone\.$/);
    expect(line.className).not.toMatch(/hidden/);
    expect(screen.queryByText(/a device was lost/)).not.toBeInTheDocument();
  });

  it('offers no way to revoke the seat you are sitting in', async () => {
    /*
     * It would work, and it would read as a bug: the page reloads into a login screen
     * with nothing having said it would. *Sign out* in the header already does that, and
     * says so.
     */
    render();
    await screen.findByText('This device');
    expect(screen.getAllByRole('button', { name: 'Sign this one out' })).toHaveLength(1);
  });

  it('revokes one device and re-reads the list', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign this one out' }));

    const call = calls.find((c) => c.init.method === 'DELETE')!;
    expect(call.url).toContain('/auth/sessions/s2');
  });

  it('sends somebody to sign in after signing out everywhere, ending this tab’s session as Sign out does', async () => {
    // Every session is gone, this one included — there is nothing to reload into.
    const { calls, session: value } = render();
    await screen.findByText('This device');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out everywhere' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(calls.some((c) => c.url.includes('/auth/logout-all') && c.init.method === 'POST')).toBe(true);
    // Through the session, so it is marked as the reader's own doing (2026-10-11).
    expect(value.signOut).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls).toEqual([['/login']]);
  });

  it('leaves the session alone when signing out everywhere is refused', async () => {
    stubFetch({
      '/auth/sessions': { body: [session({ current: true })] },
      '/auth/logout-all': {
        status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'r-2' } },
      },
    });
    const { session: value } = renderWithSession(<SessionList />, { me: makeMe() });
    await screen.findByText('This device');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out everywhere' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke.');
    expect(value.signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  /*
   * **The product owner's report, 2026-10-11**, end to end: the account screen sits behind `RequireSession`, so
   * ending the session there wakes its guard too. Whatever order the two navigations land in, neither carries
   * the page as `next` to whoever signs in next on the device.
   */
  it('signing out everywhere from behind the account screen’s guard lands on plain /login, with no next', async () => {
    window.history.pushState({}, '', '/profile');
    try {
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { body: makeMe({ permissions: ['profile:read_self'] }) },
        '/auth/sessions': { body: [session({ current: true })] },
        '/auth/logout-all': { status: 204, body: null },
        '/auth/logout': { status: 204, body: undefined },
      });
      renderDom(
        <SessionProvider>
          <RequireSession permission="profile:read_self"><SessionList /></RequireSession>
        </SessionProvider>,
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));

      await waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
      expect(replace.mock.calls).toEqual([['/login'], ['/login']]);
    } finally {
      setAccessToken(null);
      window.history.pushState({}, '', '/');
    }
  });

  it('says what signing out everywhere does before it is pressed', async () => {
    render();
    expect(await screen.findByText(/Ends every session including this one/))
      .toBeInTheDocument();
  });

  it('surfaces a refusal rather than appearing to succeed', async () => {
    stubFetch({
      '/auth/sessions': {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'r-1' } },
      },
    });
    renderWithSession(<SessionList />, { me: makeMe() });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
