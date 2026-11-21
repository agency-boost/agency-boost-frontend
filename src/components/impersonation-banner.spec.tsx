import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InLanguage, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import { markViewAsWindow } from '@/lib/view-as';
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
    expect(banner).toHaveTextContent('Viewing as Rina');
    expect(banner).toHaveTextContent('recorded in the audit log');
  });

  /*
   * **P19.23-T2 AC-7 (ADR-0277; the owner mockups' `?va=` bar): the view-as bar** — navy, the name in capitals in the
   * primary's colour, the tag, and *Selesai* at least 40px tall.
   */
  it('P19.23-T2 AC-7 draws the mockup\'s view-as bar: navy, the name orange in capitals, the tag, Selesai', () => {
    renderWithSession(<InLanguage language="id"><ImpersonationBanner /></InLanguage>, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root', impersonationReadOnly: true }),
    });
    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('bg-secondary', 'sticky');
    expect(banner).toHaveTextContent('Melihat sebagai Rina');
    expect(banner).toHaveTextContent('Hanya melihat · tercatat di audit log');
    expect(screen.getByText('Rina')).toHaveClass('uppercase', 'text-primary-on-secondary');
    expect(screen.getByRole('button', { name: 'Selesai' })).toHaveClass('min-h-10');
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
    expect(banner).toHaveTextContent('View only · recorded in the audit log');
    expect(banner).not.toHaveTextContent(/setup|second Super Admin|can make changes/i);
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(isImpersonating()).toBe(false));
    expect(getAccessToken()).toBe('superadmin-token');
  });

  it('P19.23-T2 AC-7 in a view-as window, Selesai ends the session and closes the window', async () => {
    setAccessToken('imp-token');
    setImpersonating(true);
    markViewAsWindow();
    const close = vi.fn();
    vi.stubGlobal('close', close);
    const { calls } = stubFetch({
      '/admin/impersonate/end': { body: { status: 'ended' } },
      '/auth/refresh': { body: { accessToken: 'superadmin-token' } },
    });
    renderWithSession(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root' }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(close).toHaveBeenCalled());
    const paths = calls.map((c) => c.url.split('/api/v1')[1]);
    expect(paths[0]).toBe('/admin/impersonate/end');
    expect(isImpersonating()).toBe(false);
  });
});
