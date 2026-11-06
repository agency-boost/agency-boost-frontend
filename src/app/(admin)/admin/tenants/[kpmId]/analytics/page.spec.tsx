import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Me } from '@/lib/session';
import { makeMe, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import LookAsKpmPage from './page';

const search = { current: new URLSearchParams('tab=advanced&section=subgroup') };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenants/kpm-9/analytics',
  useSearchParams: () => search.current,
}));

const SUPER_ADMIN: Me = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null, pronoun: 'they', initials: 'R',
    platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['platform_kpm_figures:read'],
});

const SHELL = {
  templateName: 'Prudential standar', version: 2, canWrite: false, canUpload: false,
  sections: [{ kode: 'MAPA', slug: 'mapa' }, { kode: 'SUBGROUP', slug: 'subgroup' }, { kode: 'NPS', slug: 'nps' }, { kode: 'EVENTS', slug: 'events' }],
};
const SUBGROUP = {
  month: '2026-11', thresholds: { okPct: 80, powerUserDays: 10, powerUserWindow: 30 }, canWrite: false,
  rows: [{
    head: { membershipId: 'ab-1', name: 'Agus Prasetyo' }, manpower: 12, leaders: 3,
    maa: { baseline: 4.5, lastMonth: 5, mtd: 3, asOf: null }, targets: { aa: 3, rec: 6, isDefault: true },
    adoption: { headDays: 18, downlinePct: 64 }, powerUsers: 4, oneOnOnesPerWeek: 1.8, weeklyActivityTarget: 6,
    recruitment: { baseline: 9, ytd: 5, missingMonths: [] }, attainment: { aaPct: 100, aaOk: true, recPct: 83, recOk: true },
  }],
};

/**
 * ***Lihat sebagai KPM*'s *Advanced analytics* tab** (P19.5-T3 AC-12; ADR-0215 §9): the KPM's sections as its Owner
 * sees them, through the platform read, under the navy *Hanya lihat* banner — and no control that writes.
 */
describe('P19.5-T3 AC-12 the Super Admin’s Advanced analytics tab', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.5-T3 AC-12 the third tab, the KPM’s sections in its template’s order, read-only', async () => {
    const { calls } = stubFetch({
      'GET /admin/tenants/kpm-9/advanced-analytics/subgroup': { body: SUBGROUP },
      'GET /admin/tenants/kpm-9/advanced-analytics': { body: SHELL },
      'GET /admin/tenants/kpm-9': { body: { id: 'kpm-9', code: '0417', branchName: 'BSD' } },
    });
    const { container } = renderInIndonesian(<LookAsKpmPage params={routeParams({ kpmId: 'kpm-9' })} />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Agus Prasetyo')).toBeInTheDocument();
    const outer = screen.getByRole('navigation', { name: 'Analitik KPM' });
    expect(within(outer).getByRole('link', { name: 'Advanced analytics' })).toHaveAttribute('aria-current', 'page');
    const inner = within(screen.getByRole('navigation', { name: 'Bagian Advanced analytics' })).getAllByRole('link');
    expect(inner.map((a) => a.textContent)).toEqual(['MAPA driver', 'Perbaikan sub-group', 'NPS', 'Event']);
    expect(inner[1]).toHaveAttribute('href', '/admin/tenants/kpm-9/analytics?tab=advanced&section=subgroup');
    expect(screen.getByText('Hanya lihat')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ubah target' })).toBeNull();
    expect(calls.every((c) => !c.url.includes('/kpm/advanced-analytics'))).toBe(true);
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});
