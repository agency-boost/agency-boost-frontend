import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/**
 * One group is open at a time (client feedback, 2026-09-24), and the group holding the page
 * you are on opens itself — so a test cannot know which is already open. Opening an open one
 * would close it, which is why this asks before it clicks.
 */
async function openGroup(name: RegExp) {
  const header = screen.getByRole('button', { name });
  if (header.getAttribute('aria-expanded') !== 'true') await userEvent.click(header);
}

describe('the tenant shell (P3-T10 AC-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the Owner everything, including the owner-reserved items', async () => {
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: tenantAdmin(true),
    });
    await openGroup(/^People/);
    expect(screen.getByRole('link', { name: 'Manage KPM admins' })).toBeInTheDocument();

    await openGroup(/^Settings/);
    expect(screen.getByText('Branch info')).toBeInTheDocument();
    expect(screen.getByText('KPM Owner')).toBeInTheDocument();
  });

  it('hides the owner-reserved item from an Admin entirely', async () => {
    // roles-and-permissions.md §1.6: hidden, not shown-and-refused. The API still
    // decides — hiding a nav item is a courtesy, not a control.
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: tenantAdmin(false),
    });
    await openGroup(/^People/);
    expect(screen.queryByRole('link', { name: 'Manage KPM admins' })).not.toBeInTheDocument();

    // Branch info was hidden too, until ADR-0027 gave the Admin its write.
    await openGroup(/^Settings/);
    expect(screen.getByRole('link', { name: 'Branch info' })).toBeInTheDocument();

    // Everything else they do have is still there.
    await openGroup(/^People/);
    expect(screen.getByRole('link', { name: 'All members' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Org tree' })).toBeInTheDocument();
    expect(screen.getByText('KPM Admin')).toBeInTheDocument();
  });

  it('reaches Settings › Activation checklist, which is no longer Upcoming (P5-T3)', async () => {
    renderWithSession(<TenantShell title="Activation">body</TenantShell>, { me: tenantAdmin(false) });
    await openGroup(/^Settings/);

    expect(screen.getByRole('link', { name: 'Activation checklist' }))
      .toHaveAttribute('href', '/kpm/settings/activation-checklist');
  });

  it('reaches Settings › Training, which is no longer Upcoming (P5-T1)', async () => {
    // An `upcoming` item renders an anchor with no href — no link role, and reachable from
    // nowhere — so a flag left on after the screen shipped would fail this.
    renderWithSession(<TenantShell title="Training">body</TenantShell>, { me: tenantAdmin(false) });
    await openGroup(/^Settings/);

    expect(screen.getByRole('link', { name: 'Training' })).toHaveAttribute('href', '/kpm/settings/training');
  });
});
