import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, makeSession, renderInLayout, routeParams, stubFetch } from '@test/harness';
import { getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import { SessionContext, type Me } from '@/lib/session';
import ImpersonatePage from './page';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/admin/impersonate/u-owner',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'impersonation:start'],
});

const params = routeParams({ userId: 'u-owner' });

describe('start impersonation', () => {
  beforeEach(() => {
    setAccessToken(null);
    setImpersonating(false);
    push.mockClear();
    replace.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('states the consequences before asking anyone to agree to them', () => {
    renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });
    expect(screen.getByText(/recorded against/)).toBeInTheDocument();
    expect(screen.getByText(/cannot exceed 60 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/never restored from/)).toBeInTheDocument();
  });

  it('will not start without a reason', async () => {
    renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Reason'), 'support ticket 42');
    expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled();
  });

  it('refuses a duration the API would clamp, before sending it', async () => {
    renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });
    await userEvent.type(screen.getByLabelText('Reason'), 'support ticket 42');
    await userEvent.clear(screen.getByLabelText('Duration (minutes)'));
    await userEvent.type(screen.getByLabelText('Duration (minutes)'), '90');

    expect(screen.getByText('Between 1 and 60.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
  });

  it('swaps in the impersonation token and disables the refresh retry', async () => {
    // The refresh cookie is still the Super Admin's, so leaving the retry armed would
    // let an expired impersonation token quietly promote the request back to them.
    const { calls } = stubFetch({
      '/admin/impersonate/u-owner': { body: { accessToken: 'imp-token', expiresAt: '2026-09-04T03:00:00Z', sessionId: 'sess-1', readOnly: true } },
    });
    renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Reason'), 'support ticket 42');
    await userEvent.click(screen.getByRole('button', { name: 'Start session' }));

    await vi.waitFor(() => expect(getAccessToken()).toBe('imp-token'));
    expect(isImpersonating()).toBe(true);
    // Found rather than indexed: the shell reads the unread count on mount, so this is
    // no longer the first call the page makes.
    const started = calls.find((c) => c.url.includes('/admin/impersonate/u-owner'));
    expect(JSON.parse(started!.init.body as string)).toEqual({
      reason: 'support ticket 42',
      durationMinutes: 60,
    });
    // To the member's landing, by way of `/` (2026-10-11): see the next test.
    expect(push).toHaveBeenCalledWith('/');
  });

  /*
   * **The session is the member's now** (2026-10-11): the console's shell admits only a Super Admin
   * (`RequireSession`'s `family`), so it sends the session to the member's landing, as `/` does — the two
   * navigations agree, and the member is never refused in the console's chrome, nor shown it.
   */
  it('a session as an Agent goes to the Agent’s landing: the console is not refused to them, nor drawn around them', async () => {
    const AGENT = makeMe({ permissions: ['profile:read_self'] });
    stubFetch({
      '/admin/impersonate/u-owner': { body: { accessToken: 'imp-token', expiresAt: '2026-09-04T03:00:00Z', sessionId: 'sess-1', readOnly: true } },
      '/notifications/unread-count': { body: { count: 0 } },
    });
    /** The session as the provider holds it: `reload` reads the member the new token belongs to. */
    function Switching({ children }: { children: React.ReactNode }) {
      const [me, setMe] = useState<Me>(SUPER_ADMIN);
      return (
        <SessionContext.Provider value={makeSession({ me, reload: async () => setMe(AGENT) })}>
          {children}
        </SessionContext.Provider>
      );
    }
    render(<Switching><AdminLayout><ImpersonatePage params={params} /></AdminLayout></Switching>);

    await userEvent.type(screen.getByLabelText('Reason'), 'support ticket 42');
    await userEvent.click(screen.getByRole('button', { name: 'Start session' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/activity/log'));
    expect(push).toHaveBeenCalledWith('/');
    expect(screen.queryByText('SUPERADMIN')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('leaves the Super Admin as themselves when the API refuses', async () => {
    stubFetch({
      '/admin/impersonate/u-owner': {
        status: 403,
        body: {
          error: {
            code: 'PERM_DENIED',
            message: 'A Super Admin cannot be impersonated.',
            requestId: 'req-11',
          },
        },
      },
    });
    renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Reason'), 'support ticket 42');
    await userEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be impersonated');
    expect(getAccessToken()).toBeNull();
    expect(isImpersonating()).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('P13.2 exit review: an office nobody can use is refused here, as this screen’s error', async () => {
    // Its own code, so the console shows it on the support screen: the member's codes replaced the
    // console with the member's *office unavailable* page.
    stubFetch({
      '/admin/impersonate/u-owner': {
        status: 409,
        body: {
          error: {
            code: 'IMPERSONATION_OFFICE_UNAVAILABLE',
            message: 'KPM 0601 · Cikarang Branch is suspended, so nobody can act as its members until it is reactivated.',
            details: { kpmCode: '0601', branch: 'Cikarang Branch', reason: 'suspended' },
            requestId: 'req-12',
          },
        },
      },
    });
    renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Reason'), 'support ticket 42');
    await userEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'KPM 0601 · Cikarang Branch is suspended, so nobody can act as its members until it is reactivated.',
    );
    expect(screen.getByRole('heading', { name: 'Act as another user' })).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(isImpersonating()).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
