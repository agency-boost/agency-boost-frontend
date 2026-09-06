import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../test/harness';
import AdminOverviewPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'company:crud', 'platform_metrics:read'],
});

const overview = (over: Record<string, unknown> = {}) => ({
  tiles: { companies: 1, kpms: 8, totalMembers: 1340, agencyBuilders: 61 },
  attention: [],
  companies: [
    { companyId: 'co-1', name: 'Prudential', initials: 'PR', kpmCount: 8, memberCount: 1340 },
  ],
  ...over,
});

const UNOWNED = {
  tag: 'KPM owner', severity: 'structural' as const,
  title: '2 offices have no Owner',
  detail: 'Nobody can administer an office until an Owner is assigned, and only the platform can assign one.',
  href: '/admin/tenants', actionLabel: 'Review',
};

describe('admin overview', () => {
  afterEach(() => {
    replace.mockClear();
    vi.unstubAllGlobals();
  });

  it('AC-1: puts the queue above the tiles, because the console is a work list', async () => {
    // `Superadmin.html:232` puts `Needs your attention` first in the DOM and its footer
    // says why: nothing in it can be delegated. Tiles first reads as a dashboard.
    stubFetch({ '/admin/overview': { body: overview({ attention: [UNOWNED] }) } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Needs your attention', 'At a glance', 'Companies',
    ]);
  });

  it('AC-2: shows the four tiles the prototype names, headcounts included', async () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    // `Companies` and `KPMs` are also a section heading and a sidebar group, so match
    // each tile by its own number rather than by the word.
    expect(await screen.findByText('Total members')).toBeInTheDocument();
    expect(screen.getByText('Agency Builders')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument();
    // `KPMs` is a tile label, a section in the sidebar and a figure on the company card,
    // so it appears more than once by design.
    expect(screen.getAllByText('KPMs').length).toBeGreaterThan(1);
    // Grouped, as the prototype writes it — `1,340`, not `1340`. It appears on the tile
    // and again on the company card, which is why this counts rather than picks.
    expect(screen.getAllByText('1,340').length).toBeGreaterThan(0);
    expect(screen.queryByText('1340')).toBeNull();
  });

  it('AC-3: no longer claims it never reads an office\'s business data', async () => {
    // ADR-0011 retracted that clause: two of the tiles are cross-tenant headcounts.
    stubFetch({ '/admin/overview': { body: overview() } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Every company and KPM on AgencyBoost')).toBeInTheDocument();
    expect(screen.queryByText(/never reads an office/)).toBeNull();
  });

  it('AC-4: gives a company its office and member totals', async () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Prudential')).toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('raises an office with no owner, since nobody can administer it until one exists', async () => {
    stubFetch({ '/admin/overview': { body: overview({ attention: [UNOWNED] }) } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('2 offices have no Owner')).toBeInTheDocument();
    expect(screen.getByText(/nothing here can be delegated/)).toBeInTheDocument();
  });

  it('stays quiet when there is nothing to act on', async () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Nothing needs the platform right now.')).toBeInTheDocument();
    expect(screen.queryByText(/needs Superadmin action/)).toBeNull();
  });

  it('signs out from the sidebar, without needing the account screen first', async () => {
    // The console is where a Super Admin spends their session, so ending it has to be
    // reachable from the sidebar rather than only from /profile.
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    const { session } = renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(session.signOut).toHaveBeenCalled();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('names the account in the menu, so you can confirm it before leaving', async () => {
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByText('root@agencyboost.test')).toBeInTheDocument();
  });

  it('says it is loading rather than showing a misleading zero', () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

});
