import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { TenantShell } from './tenant-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const tenantAdmin = (isKpmOwner: boolean) =>
  makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner, isKpmAdmin: !isKpmOwner, directCount: 0,
    },
    permissions: ['member:read_profile'],
  });

describe('the tenant shell (P3-T10 AC-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the Owner everything, including the owner-reserved items', () => {
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: tenantAdmin(true),
    });
    expect(screen.getByRole('link', { name: 'Manage KPM admins' })).toBeInTheDocument();
    expect(screen.getByText('Branch info')).toBeInTheDocument();
    expect(screen.getByText('KPM Owner')).toBeInTheDocument();
  });

  it('hides the owner-reserved item from an Admin entirely', () => {
    // roles-and-permissions.md §1.6: hidden, not shown-and-refused. The API still
    // decides — hiding a nav item is a courtesy, not a control.
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: tenantAdmin(false),
    });
    expect(screen.queryByRole('link', { name: 'Manage KPM admins' })).not.toBeInTheDocument();

    // Branch info was hidden too, until ADR-0027 gave the Admin its write.
    expect(screen.getByRole('link', { name: 'Branch info' })).toBeInTheDocument();

    // Everything else they do have is still there.
    expect(screen.getByRole('link', { name: 'All members' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Org tree' })).toBeInTheDocument();
    expect(screen.getByText('KPM Admin')).toBeInTheDocument();
  });
});
