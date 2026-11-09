import { screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import TenantAdminsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenant-admins',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm_admin:list_platform'],
});

const row = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', fullName: 'Wilson Tanoto', email: 'wilson@kpm0417.test',
  initials: 'WT', kpmId: 'kpm-1', kpmLabel: 'KPM 0417 — BSD City Branch',
  isOwner: true, isAdmin: false, grantedAt: null, ...over,
});

describe('KPM Owners & Admins (P3.1-T12)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: names the person, their office, and what access they hold', async () => {
    stubFetch({ '/admin/tenant-admins': { body: [row()] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getByText('KPM 0417 — BSD City Branch')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it("AC-1: says an Owner's rights came with the office, rather than leaving a blank", async () => {
    // A blank date would read as missing data. An Owner has no grant date because
    // nobody granted it — the office did.
    stubFetch({ '/admin/tenant-admins': { body: [row()] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('With the office')).toBeInTheDocument();
  });

  it('AC-1: dates a delegated Admin, because somebody granted that', async () => {
    stubFetch({
      '/admin/tenant-admins': {
        body: [row({ fullName: 'Agus Prasetyo', isOwner: false, isAdmin: true, grantedAt: '2026-09-01T00:00:00.000Z' })],
      },
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('1 Sep 2026')).toBeInTheDocument();
  });

  it('AC-2: offers no control, and says why', async () => {
    // Granting and revoking stay inside the office. A platform screen that could hand
    // out office administration would route around a decision the office owns.
    stubFetch({ '/admin/tenant-admins': { body: [row()] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText(/This is a view, not a control/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Grant|Revoke/ })).toBeNull();
  });

  it('says no office has one yet, rather than showing an empty table', async () => {
    stubFetch({ '/admin/tenant-admins': { body: [] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('No office has an administrator yet.')).toBeInTheDocument();
  });
});

/** **P19.2-T2 — the list below 1024px** (UI-126): one row per person, read only; the laptop keeps its table. */
describe('P19.2-T2 KPM Owners & Admins below 1024px (UI-126, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ROWS = [
    row(),
    row({ membershipId: 'mem-2', fullName: 'Agus Prasetyo', email: 'agus@kpm0417.test', isOwner: false, isAdmin: true, grantedAt: '2026-09-01T00:00:00.000Z' }),
  ];
  const show = () => {
    stubFetch({ '/admin/tenant-admins': { body: ROWS } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
  };

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx draws a row per person: the name, email · office, the grant, the pills', async (px) => {
    atWidth(px);
    show();
    const list = await screen.findByRole('list', { name: 'Office administrators' });
    expect(screen.queryByRole('table')).toBeNull();
    const [owner, admin] = within(list).getAllByRole('listitem');
    expect(wears(owner, px)).toContain('min-h-14');
    expect(owner).toHaveTextContent('Wilson Tanoto');
    expect(owner).toHaveTextContent('wilson@kpm0417.test · KPM 0417 — BSD City Branch');
    expect(owner).toHaveTextContent('With the office');
    expect(within(owner).getByText('Owner')).toBeInTheDocument();
    expect(admin).toHaveTextContent('Granted 1 Sep 2026');
    expect(within(admin).getByText('Admin')).toBeInTheDocument();
    // A view, not a control (P3.1-T12 AC-2): nothing on a row to press.
    expect(within(list).queryByRole('button')).toBeNull();
    expect(within(list).queryByRole('link')).toBeNull();
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the table', async (px) => {
    atWidth(px);
    show();
    expect(await screen.findByRole('table', { name: 'Office administrators' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Office administrators' })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Office administrators' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    show();
    await screen.findByText('Agus Prasetyo');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
