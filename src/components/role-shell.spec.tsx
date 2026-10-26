import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { RoleShell } from './role-shell';
import { landingFor } from '@/lib/landing';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/notifications',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all'],
});

const member = (over: Record<string, unknown>) =>
  makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
    },
    permissions: ['member:read_profile'],
  });

/**
 * The chrome a cross-family route wears.
 *
 * These are the tests that were missing when `/notifications` shipped rendering
 * `AgentShell` unconditionally: the permission tests passed, because the gate was right,
 * and the shell tests passed, because each shell's own sections were right. Nothing
 * asserted which shell a route renders — so nobody found out until an Owner clicked it.
 */
describe('RoleShell', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives a Super Admin the platform console, not the agent application', async () => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
    renderWithSession(<RoleShell title="Notifications">body</RoleShell>, { me: SUPER_ADMIN });

    expect(await screen.findByText('SUPERADMIN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage companies' })).toBeInTheDocument();
    // The failure this exists for: the agent nav has no way back to /admin.
    expect(screen.queryByRole('link', { name: 'Activity management' })).toBeNull();
  });

  it('gives a KPM Owner their office, not the agent application', async () => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
    renderWithSession(<RoleShell title="Notifications">body</RoleShell>, {
      me: member({ isKpmOwner: true }),
    });

    expect(await screen.findByText('KPM OWNER')).toBeInTheDocument();
    // Every group starts open (P10.1-T3), so `People`'s items are there without a click.
    expect(screen.getByRole('link', { name: 'All members' })).toBeInTheDocument();
  });

  it('gives an Admin the office too — running one is what decides, not the hierarchy role', async () => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
    renderWithSession(<RoleShell title="Notifications">body</RoleShell>, {
      me: member({ isKpmAdmin: true }),
    });
    expect(await screen.findByRole('link', { name: 'All members' })).toBeInTheDocument();
  });

  it('gives everybody else the agent application', async () => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
    renderWithSession(<RoleShell title="Notifications">body</RoleShell>, { me: member({}) });

    expect(await screen.findByRole('link', { name: 'Activity management' })).toBeInTheDocument();
    expect(screen.queryByText('SUPERADMIN')).toBeNull();
  });

  it('renders bare when nobody is signed in on the page that opts in, rather than redirecting to sign in', async () => {
    // `/join` is opened from an emailed link by somebody who may have no account at all.
    // A shell here would bounce them to /login and lose the code they arrived with.
    router.replace.mockClear();
    renderWithSession(<RoleShell title="Join" allowSignedOut>the invite form</RoleShell>, { me: null });
    expect(screen.getByText('the invite form')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  /*
   * P18.8-T15 AC-2 (the client's UI review, UI-006): every other cross-family page sends a signed-out reader to sign
   * in and back. It rendered bare for them, so an expired session on `/profile` drew an empty form, no header and the
   * raw code of the read that failed.
   */
  describe('a reader with no session (P18.8-T15 AC-2)', () => {
    const at = (path: string) => {
      window.history.replaceState(null, '', path);
      onTestFinished(() => window.history.replaceState(null, '', '/'));
    };

    it.each([
      ['/profile', '/login?next=%2Fprofile'],
      ['/notifications', '/login?next=%2Fnotifications'],
      ['/leader-meetings?tab=past', '/login?next=%2Fleader-meetings%3Ftab%3Dpast'],
    ])('P18.8-T15 AC-2 sends somebody signed out of %s to %s, and renders none of the page', (path, to) => {
      at(path);
      router.replace.mockClear();
      renderWithSession(<RoleShell title="Your account">the profile form</RoleShell>, { me: null });
      expect(router.replace).toHaveBeenCalledWith(to);
      expect(screen.queryByText('the profile form')).toBeNull();
      expect(screen.queryByRole('navigation')).toBeNull();
    });

    it('ADR-0168 §1 sends somebody whose session ended under them to sign in with reason=expired', () => {
      at('/profile');
      router.replace.mockClear();
      renderWithSession(<RoleShell title="Your account">the profile form</RoleShell>, { me: null, expired: true });
      expect(router.replace.mock.calls).toEqual([['/login?next=%2Fprofile&reason=expired']]);
      expect(screen.queryByText('the profile form')).toBeNull();
    });

    it('P18.8-T15 AC-2 sends somebody who signed out themselves to plain /login', () => {
      at('/profile');
      router.replace.mockClear();
      renderWithSession(<RoleShell title="Your account">the profile form</RoleShell>, { me: null, signedOut: true });
      expect(router.replace).toHaveBeenCalledWith('/login');
    });

    it('P18.8-T15 AC-2 shows the page skeleton while the session loads, and sends nobody anywhere yet', () => {
      at('/profile');
      router.replace.mockClear();
      renderWithSession(<RoleShell title="Your account">the profile form</RoleShell>, { me: null, loading: true });
      expect(screen.getByRole('status')).toHaveTextContent('Loading…');
      expect(screen.queryByText('the profile form')).toBeNull();
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  /*
   * **The chrome it picks admits its reader** (2026-10-11): each shell now sends a reader who is not of its
   * family to their own landing (`familyAllows`). A cross-family route must never be sent away by the chrome it
   * chose itself — a pending Owner and somebody in no office included.
   */
  it.each([
    ['a Super Admin', SUPER_ADMIN],
    ['an Owner', member({ isKpmOwner: true })],
    ['an Admin', member({ isKpmAdmin: true })],
    ['an AB', member({ directCount: 2 })],
    ['an Agent', member({ orgLevelCode: 'AGENT', hierarchyRole: 'agent' })],
    ['a pending member', member({ status: 'pending' })],
    ['a pending Owner', member({ status: 'pending', isKpmOwner: true })],
    ['somebody in no office', makeMe({ membership: null, permissions: ['member:read_profile'] })],
  ])('2026-10-11: the chrome it picks for %s is one that admits them — nobody is sent away', async (_who, me) => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } }, '/kpm/config': { body: {} }, '/kpm/org-levels': { body: [] } });
    router.replace.mockClear();
    renderWithSession(<RoleShell title="Notifications">body</RoleShell>, { me });
    expect(await screen.findByText('body')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('picks the same way landingFor does, so the two cannot drift', () => {
    // Where somebody lands and what chrome they wear are one question asked twice. This
    // pins the correspondence rather than trusting two lists to stay in the same order.
    expect(landingFor(SUPER_ADMIN)).toBe('/admin');
    expect(landingFor(member({ isKpmOwner: true }))).toBe('/kpm/overview');
    expect(landingFor(member({ isKpmAdmin: true }))).toBe('/kpm/overview');
    expect(landingFor(null)).toBe('/login');
  });

  describe('the notification bell (client feedback, 2026-09-24)', () => {
    /*
     * It was a nav item in all three shells — a count sitting in a list of places to work,
     * which read as a section of the product rather than as the thing you glance at on the
     * way past. It is a glance, so it sits where the account does.
     */
    const shells = [
      ['a Super Admin', SUPER_ADMIN],
      ['a KPM Owner', member({ isKpmOwner: true })],
      ['an agent', member({})],
    ] as const;

    it.each(shells)('gives %s a bell and no nav item', async (_who, me) => {
      stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me });

      expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
      // The nav is where places to work live, and this is not one of them.
      expect(within(screen.getByRole('navigation', { name: 'Main' }))
        .queryByRole('link', { name: /Notifications/ })).toBeNull();
    });

    it('puts the count in the name, not only in the badge', async () => {
      // A red circle beside an unlabelled icon tells a screen reader nothing, and
      // "Notifications" alone hides the one thing the control exists to communicate.
      stubFetch({ '/notifications': { body: { items: [], unread: 3 } } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me: member({}) });

      const bell = await screen.findByRole('button', { name: 'Notifications, 3 unread' });
      expect(within(bell).getByText('3')).toBeInTheDocument();
    });

    it('shows no badge at zero', async () => {
      stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me: member({}) });

      const bell = await screen.findByRole('button', { name: 'Notifications' });
      expect(bell.textContent).toBe('');
    });

    it('caps the badge, so the identity chip does not move as the count grows', async () => {
      stubFetch({ '/notifications': { body: { items: [], unread: 42 } } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me: member({}) });

      const bell = await screen.findByRole('button', { name: 'Notifications, 42 unread' });
      expect(within(bell).getByText('9+')).toBeInTheDocument();
    });

    /*
     * P12.1-T2 AC-7, in each of the three shells: the bell is a button that opens the latest few
     * beside it, and clicking it never navigates (the product owner, 2026-10-03).
     */
    const inbox = {
      items: [{
        notificationId: 'n-1', templateId: 'join_request.approved', title: 'You are in',
        detail: 'Your request was approved.', href: null, kpmId: 'kpm-1',
        createdAt: '2026-09-01T00:00:00.000Z', readAt: null,
      }],
      unread: 1, total: 1, page: 1, pageSize: 8,
    };

    it.each(shells)('P12.1-T2 AC-1 opens %s’s popover from the bell, without navigating', async (_who, me) => {
      router.push.mockClear();
      const { calls } = stubFetch({ '/notifications': { body: inbox } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me });

      const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
      expect(bell).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(bell);

      const popover = screen.getByRole('dialog', { name: 'Notifications' });
      expect(bell).toHaveAttribute('aria-expanded', 'true');
      expect(bell).toHaveAttribute('aria-controls', popover.id);
      expect(await within(popover).findByRole('button', { name: 'Unread: You are in' })).toBeInTheDocument();
      expect(within(popover).getByRole('link', { name: 'See all notifications' })).toHaveAttribute('href', '/notifications');
      // The popover reads one small page; the page itself is reached only by its link.
      expect(calls.some((c) => c.url.endsWith('/notifications?page=1&pageSize=8'))).toBe(true);
      expect(router.push).not.toHaveBeenCalled();
    });

    it.each(shells)('P12.1-T2 AC-4 closes %s’s popover on Escape, and puts focus back on the bell', async (_who, me) => {
      stubFetch({ '/notifications': { body: inbox } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me });

      const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
      await userEvent.click(bell);
      expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveFocus();
      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
      expect(bell).toHaveFocus();
    });
  });
});
