import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { getAccessToken, setAccessToken, setImpersonating } from '@/lib/api-client';
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

  it('refuses to render a consumer outside the provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/inside <SessionProvider>/);
    quiet.mockRestore();
  });
});
