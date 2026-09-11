import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import { getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import ImpersonatePage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
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
    // The session id travels so a colleague can be sent straight to the approval.
    expect(push).toHaveBeenCalledWith('/profile?session=sess-1');
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
});
