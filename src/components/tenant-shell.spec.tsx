import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { PHONE_QUERY } from '@/lib/use-phone';
import { TenantShell } from './tenant-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const tenantAdmin = (isKpmOwner: boolean, directCount = 0) =>
  makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner, isKpmAdmin: !isKpmOwner, directCount,
    },
    permissions: ['member:read_profile'],
  });

/**
 * **Every group starts open** (P10.1-T3, client item 3), so a group's items are there on the
 * first render. This clicked a heading to open it while one group at a time was the rule; a click
 * would now close it, so this asserts the group is open instead of opening it.
 */
function openGroup(name: RegExp) {
  expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true');
}

describe('the tenant shell (P3-T10 AC-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the Owner everything, including the owner-reserved items', () => {
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: tenantAdmin(true),
    });
    openGroup(/^People/);
    expect(screen.getByRole('link', { name: 'Manage KPM admins' })).toBeInTheDocument();

    openGroup(/^Settings/);
    expect(screen.getByText('Branch info')).toBeInTheDocument();
    expect(screen.getByText('KPM Owner')).toBeInTheDocument();
  });

  it('hides the owner-reserved item from an Admin entirely', () => {
    // roles-and-permissions.md §1.6: hidden, not shown-and-refused. The API still
    // decides — hiding a nav item is a courtesy, not a control.
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: tenantAdmin(false),
    });
    openGroup(/^People/);
    expect(screen.queryByRole('link', { name: 'Manage KPM admins' })).not.toBeInTheDocument();

    // Branch info was hidden too, until ADR-0027 gave the Admin its write.
    openGroup(/^Settings/);
    expect(screen.getByRole('link', { name: 'Branch info' })).toBeInTheDocument();

    // Everything else they do have is still there.
    openGroup(/^People/);
    expect(screen.getByRole('link', { name: 'All members' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Org tree' })).toBeInTheDocument();
    expect(screen.getByText('KPM Admin')).toBeInTheDocument();
  });

  it('reaches Settings › Activation checklist, which is no longer Upcoming (P5-T3)', () => {
    renderWithSession(<TenantShell title="Activation">body</TenantShell>, { me: tenantAdmin(false) });
    openGroup(/^Settings/);

    expect(screen.getByRole('link', { name: 'Activation checklist' }))
      .toHaveAttribute('href', '/kpm/settings/activation-checklist');
  });

  it('reaches Settings › Training, which is no longer Upcoming (P5-T1)', () => {
    // An `upcoming` item renders an anchor with no href — no link role, and reachable from
    // nowhere — so a flag left on after the screen shipped would fail this.
    renderWithSession(<TenantShell title="Training">body</TenantShell>, { me: tenantAdmin(false) });
    openGroup(/^Settings/);

    expect(screen.getByRole('link', { name: 'Training' })).toHaveAttribute('href', '/kpm/settings/training');
  });
});

describe('Open agent view, in the identity menu (P13.2-T5, ADR-0114)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const chip = () => screen.getByRole('button', { name: /Rina/ });
  const panel = () => document.getElementById('sidebar-user-actions')!;
  /** The panel's links, in order, by their text. */
  const links = () => within(panel()).getAllByRole('link').map((a) => a.textContent);

  it('P13.2-T5 AC-1 takes an Owner who leads people to the roster, above Your account', async () => {
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me: tenantAdmin(true, 3) });
    // Not a nav item: the console's nav is `KPM_Owner.html`'s, and has none of the field's.
    expect(screen.queryByRole('link', { name: 'Open agent view' })).not.toBeInTheDocument();
    await userEvent.click(chip());

    expect(within(panel()).getByRole('link', { name: 'Open agent view' })).toHaveAttribute('href', '/coaching');
    expect(links()).toEqual(['Open agent view', 'Your account']);
  });

  it('P13.2-T5 AC-1 takes an Admin who leads nobody to their own day', async () => {
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me: tenantAdmin(false, 0) });
    await userEvent.click(chip());
    expect(within(panel()).getByRole('link', { name: 'Open agent view' })).toHaveAttribute('href', '/activity/log');
  });

  it('P13.2-T5 AC-5 offers a support session impersonating an Owner the same link', async () => {
    const me = { ...tenantAdmin(true, 3), isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-support' };
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me });
    await userEvent.click(chip());
    expect(within(panel()).getByRole('link', { name: 'Open agent view' })).toHaveAttribute('href', '/coaching');
  });

  it('P13.2-T5 AC-2 offers nothing to a reader of the console who neither owns nor administers the office', async () => {
    // The shell follows the route group, so an AB whose grants pass a console route's gate wears it.
    const ab = makeMe({
      membership: {
        membershipId: 'mem-2', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile'],
    });
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me: ab });
    await userEvent.click(chip());
    expect(links()).toEqual(['Your account']);
  });

  it('P13.2-T5 AC-3 on a phone sits after the nav groups and before Your account', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query,
      matches: query === PHONE_QUERY,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })));
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me: tenantAdmin(true, 3) });
    await userEvent.click(chip());

    const nav = within(panel()).getByRole('navigation', { name: 'Main' });
    const viewSwitch = within(panel()).getByRole('link', { name: 'Open agent view' });
    const account = within(panel()).getByRole('link', { name: 'Your account' });
    expect(nav.compareDocumentPosition(viewSwitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav.contains(viewSwitch)).toBe(false);
    // Directly before *Your account*: the last two links of the panel.
    expect(links().slice(-2)).toEqual(['Open agent view', 'Your account']);
    expect(viewSwitch.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
