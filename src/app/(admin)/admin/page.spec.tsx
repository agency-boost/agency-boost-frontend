import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, renderWithSession, stubFetch, wears } from '@test/harness';
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
    { companyId: 'co-1', name: 'Prudential', initials: 'PR', kpmCount: 8, memberCount: 1340,
      ladder: ['Agent', 'AAB', 'AB'] },
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
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Needs your attention', 'At a glance', 'Companies',
    ]);
  });

  it('AC-2: shows the four tiles the prototype names, headcounts included', async () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    // `Companies` and `KPMs` are also a section heading and a sidebar group, so match
    // each tile by its own number rather than by the word.
    expect(await screen.findByText('Total members')).toBeInTheDocument();
    expect(screen.getByText('ABs')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument();
    // `KPMs` is a tile label, a section in the sidebar and a figure on the company card,
    // so it appears more than once by design.
    expect(screen.getAllByText('KPMs').length).toBeGreaterThan(1);
    // Grouped — `1.340`, not `1340`: `id-ID`'s dot since ADR-0167 §1, where the prototype wrote `1,340`; `1,340` in the
    // English figures a spec reads (P18.10-T6, the console's figures wired; the Indonesian spec reads `1.340`). It appears on the tile
    // and again on the company card, which is why this counts rather than picks.
    expect(screen.getAllByText('1,340').length).toBeGreaterThan(0);
    expect(screen.queryByText('1340')).toBeNull();
  });

  it('AC-3: no longer claims it never reads an office\'s business data — and, since UI-136, no sub-line at all', async () => {
    // ADR-0011 retracted that clause: two of the tiles are cross-tenant headcounts. P19.2-T2 AC-7 (UI-136, Appendix A)
    // then removed the page's sub-line at every size.
    stubFetch({ '/admin/overview': { body: overview() } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Prudential')).toBeInTheDocument();
    expect(screen.queryByText('Every company and KPM on AgencyBoost')).toBeNull();
    expect(screen.queryByText(/never reads an office/)).toBeNull();
  });

  it('AC-4: gives a company its office and member totals', async () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Prudential')).toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('raises an office with no owner, since nobody can administer it until one exists', async () => {
    stubFetch({ '/admin/overview': { body: overview({ attention: [UNOWNED] }) } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('2 offices have no Owner')).toBeInTheDocument();
    expect(screen.getByText(/nothing here can be delegated/)).toBeInTheDocument();
  });

  it('P19.2-T2 AC-8 hides Needs your attention while nothing needs handling, at every size (UI-137, D-08)', async () => {
    for (const px of [375, 768, 1280]) {
      atWidth(px);
      stubFetch({ '/admin/overview': { body: overview() } });
      const { unmount } = renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

      expect(await screen.findByText('Prudential')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Needs your attention' })).toBeNull();
      expect(screen.queryByText('Nothing needs the platform right now.')).toBeNull();
      expect(screen.queryByText(/needs Superadmin action/)).toBeNull();
      unmount();
    }
  });

  it('P19.2-T2 AC-8 lists what needs handling when something does', async () => {
    stubFetch({ '/admin/overview': { body: overview({ attention: [UNOWNED] }) } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    const queue = (await screen.findByRole('heading', { name: 'Needs your attention' })).parentElement!;
    expect(within(queue).getAllByRole('listitem')).toHaveLength(1);
  });

  it('P19.2-T2 AC-8 lays the tiles 2×2 on a phone and four across on a tablet and a laptop', async () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderWithSession(<AdminOverviewPage />, { me: SUPER_ADMIN });

    const tiles = (await screen.findByText('Total members')).closest('[data-stat-tile]')!.parentElement!;
    expect(wears(tiles, 375)).toContain('grid-cols-2');
    expect(wears(tiles, 768)).toContain('grid-cols-4');
    expect(wears(tiles, 1280)).toContain('grid-cols-[1.1fr_1fr_1fr_1fr]');
    // The stat tile's ~68px on a phone: 12px inside, the 26px number.
    const tile = tiles.firstElementChild!;
    expect(wears(tile, 375)).toContain('p-3');
    expect(wears(tile.lastElementChild!, 375)).toContain('text-[1.625rem]');
    // The sections' grey lines from 1024px only, so 375 fits one screen with two companies and nothing to handle.
    expect(wears(screen.getByText('Across every company on the platform'), 375)).toContain('hidden');
    expect(wears(screen.getByText('Across every company on the platform'), 1280)).not.toContain('hidden');
  });

  it('signs out from the sidebar, without needing the account screen first', async () => {
    // The console is where a Super Admin spends their session, so ending it has to be
    // reachable from the sidebar rather than only from /profile.
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    const { session } = renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(session.signOut).toHaveBeenCalled();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('names the account in the menu, so you can confirm it before leaving', async () => {
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: /Root/ }));
    expect(screen.getByText('root@agencyboost.test')).toBeInTheDocument();
  });

  it('says it is loading rather than showing a misleading zero', () => {
    stubFetch({ '/admin/overview': { body: overview() } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });

    expect(screen.getByRole('status')).toHaveTextContent('Loading the platform overview');
  });

  /*
   * **P19.4-T3 AC-1, AC-8 (SA UI-010, SA R5; ADR-0212):** *TOTAL MEMBERS* and *ABS* open *All members*; *Perlu perhatian
   * Anda* lists each KPM not yet set up by its code — the API's rows, drawn as they come.
   */
  it.each([375, 1280])('P19.4-T3 AC-1 at %ipx: TOTAL MEMBERS opens All members unfiltered, ABS filtered to AB', async (px) => {
    atWidth(px);
    stubFetch({ '/admin/overview': { body: overview() } });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });
    const total = (await screen.findByText('Total members')).closest('a')!;
    expect(total).toHaveAttribute('href', '/admin/members');
    expect(total).toHaveTextContent('1,340');
    expect(screen.getByText('ABs').closest('a')).toHaveAttribute('href', '/admin/members?role=AB');
    // The two the list does not open stay figures.
    expect(screen.getAllByText('KPMs').some((el) => el.closest('[data-stat-tile]')?.querySelector('a'))).toBe(false);
  });

  it('P19.4-T3 AC-8 lists “KPM {code} belum punya Owner” and “… belum punya anggota”, one row each, each opening its KPM', async () => {
    const row = (title: string, tag: string, href: string) => ({
      tag, severity: 'structural' as const, title, detail: 'x', href, actionLabel: 'Buka KPM',
    });
    stubFetch({
      '/admin/overview': {
        body: overview({
          attention: [
            row('KPM 0602 belum punya Owner', 'KPM Owner', '/admin/tenants/kpm-0602'),
            row('KPM 0602 belum punya anggota', 'Anggota', '/admin/tenants/kpm-0602'),
            row('KPM 0603 belum punya anggota', 'Anggota', '/admin/tenants/kpm-0603'),
          ],
        }),
      },
    });
    renderInLayout(AdminLayout, <AdminOverviewPage />, { me: SUPER_ADMIN });
    await screen.findByText('KPM 0603 belum punya anggota');
    const items = screen.getAllByRole('listitem');
    const queue = items.filter((li) => li.textContent?.includes('belum punya'));
    expect(queue.map((li) => within(li).getByText(/^KPM 06/).textContent)).toEqual([
      'KPM 0602 belum punya Owner', 'KPM 0602 belum punya anggota', 'KPM 0603 belum punya anggota',
    ]);
    expect(within(queue[2]).getByRole('link', { name: /Buka KPM/ })).toHaveAttribute('href', '/admin/tenants/kpm-0603');
  });
});
