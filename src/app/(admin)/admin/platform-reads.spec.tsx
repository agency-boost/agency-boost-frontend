import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, routeParams, stubFetch } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import { englishOnly, englishShown } from '@test/english-left';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import CompanyKpmsPage from './companies/[companyId]/kpms/page';

const nav = vi.hoisted(() => ({ pathname: '/admin/members', search: '' }));
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: [
    'kpm:list_all', 'kpm:read_profile', 'company:crud', 'company_template:read', 'platform_analytics:read',
    'platform_members:read', 'platform_kpm_figures:read',
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
  nav.search = '';
});

/*
 * *All members*' tests moved with the page (P19.23-T3): `/admin/members` is *Anggota* now — `members/page.spec.tsx`.
 */

/*
 * *The KPM comparison*'s tests went with it (P19.23-T1 AC-4; ADR-0277 §1): `/admin/analytics` redirects to the Dashboard,
 * whose *Adopsi per KPM* replaces it — `page.spec.tsx` beside the Dashboard.
 */

describe('P19.4-T3 AC-15 — KPM & data', () => {
  const VIEW = {
    company: { id: 'co-1', name: 'Prudential' }, month: '2026-10',
    tiles: { kpms: 2, activeOwners: 1, members: 40, notSignedIn: 6, complete: 1, needed: 3 },
    rows: [
      {
        kpmId: 'kpm-1', code: '0417', branch: 'Bandung', manpower: 30, maa: 12, apeYtdMinor: 150_000_000_000, recruitmentYtd: 9,
        data: 'complete', peers: { status: 'not_enough', count: 0, needed: 3 },
      },
      {
        kpmId: 'kpm-2', code: '0555', branch: 'Medan', manpower: 10, maa: null, apeYtdMinor: null, recruitmentYtd: null,
        data: 'missing', peers: { status: 'not_counted', count: 0, needed: 3 },
      },
    ],
  };
  const params = routeParams({ companyId: 'co-1' });

  it.each([375, 1280])('P19.4-T3 AC-15 at %ipx: three tiles, the company’s KPMs, the D4 peer status, no company upload', async (px) => {
    atWidth(px);
    nav.pathname = '/admin/companies/co-1/kpms';
    stubFetch({
      '/admin/companies/co-1/kpms': { body: VIEW },
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer', status: 'active' }] },
    });
    renderInLayout(AdminLayout, <CompanyKpmsPage params={params} />, { me: SUPER_ADMIN });
    // Moved 2026-11-06 (P19.2-T2 AC-1; UI-126): below 1024px a row per KPM, the same peer status on each.
    const box = await screen.findByRole(px < 1024 ? 'list' : 'table', { name: 'All KPMs · Oct 2026' });
    const [bandung, medan] = px < 1024
      ? within(box).getAllByRole('listitem')
      : ['0417', '0555'].map((code) => within(box).getByRole('row', { name: new RegExp(code) }));
    expect(bandung).toHaveTextContent('Not enough peer KPMs (0 of 3)');
    expect(medan).toHaveTextContent('Not counted');
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Comparing KPMs needs at least 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload|unggah/i })).not.toBeInTheDocument();
    // *Changed 2026-11-20 (P19.23-T4; ADR-0278; `route-registry.md`, Perusahaan & template):* *KPM & data* is no longer a
    // tab — the page stays for old links, under *Publish to KPMs*, which is current on it.
    expect(screen.queryByRole('link', { name: 'KPMs and data' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publish to KPMs' })).toHaveAttribute('aria-current', 'page');
  });
});

/*
 * **The three new pages in ID mode** (P18.10-T7 AC-1): no English of this area left on any of them.
 */
describe('P19.4-T3 the Super Admin’s new pages in Indonesian', () => {
  const english = () => englishOnly(adminPlatformReadsMessages);

  it('P19.4-T3 AC-15 /admin/companies/[companyId]/kpms in Indonesian', async () => {
    stubFetch({
      '/admin/companies/co-1/kpms': {
        body: {
          company: { id: 'co-1', name: 'Prudential' }, month: '2026-10',
          tiles: { kpms: 1, activeOwners: 1, members: 5, notSignedIn: 0, complete: 1, needed: 3 },
          rows: [{
            kpmId: 'kpm-1', code: '0417', branch: 'Bandung', manpower: 5, maa: 2, apeYtdMinor: null, recruitmentYtd: null,
            data: 'complete', peers: { status: 'not_enough', count: 0, needed: 3 },
          }],
        },
      },
      '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer', status: 'active' }] },
    });
    renderInIndonesian(<CompanyKpmsPage params={routeParams({ companyId: 'co-1' })} />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Belum cukup KPM pembanding (0 dari 3)')).toBeInTheDocument();
    expect(englishShown(document.body, english())).toEqual([]);
  });
});

/**
 * **P19.2-T2 — *KPM & data* below 1024px** (UI-126, UI-134, UI-135): rows; the laptop keeps its table. (The comparison's
 * tests went with it, P19.23-T1.)
 */
describe('P19.2-T2 KPM & data below 1024px (UI-126, UI-134, UI-135)', () => {
  describe('KPM & data', () => {
    const VIEW = {
      company: { id: 'co-1', name: 'Prudential' }, month: '2026-10',
      tiles: { kpms: 1, activeOwners: 1, members: 30, notSignedIn: 6, complete: 1, needed: 3 },
      rows: [{
        kpmId: 'kpm-1', code: '0417', branch: 'Bandung', manpower: 30, maa: 12, apeYtdMinor: 150_000_000_000, recruitmentYtd: 9,
        data: 'complete', peers: { status: 'not_enough', count: 0, needed: 3 },
      }],
    };
    const show = () => {
      nav.pathname = '/admin/companies/co-1/kpms';
      stubFetch({
        '/admin/companies/co-1/kpms': { body: VIEW },
        '/admin/companies': { body: [{ _id: 'co-1', name: 'Prudential', kind: 'insurer', status: 'active' }] },
      });
      renderInLayout(AdminLayout, <CompanyKpmsPage params={routeParams({ companyId: 'co-1' })} />, { me: SUPER_ADMIN });
    };

    it.each([375, 768])('P19.2-T2 AC-1 at %ipx a row per KPM: KPM 0417 opening it, the branch, the figures, the data status', async (px) => {
      atWidth(px);
      show();
      const list = await screen.findByRole('list', { name: 'All KPMs · Oct 2026' });
      expect(screen.queryByRole('table')).toBeNull();
      const [row] = within(list).getAllByRole('listitem');
      expect(within(row).getByRole('link', { name: 'KPM 0417' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
      expect(row).toHaveTextContent('Bandung');
      expect(row).toHaveTextContent('Manpower 30 · Active agents (MAA) 12');
      expect(row).toHaveTextContent('Recruitment YTD 9');
      expect(within(row).getByText('Complete')).toBeInTheDocument();
    });

    it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the table at the content’s width', async (px) => {
      atWidth(px);
      show();
      const table = await screen.findByRole('table', { name: 'All KPMs · Oct 2026' });
      expect(table.className).not.toMatch(/min-w-\[/);
    });

    it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
      atWidth(px);
      show();
      await screen.findByRole('list', { name: 'All KPMs · Oct 2026' });
      expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
    });

    it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
      atWidth(px);
      show();
      await screen.findByText(/0417/);
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect(results.violations).toEqual([]);
    });
  });
});
