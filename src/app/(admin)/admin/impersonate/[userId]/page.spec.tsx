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
/** The address's query: *Open as Owner* puts `kpmId` in it; an old one may still say `purpose=setup` (ignored). */
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
      // No purpose: there is one kind of session, and it only looks (P19.4-T2 AC-1; ADR-0206 §3).
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

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    expect(push).toHaveBeenCalledWith('/');
    expect(screen.queryByText('SUPERADMIN')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /*
   * **P19.4-T2 AC-1, AC-5, AC-7 (UI-151; Overview case 9; ADR-0206 §3): *Hanya melihat*, said and not chosen.** The
   * screen names the person and the kind of session, with no radio and no *"What is this session for?"*; nothing sends
   * a purpose, whatever an old address says. The reason, the 60 minutes and the notices are as they were (AC-5).
   */
  describe('P19.4-T2 view only, with no choice (ADR-0206)', () => {
    const KPM = {
      _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', ownerUserId: 'u-owner',
      ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test', status: 'active',
    };
    const STARTED = { accessToken: 'imp-token', expiresAt: '2026-09-04T03:00:00Z', sessionId: 'sess-1', readOnly: true };

    it('P19.4-T2 AC-1 from Open as Owner: names the Owner and their office, and says View only — no radio, no purpose', async () => {
      search = new URLSearchParams({ kpmId: 'kpm-1' });
      stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
      expect(screen.getByText(/the Owner of KPM 0417 · BSD City Branch/)).toBeInTheDocument();
      expect(screen.queryByText('u-owner')).not.toBeInTheDocument();

      expect(screen.getByText('View only')).toBeInTheDocument();
      expect(screen.getByText('See their screens and change nothing. Every change is refused while you view as them.'))
        .toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'What is this session for?' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Setup|import people|upload production|second Super Admin/)).not.toBeInTheDocument();
      // Back to the office it came from.
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
    });

    it('P19.4-T2 AC-5 keeps the reason, the 60 minutes, the reload and the notices', () => {
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });
      expect(screen.getByLabelText('Reason')).toBeRequired();
      expect(screen.getByText(/cannot exceed 60 minutes/)).toBeInTheDocument();
      expect(screen.getByText(/ends the moment you reload/)).toBeInTheDocument();
      expect(screen.getByText(/are notified the moment it starts/)).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
      search = new URLSearchParams({ kpmId: 'kpm-1' });
      stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
      const { container } = renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });
      expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
      expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
    });

    it('P19.4-T2 AC-1 ignores purpose=setup in an old address: sends no purpose, and starts a session that only looks', async () => {
      search = new URLSearchParams({ purpose: 'setup', kpmId: 'kpm-1' });
      const { calls } = stubFetch({ '/admin/tenants/kpm-1': { body: KPM }, '/admin/impersonate/u-owner': { body: STARTED } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Reason'), 'Melihat Overview');
      await userEvent.click(screen.getByRole('button', { name: 'Start session' }));
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/'));
      const started = calls.find((c) => c.url.includes('/admin/impersonate/u-owner'));
      expect(JSON.parse(started!.init.body as string)).not.toHaveProperty('purpose');
    });

    it('keeps the id when the office it names has somebody else as its Owner', async () => {
      search = new URLSearchParams({ kpmId: 'kpm-1' });
      stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: 'u-other', ownerName: 'Somebody Else' } } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      expect(await screen.findByText('u-owner')).toBeInTheDocument();
      await vi.waitFor(() => expect(screen.queryByText('Somebody Else')).not.toBeInTheDocument());
      expect(screen.getByText('View only')).toBeInTheDocument();
    });

    it('keeps the id, and the form, when the office it names cannot be read', async () => {
      search = new URLSearchParams({ kpmId: 'kpm-gone' });
      stubFetch({ '/admin/tenants/kpm-gone': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'KPM not found.', requestId: 'req-14' } } } });
      renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

      expect(await screen.findByText('u-owner')).toBeInTheDocument();
      // Naming the person is a courtesy: failing to is not an error to show, nor a reason to refuse to start.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
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

  /*
   * ADR-0168 §4: a second start as the same person within one second signs the same token, and is refused
   * `409 IMPERSONATION_JUST_STARTED` — it was a `500`. The screen says the server's sentence, keeps the Super
   * Admin as themselves, and gives the button back.
   */
  it('ADR-0168 §4 shows a double start refused, and gives the button back', async () => {
    const JUST_STARTED = 'A session as this person started a moment ago. Use that one, or wait a second and start again.';
    stubFetch({
      '/admin/impersonate/u-owner': {
        status: 409,
        body: { error: { code: 'IMPERSONATION_JUST_STARTED', message: JUST_STARTED, requestId: 'req-13' } },
      },
    });
    renderInLayout(AdminLayout, <ImpersonatePage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Reason'), 'support ticket 42');
    await userEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(JUST_STARTED);
    expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled();
    expect(getAccessToken()).toBeNull();
    expect(isImpersonating()).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
