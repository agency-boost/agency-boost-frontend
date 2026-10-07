import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { useEffect, useState } from 'react';
import { api, getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { SessionProvider } from './session-provider';

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

  it('refuses to render a consumer outside the provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/inside <SessionProvider>/);
    quiet.mockRestore();
  });
});
