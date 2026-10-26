import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
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

describe('KPM Owners & Admins (P3.5-T12)', () => {
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
