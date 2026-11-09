import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import { ImpersonationBanner } from './impersonation-banner';

describe('impersonation banner', () => {
  beforeEach(() => {
    setAccessToken(null);
    setImpersonating(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stays out of the way when nobody is impersonating', () => {
    const { container } = renderWithSession(<ImpersonationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says whose identity is on screen and that the actions are recorded', () => {
    renderWithSession(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root' }),
    });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('You are acting as Rina');
    expect(banner).toHaveTextContent('recorded against you as well');
  });

  /*
   * **P19.4-T2 AC-5 (UI-151; ADR-0206 §3): the banner says the session only looks** — the one sentence there is now.
   * The setup session's and the elevated one's are retired with them; the red, the name and the end stay.
   */
  it('P19.4-T2 AC-5 says the session only looks, and nothing about a setup or an approval', () => {
    renderWithSession(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root', impersonationReadOnly: true }),
    });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('This is a view-only session: you can look, and nothing can be changed.');
    expect(banner).toHaveTextContent('recorded against you as well');
    expect(banner).not.toHaveTextContent(/setup|second Super Admin|can make changes/i);
    expect(banner).toHaveClass('bg-alert');
    expect(screen.getByRole('button', { name: 'Stop acting as them' })).toBeInTheDocument();
  });

  it('records the end before dropping the token, then restores the Super Admin', async () => {
    setAccessToken('imp-token');
    setImpersonating(true);
    const { calls } = stubFetch({
      '/admin/impersonate/end': { body: { status: 'ended' } },
      '/auth/refresh': { body: { accessToken: 'superadmin-token' } },
    });

    const { session } = renderWithSession(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root' }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Stop acting as them' }));

    await waitFor(() => expect(session.reload).toHaveBeenCalled());
    // Order matters: ending after the token is dropped would record the entry as the
    // Super Admin's own action rather than the close of the session.
    const paths = calls.map((c) => c.url.split('/api/v1')[1]);
    expect(paths.indexOf('/admin/impersonate/end')).toBeLessThan(paths.indexOf('/auth/refresh'));
    expect(isImpersonating()).toBe(false);
    expect(getAccessToken()).toBe('superadmin-token');
  });

  it('still leaves the session when the end call fails', async () => {
    setAccessToken('imp-token');
    setImpersonating(true);
    stubFetch({
      '/admin/impersonate/end': { status: 500, body: {} },
      '/auth/refresh': { body: { accessToken: 'superadmin-token' } },
    });

    renderWithSession(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root' }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Stop acting as them' }));

    await waitFor(() => expect(isImpersonating()).toBe(false));
    expect(getAccessToken()).toBe('superadmin-token');
  });
});
