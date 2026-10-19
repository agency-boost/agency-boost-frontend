import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { RequireSession } from '@/components/require-session';
import { SessionProvider } from '@/components/session-provider';
import { setAccessToken } from './api-client';
import { useSignOut } from './use-sign-out';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/admin',
}));

function Probe() {
  const { signOut, busy } = useSignOut();
  return (
    <button onClick={() => void signOut()} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

describe('useSignOut', () => {
  it('ends the session, then leaves for the sign-in page', async () => {
    const { session } = renderWithSession(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('redirects even when the server call failed, because signOut never rejects', async () => {
    // A logout that cannot reach the server must still end the session locally —
    // leaving someone signed in because the network dropped is the wrong failure mode.
    const signOut = vi.fn(async () => undefined);
    renderWithSession(<Probe />, { signOut });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('reports being in flight so a caller can lock its control', async () => {
    let release: () => void = () => {};
    const signOut = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    renderWithSession(<Probe />, { signOut });

    void userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Signing out…' })).toBeDisabled();

    release();
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
});

/*
 * **The product owner's report, 2026-10-11**, end to end: the real session and the real guard around a gated
 * page. Ending the session wakes the page's guard as well as the hook's own redirect, and the guard used to
 * send the reader to `/login?next=<this page>` — whichever landed last won, and the next person to sign in on
 * the device was taken to the page. Both now go to plain `/login`, so the order no longer matters.
 */
describe('signing out of a gated page (2026-10-11)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
    window.history.pushState({}, '', '/');
  });

  it('lands on plain /login, with no next, from both the hook and the page’s own guard', async () => {
    window.history.pushState({}, '', '/kpm/analytics/compliance?category=training');
    stubFetch({
      '/auth/refresh': { body: { accessToken: 'fresh' } },
      '/auth/me': { body: makeMe({ permissions: ['kpm_analytics:read'] }) },
      '/auth/logout': { status: 204, body: undefined },
    });
    replace.mockClear();
    render(
      <SessionProvider>
        <RequireSession permission="kpm_analytics:read"><Probe /></RequireSession>
      </SessionProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
    expect(replace.mock.calls).toEqual([['/login'], ['/login']]);
  });
});
