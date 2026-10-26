import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, makeSession, renderInLayout, routeParams, stubFetch } from '@test/harness';
import { getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import { SessionContext, type Me } from '@/lib/session';
import ImpersonatePage from './page';

const push = vi.fn();
const replace = vi.fn();
/** The address's query: *Open as Owner* puts `purpose` and `kpmId` in it (ADR-0162). */
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/admin/impersonate/u-owner',
  useSearchParams: () => search,
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
    search = new URLSearchParams();
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
      // Look only, unless the address or the reader says otherwise (ADR-0162).
      purpose: 'support',
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

  /*
   * ADR-0162 (P18.9-T1 AC-5): **the screen names the person and asks what the session is for** — *Setup* or
   * *Look only* — opening on *Setup* from the office's *Open as Owner*.
   */
  describe('Setup or Look only (ADR-0162)', () => {
    const KPM = {
      _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', ownerUserId: 'u-owner',
      ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test', status: 'active',
    };
    const STARTED = { accessToken: 'imp-token', expiresAt: '2026-09-04T03:00:00Z', sessionId: 'sess-1', readOnly: true };

    it('AC-5 from Open as Owner: names the Owner and their office, and opens on Setup', async () => {
      search = new URLSearchParams({ purpose: 'setup', kpmId: 'kpm-1' });
      stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
      expect(screen.getByText(/the Owner of KPM 0417 · BSD City Branch/)).toBeInTheDocument();
      expect(screen.queryByText('u-owner')).not.toBeInTheDocument();

      const group = screen.getByRole('group', { name: 'What is this session for?' });
      expect(screen.getByRole('radio', { name: /^Setup/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /^Look only/ })).not.toBeChecked();
      expect(group).toHaveTextContent('import people and upload production files, as them — and nothing else');
      // Back to the office it came from.
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
    });

    it('has no axe violations with the choice on screen', async () => {
      search = new URLSearchParams({ purpose: 'setup', kpmId: 'kpm-1' });
      stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
      const { container } = renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });
      expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
      expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
    });

    it('AC-5 sends the purpose chosen, Setup or Look only', async () => {
      search = new URLSearchParams({ purpose: 'setup', kpmId: 'kpm-1' });
      const { calls } = stubFetch({ '/admin/tenants/kpm-1': { body: KPM }, '/admin/impersonate/u-owner': { body: STARTED } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      await userEvent.type(screen.getByLabelText('Reason'), 'Setting up the activity types');
      await userEvent.click(screen.getByRole('button', { name: 'Start session' }));
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/'));
      const started = calls.find((c) => c.url.includes('/admin/impersonate/u-owner'));
      expect(JSON.parse(started!.init.body as string)).toMatchObject({ purpose: 'setup' });
    });

    it('AC-5 a reader may choose Look only instead', async () => {
      search = new URLSearchParams({ purpose: 'setup', kpmId: 'kpm-1' });
      const { calls } = stubFetch({ '/admin/tenants/kpm-1': { body: KPM }, '/admin/impersonate/u-owner': { body: STARTED } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      await userEvent.click(screen.getByRole('radio', { name: /^Look only/ }));
      await userEvent.type(screen.getByLabelText('Reason'), 'Ticket 42');
      await userEvent.click(screen.getByRole('button', { name: 'Start session' }));
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/'));
      const started = calls.find((c) => c.url.includes('/admin/impersonate/u-owner'));
      expect(JSON.parse(started!.init.body as string)).toMatchObject({ purpose: 'support' });
    });

    it('keeps the id when the office it names has somebody else as its Owner, and opens on Look only without a purpose', async () => {
      search = new URLSearchParams({ kpmId: 'kpm-1' });
      stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: 'u-other', ownerName: 'Somebody Else' } } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      expect(await screen.findByText('u-owner')).toBeInTheDocument();
      await vi.waitFor(() => expect(screen.queryByText('Somebody Else')).not.toBeInTheDocument());
      expect(screen.getByRole('radio', { name: /^Look only/ })).toBeChecked();
    });

    it('keeps the id, and the form, when the office it names cannot be read', async () => {
      search = new URLSearchParams({ purpose: 'setup', kpmId: 'kpm-gone' });
      stubFetch({ '/admin/tenants/kpm-gone': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'KPM not found.', requestId: 'req-14' } } } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      expect(await screen.findByText('u-owner')).toBeInTheDocument();
      // Naming the person is a courtesy: failing to is not an error to show, nor a reason to refuse to start.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /^Setup/ })).toBeChecked();
    });

    it('AC-1 shows the API refusing a setup session as somebody who is neither an Owner nor an Admin', async () => {
      search = new URLSearchParams({ purpose: 'setup' });
      stubFetch({
        '/admin/impersonate/u-owner': {
          status: 409,
          body: {
            error: {
              code: 'IMPERSONATION_SETUP_TARGET',
              message: 'A setup session acts as an office\'s Owner or one of its Admins, and this person is neither. Start a support session to look at their screens.',
              details: { purpose: 'setup' },
              requestId: 'req-13',
            },
          },
        },
      });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });
      await userEvent.type(screen.getByLabelText('Reason'), 'Setting up');
      await userEvent.click(screen.getByRole('button', { name: 'Start session' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('this person is neither');
      expect(getAccessToken()).toBeNull();
      expect(push).not.toHaveBeenCalled();
    });
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
