import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { useEffect, useState } from 'react';
import { api, getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { RequireSession } from './require-session';
import { SessionProvider } from './session-provider';

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/kpm/analytics/compliance',
}));

function Probe() {
  const { me, loading, signIn, signOut } = useSession();
  return (
    <div>
      <p data-testid="state">{loading ? 'loading' : (me?.user.email ?? 'anonymous')}</p>
      <button onClick={() => void signIn('rina@kpm0417.test', 'pw')}>sign in</button>
      <button onClick={() => void signOut()}>sign out</button>
    </div>
  );
}

const ME = {
  user: { id: 'u-1', email: 'rina@kpm0417.test', fullName: 'Rina', initials: 'R', platformRole: 'none' },
  membership: null,
  isImpersonating: false,
  impersonatedBy: null,
  permissions: [],
};

describe('SessionProvider', () => {
  beforeEach(() => {
    setAccessToken(null);
    setImpersonating(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('restores a session from the httpOnly cookie on mount', async () => {
    // Nothing is read from storage — the refresh cookie the browser holds is the only
    // thing that survives a reload, and it is unreachable from script.
    stubFetch({
      '/auth/refresh': { body: { accessToken: 'fresh' } },
      '/auth/me': { body: ME },
    });

    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('rina@kpm0417.test'));
    expect(getAccessToken()).toBe('fresh');
  });

  it('settles as anonymous when there is no cookie, rather than hanging on loading', async () => {
    stubFetch({ '/auth/refresh': { status: 401, body: {} } });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
  });

  it('signs in and loads the resolved permissions', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { status: 401, body: {} },
      '/auth/login': { body: { accessToken: 'tok' } },
      '/auth/me': { body: ME },
    });

    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    await userEvent.click(screen.getByRole('button', { name: 'sign in' }));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('rina@kpm0417.test'));
    const login = calls.find((c) => c.url.includes('/auth/login'))!;
    expect(JSON.parse(login.init.body as string)).toEqual({
      email: 'rina@kpm0417.test',
      password: 'pw',
    });
    // The refresh token is never in the response body — it is a cookie, so there is
    // nothing here for the client to store.
    expect(login.init.body as string).not.toContain('refreshToken');
  });

  it('drops the token locally even if the logout call fails', async () => {
    stubFetch({
      '/auth/refresh': { body: { accessToken: 'fresh' } },
      '/auth/me': { body: ME },
      '/auth/logout': { status: 500, body: {} },
    });

    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('rina@kpm0417.test'));
    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(getAccessToken()).toBeNull();
  });

  /*
   * **An office its member cannot use** (P13.2-T3 AC-9, ADR-0112 §4): a 403 with one of three codes, on
   * `/auth/me` or on any request after it, replaces the whole app with a page naming the office and what
   * happened. It used to be swallowed, and the reader was sent back to sign in.
   */
  describe('an office the reader cannot use (P13.2-T3 AC-9)', () => {
    const OFFICE = { kpmCode: '0601', branch: 'Cikarang Branch' };
    const REFUSALS = [
      {
        code: 'TENANT_SUBSCRIPTION_ENDED',
        message: 'This office’s subscription ended on 2026-09-25.',
        details: { endDate: '2026-09-25', ...OFFICE },
        heading: 'Your office’s subscription has ended',
        says: /ended on September 25, 2026.*Contact AgencyBoost/,
      },
      {
        code: 'TENANT_SUSPENDED',
        message: 'This office is suspended, so nobody in it can use AgencyBoost until it is reactivated.',
        details: OFFICE,
        heading: 'Your office is suspended',
        says: /until it is reactivated/,
      },
      {
        code: 'TENANT_ARCHIVED',
        message: 'This office is archived. Its records are kept, and nobody in it can use AgencyBoost.',
        details: OFFICE,
        heading: 'Your office is archived',
        says: /Its records are kept/,
      },
    ];

    /** A screen that reads something once it has a session — the "later request". */
    function Screen() {
      const { me } = useSession();
      const [read, setRead] = useState('');
      useEffect(() => {
        if (me) void api<{ ok: boolean }>('/kpm/config').then(() => setRead('read')).catch(() => setRead('refused'));
      }, [me]);
      return <p data-testid="screen">{me ? `signed in ${read}` : 'anonymous'}</p>;
    }

    it.each(REFUSALS)('$code on /auth/me replaces the app, naming the office, with Sign out and no navigation', async (refusal) => {
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { status: 403, body: { error: { ...refusal, requestId: 'r-1' } } },
      });
      render(<SessionProvider><Screen /></SessionProvider>);

      const heading = await screen.findByRole('heading', { level: 1, name: refusal.heading });
      await waitFor(() => expect(heading).toHaveFocus());
      expect(screen.getByText('KPM 0601 · Cikarang Branch')).toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent(refusal.says);
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(screen.queryByTestId('screen')).not.toBeInTheDocument();
      // No code reaches the words.
      expect(screen.getByRole('main')).not.toHaveTextContent(refusal.code);
    });

    it.each(REFUSALS)('$code on a later request replaces the app the same way', async (refusal) => {
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { body: ME },
        '/kpm/config': { status: 403, body: { error: { ...refusal, requestId: 'r-2' } } },
      });
      render(<SessionProvider><Screen /></SessionProvider>);

      expect(await screen.findByRole('heading', { level: 1, name: refusal.heading })).toBeInTheDocument();
      expect(screen.queryByTestId('screen')).not.toBeInTheDocument();
    });

    it('Sign out ends the session and gives the app back, signed out', async () => {
      const { calls } = stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { status: 403, body: { error: { ...REFUSALS[0], requestId: 'r-3' } } },
        '/auth/logout': { status: 204, body: undefined },
      });
      render(<SessionProvider><Screen /></SessionProvider>);
      await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

      await waitFor(() => expect(screen.getByTestId('screen')).toHaveTextContent('anonymous'));
      expect(calls.some((c) => c.url.includes('/auth/logout'))).toBe(true);
      expect(getAccessToken()).toBeNull();
    });

    /*
     * **Never the Super Admin's console, and a support session ends from the page** (P13.2 exit review).
     * The page is a member's. A Super Admin outside a session is nobody's member, so one of the three
     * codes on their request is that screen's error. Inside a session the page appears with *End support
     * session*, which ends the session, resets the impersonation and gives the Super Admin back — where
     * *Sign out* revoked the Super Admin's own sign-in and left the session running.
     */
    const ROOT = {
      ...ME,
      user: { id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', initials: 'R', platformRole: 'super_admin' },
    };

    it.each(REFUSALS)('$code on a Super Admin’s own request is that screen’s error: the console stays', async (refusal) => {
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { body: ROOT },
        '/kpm/config': { status: 403, body: { error: { ...refusal, requestId: 'r-5' } } },
      });
      render(<SessionProvider><Screen /></SessionProvider>);
      await waitFor(() => expect(screen.getByTestId('screen')).toHaveTextContent('signed in refused'));
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });

    it('inside a support session the page offers End support session, which ends it and restores the Super Admin', async () => {
      setImpersonating(true);
      const { calls } = stubFetch({
        '/auth/refresh': { body: { accessToken: 'root-token' } },
        '/auth/me': [
          { status: 403, body: { error: { ...REFUSALS[1], requestId: 'r-6' } } },
          { body: ROOT },
        ],
        '/admin/impersonate/end': { body: { status: 'ended' } },
      });
      render(<SessionProvider><Screen /></SessionProvider>);

      expect(await screen.findByRole('heading', { level: 1, name: 'This office is suspended' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'End support session' }));

      await waitFor(() => expect(screen.getByTestId('screen')).toHaveTextContent('signed in'));
      expect(calls.some((c) => c.url.includes('/admin/impersonate/end') && c.init.method === 'POST')).toBe(true);
      // Never the Super Admin's own sign-out.
      expect(calls.some((c) => c.url.includes('/auth/logout'))).toBe(false);
      expect(isImpersonating()).toBe(false);
      expect(getAccessToken()).toBe('root-token');
    });

    it('a support session the end call cannot reach is still left: the Super Admin is given back', async () => {
      setImpersonating(true);
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'root-token' } },
        '/auth/me': [
          { status: 403, body: { error: { ...REFUSALS[2], requestId: 'r-7' } } },
          { body: ROOT },
        ],
        '/admin/impersonate/end': { status: 500, body: {} },
      });
      render(<SessionProvider><Screen /></SessionProvider>);
      await userEvent.click(await screen.findByRole('button', { name: 'End support session' }));
      await waitFor(() => expect(screen.getByTestId('screen')).toHaveTextContent('signed in'));
      expect(isImpersonating()).toBe(false);
    });

    it('ADR-0168 §1: a support session ended after the Super Admin’s own session ended is a session that ended', async () => {
      setImpersonating(true);
      stubFetch({
        '/auth/refresh': [
          { body: { accessToken: 'imp-start' } },
          { status: 401, body: { error: { code: 'AUTH_SESSION_ENDED', message: 'Your session ended.', requestId: 'r' } } },
        ],
        '/auth/me': { status: 403, body: { error: { ...REFUSALS[1], requestId: 'r-9' } } },
        '/admin/impersonate/end': { body: { status: 'ended' } },
      });
      function Ended() {
        const { me, expired } = useSession();
        return <p data-testid="ended">{`${me ? 'in' : 'out'}, ${expired ? 'expired' : 'not expired'}`}</p>;
      }
      render(<SessionProvider><Ended /></SessionProvider>);
      await userEvent.click(await screen.findByRole('button', { name: 'End support session' }));
      await waitFor(() => expect(screen.getByTestId('ended')).toHaveTextContent('out, expired'));
      expect(isImpersonating()).toBe(false);
    });

    it('any other 403 is the screen’s own business: the app stays', async () => {
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { body: ME },
        '/kpm/config': { status: 403, body: { error: { code: 'PERM_DENIED', message: 'No.', requestId: 'r-4' } } },
      });
      render(<SessionProvider><Screen /></SessionProvider>);
      await waitFor(() => expect(screen.getByTestId('screen')).toHaveTextContent('signed in refused'));
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });
  });

  /*
   * **A deliberate sign-out** (the product owner's report, 2026-10-11): `signedOut` is what tells a page's guard
   * not to carry the page to the next person who signs in. Only `signOut` sets it; signing in clears it.
   */
  describe('a deliberate sign-out (2026-10-11)', () => {
    function Flag() {
      const { me, loading, signedOut, signIn, signOut } = useSession();
      const [who, setWho] = useState('');
      return (
        <div>
          <p data-testid="flag">{loading ? 'loading' : `${me ? 'in' : 'out'}, ${signedOut ? 'signed out' : 'not signed out'}`}</p>
          <p data-testid="who">{who}</p>
          <button onClick={() => void signIn('rina@kpm0417.test', 'pw').then((m) => setWho(m?.user.email ?? 'nobody'))}>
            sign in
          </button>
          <button onClick={() => void signOut()}>sign out</button>
        </div>
      );
    }

    afterEach(() => window.history.pushState({}, '', '/'));

    it('is marked by Sign out, and cleared by signing in again, which resolves to who signed in', async () => {
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { body: ME },
        '/auth/logout': { status: 204, body: undefined },
        '/auth/login': { body: { accessToken: 'tok' } },
      });
      render(<SessionProvider><Flag /></SessionProvider>);
      await waitFor(() => expect(screen.getByTestId('flag')).toHaveTextContent('in, not signed out'));

      await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
      await waitFor(() => expect(screen.getByTestId('flag')).toHaveTextContent('out, signed out'));

      await userEvent.click(screen.getByRole('button', { name: 'sign in' }));
      await waitFor(() => expect(screen.getByTestId('flag')).toHaveTextContent('in, not signed out'));
      expect(screen.getByTestId('who')).toHaveTextContent('rina@kpm0417.test');
    });

    it('is not marked by a session that was never there or could not be read: those still carry the page', async () => {
      stubFetch({
        '/auth/refresh': { status: 401, body: {} },
        '/auth/login': { body: { accessToken: 'tok' } },
        '/auth/me': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'No.', requestId: 'r' } } },
      });
      render(<SessionProvider><Flag /></SessionProvider>);
      await waitFor(() => expect(screen.getByTestId('flag')).toHaveTextContent('out, not signed out'));

      // Signed in, but the session could not be read: `signIn` resolves to nobody, and nobody signed out.
      await userEvent.click(screen.getByRole('button', { name: 'sign in' }));
      await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('nobody'));
      expect(screen.getByTestId('flag')).toHaveTextContent('out, not signed out');
    });

    it('Sign out on the page for an office that cannot be used sends the page’s guard to plain /login', async () => {
      window.history.pushState({}, '', '/kpm/analytics/compliance');
      stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': {
          status: 403,
          body: { error: { code: 'TENANT_SUSPENDED', message: 'This office is suspended.', requestId: 'r-8' } },
        },
        '/auth/logout': { status: 204, body: undefined },
      });
      replace.mockClear();
      render(<SessionProvider><RequireSession permission="kpm_analytics:read">secret</RequireSession></SessionProvider>);

      await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([['/login']]);
    });
  });

  /*
   * ADR-0168 §1 (OD-208; the client's UI review, UI-006): **a session that ends under the reader says so.** A request
   * answered `401` whose refresh the server refuses ends the session this tab had, and the page's guard sends the
   * reader to sign in with `reason=expired`. A reader who arrives with no session keeps the plain return path.
   */
  describe('a session that ends under the reader (ADR-0168 §1)', () => {
    const PAGE = '/kpm/analytics/compliance';
    const EXPIRED = `/login?next=${encodeURIComponent(PAGE)}&reason=expired`;

    /** A screen that reads something when asked, and says what came back. */
    function Screen() {
      const [said, setSaid] = useState('');
      return (
        <div>
          <button onClick={() => void api('/widgets').then(() => setSaid('read')).catch(() => setSaid('refused'))}>
            read
          </button>
          <p data-testid="said">{said}</p>
        </div>
      );
    }

    function Flags() {
      const { me, loading, signedOut, expired } = useSession();
      return (
        <p data-testid="flags">
          {loading ? 'loading' : `${me ? 'in' : 'out'}, ${signedOut ? 'signed out' : 'not signed out'}, ${expired ? 'expired' : 'not expired'}`}
        </p>
      );
    }

    beforeEach(() => {
      window.history.pushState({}, '', PAGE);
      replace.mockClear();
    });
    afterEach(() => window.history.pushState({}, '', '/'));

    it('a read whose refresh the server refuses ends the session, and the guard sends the reader to the expired path', async () => {
      stubFetch({
        // Signed in on load; the second refresh, mid-use, is refused: the cookie expired or was revoked.
        '/auth/refresh': [{ body: { accessToken: 'fresh' } }, { status: 401, body: {} }],
        '/auth/me': { body: ME },
        '/widgets': { status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Expired.', requestId: 'r' } } },
      });
      render(<SessionProvider><Flags /><RequireSession><Screen /></RequireSession></SessionProvider>);
      await userEvent.click(await screen.findByRole('button', { name: 'read' }));

      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([[EXPIRED]]);
      expect(screen.getByTestId('flags')).toHaveTextContent('out, not signed out, expired');
      expect(getAccessToken()).toBeNull();
    });

    /*
     * The client's own case (UI-006): the app closed, opened again later, and the first refresh finds the cookie
     * the session left — expired, revoked or spent. The server says `AUTH_SESSION_ENDED`, and the reader is told.
     */
    it('a reload whose refresh cookie no longer works is a session that ended: the expired path', async () => {
      stubFetch({
        '/auth/refresh': {
          status: 401,
          body: { error: { code: 'AUTH_SESSION_ENDED', message: 'Your session ended. Sign in again.', requestId: 'r' } },
        },
      });
      render(<SessionProvider><Flags /><RequireSession>secret</RequireSession></SessionProvider>);

      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([[EXPIRED]]);
      expect(screen.getByTestId('flags')).toHaveTextContent('out, not signed out, expired');
    });

    it('a fresh visit with no cookie at all is somebody arriving signed out: the plain return path', async () => {
      stubFetch({
        '/auth/refresh': {
          status: 401,
          body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'No session to refresh. Sign in again.', requestId: 'r' } },
        },
      });
      render(<SessionProvider><Flags /><RequireSession>secret</RequireSession></SessionProvider>);

      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([[`/login?next=${encodeURIComponent(PAGE)}`]]);
      expect(screen.getByTestId('flags')).toHaveTextContent('out, not signed out, not expired');
    });

    it('after a deliberate sign-out, the next load finds no cookie — sign-out cleared it — and is not told it ended', async () => {
      stubFetch({
        '/auth/refresh': [
          { body: { accessToken: 'fresh' } },
          // What the browser sends once the sign-out's clear has landed: no cookie, so no session to refresh.
          { status: 401, body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'No session to refresh.', requestId: 'r' } } },
        ],
        '/auth/me': { body: ME },
        '/auth/logout': { status: 204, body: undefined },
      });
      const first = render(<SessionProvider><Flags /><Probe /><RequireSession>secret</RequireSession></SessionProvider>);
      await waitFor(() => expect(screen.getByTestId('flags')).toHaveTextContent('in, not signed out, not expired'));
      await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([['/login']]);

      // The app opened again, on the page.
      first.unmount();
      replace.mockClear();
      render(<SessionProvider><Flags /><RequireSession>secret</RequireSession></SessionProvider>);
      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([[`/login?next=${encodeURIComponent(PAGE)}`]]);
      expect(screen.getByTestId('flags')).toHaveTextContent('out, not signed out, not expired');
    });

    it('a fresh visit with no session to end keeps the plain return path, and is not marked expired', async () => {
      stubFetch({ '/auth/refresh': { status: 401, body: {} } });
      render(<SessionProvider><Flags /><RequireSession>secret</RequireSession></SessionProvider>);

      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([[`/login?next=${encodeURIComponent(PAGE)}`]]);
      expect(screen.getByTestId('flags')).toHaveTextContent('out, not signed out, not expired');
    });

    it('a refresh answered with something that is not about the session ends nothing: the screen shows its error', async () => {
      stubFetch({
        '/auth/refresh': [{ body: { accessToken: 'fresh' } }, { status: 503, body: {} }],
        '/auth/me': { body: ME },
        '/widgets': { status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Expired.', requestId: 'r' } } },
      });
      render(<SessionProvider><Flags /><RequireSession><Screen /></RequireSession></SessionProvider>);
      await userEvent.click(await screen.findByRole('button', { name: 'read' }));

      await waitFor(() => expect(screen.getByTestId('said')).toHaveTextContent('refused'));
      expect(screen.getByTestId('flags')).toHaveTextContent('in, not signed out, not expired');
      expect(replace).not.toHaveBeenCalled();
    });

    it('a support session’s 401 ends nothing: it never refreshes, the cookie being the Super Admin’s', async () => {
      const { calls } = stubFetch({
        '/auth/refresh': { body: { accessToken: 'fresh' } },
        '/auth/me': { body: ME },
        '/widgets': { status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Ended.', requestId: 'r' } } },
      });
      render(<SessionProvider><Flags /><RequireSession><Screen /></RequireSession></SessionProvider>);
      await screen.findByRole('button', { name: 'read' });
      setImpersonating(true);
      await userEvent.click(screen.getByRole('button', { name: 'read' }));

      await waitFor(() => expect(screen.getByTestId('said')).toHaveTextContent('refused'));
      expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(1);
      expect(screen.getByTestId('flags')).toHaveTextContent('in, not signed out, not expired');
      expect(replace).not.toHaveBeenCalled();
    });

    it('signing in again clears it, and a later Sign out goes to plain /login', async () => {
      stubFetch({
        '/auth/refresh': [{ body: { accessToken: 'fresh' } }, { status: 401, body: {} }],
        '/auth/me': { body: ME },
        '/auth/login': { body: { accessToken: 'tok' } },
        '/auth/logout': { status: 204, body: undefined },
        '/widgets': { status: 401, body: {} },
      });
      function Again() {
        const { signIn, signOut } = useSession();
        return (
          <>
            <button onClick={() => void signIn('rina@kpm0417.test', 'pw')}>sign in</button>
            <button onClick={() => void signOut()}>sign out</button>
          </>
        );
      }
      render(<SessionProvider><Flags /><Again /><RequireSession><Screen /></RequireSession></SessionProvider>);
      await userEvent.click(await screen.findByRole('button', { name: 'read' }));
      await waitFor(() => expect(screen.getByTestId('flags')).toHaveTextContent('out, not signed out, expired'));

      await userEvent.click(screen.getByRole('button', { name: 'sign in' }));
      await waitFor(() => expect(screen.getByTestId('flags')).toHaveTextContent('in, not signed out, not expired'));

      replace.mockClear();
      await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(replace.mock.calls).toEqual([['/login']]);
    });
  });

  it('refuses to render a consumer outside the provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/inside <SessionProvider>/);
    quiet.mockRestore();
  });
});
