import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { RoleShell } from './role-shell';
import { landingFor } from '@/lib/landing';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

  it('renders bare when nobody is signed in, rather than redirecting to sign in', async () => {
    // `/join` is opened from an emailed link by somebody who may have no account at all.
    // A shell here would bounce them to /login and lose the code they arrived with.
    renderWithSession(<RoleShell title="Join">the invite form</RoleShell>, { me: null });
    expect(screen.getByText('the invite form')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
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

      expect(await screen.findByRole('link', { name: 'Notifications' })).toBeInTheDocument();
      // The nav is where places to work live, and this is not one of them.
      expect(within(screen.getByRole('navigation', { name: 'Main' }))
        .queryByRole('link', { name: /Notifications/ })).toBeNull();
    });

    it('puts the count in the name, not only in the badge', async () => {
      // A red circle beside an unlabelled icon tells a screen reader nothing, and
      // "Notifications" alone hides the one thing the control exists to communicate.
      stubFetch({ '/notifications': { body: { items: [], unread: 3 } } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me: member({}) });

      const bell = await screen.findByRole('link', { name: 'Notifications, 3 unread' });
      expect(within(bell).getByText('3')).toBeInTheDocument();
    });

    it('shows no badge at zero', async () => {
      stubFetch({ '/notifications': { body: { items: [], unread: 0 } } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me: member({}) });

      const bell = await screen.findByRole('link', { name: 'Notifications' });
      expect(bell.textContent).toBe('');
    });

    it('caps the badge, so the identity chip does not move as the count grows', async () => {
      stubFetch({ '/notifications': { body: { items: [], unread: 42 } } });
      renderWithSession(<RoleShell title="Overview">body</RoleShell>, { me: member({}) });

      const bell = await screen.findByRole('link', { name: 'Notifications, 42 unread' });
      expect(within(bell).getByText('9+')).toBeInTheDocument();
    });
  });
});
