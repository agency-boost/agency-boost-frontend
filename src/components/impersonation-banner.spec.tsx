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
   * ADR-0162 (P18.9-T1 AC-5): **which kind of session**, and for a setup one what it may change — it is
   * read-only for everything else, so neither of the other two sentences is true of it.
   */
  it.each([
    ['a support session', { impersonationReadOnly: true, impersonationPurpose: 'support' as const },
      'You can look but not change anything — a second Super Admin has to approve that.'],
    ['a setup session', { impersonationReadOnly: true, impersonationPurpose: 'setup' as const },
      'This is a setup session: you can change the office’s settings, import people and upload production files, and nothing else.'],
    ['an elevated session', { impersonationReadOnly: false, impersonationPurpose: 'setup' as const },
      'This session can make changes. It was approved by a second Super Admin.'],
  ])('AC-5 says which kind of session it is: %s', (_kind, session, sentence) => {
    renderWithSession(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root', ...session }),
    });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(sentence);
    expect(banner).toHaveTextContent('recorded against you as well');
  });

  it('reads a session from before the purpose existed as a support session', () => {
    renderWithSession(<ImpersonationBanner />, {
      me: makeMe({ isImpersonating: true, impersonatedBy: 'u-root', impersonationReadOnly: true }),
    });
    expect(screen.getByRole('status')).toHaveTextContent('You can look but not change anything');
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
