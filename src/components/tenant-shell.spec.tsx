import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { PHONE_QUERY } from '@/lib/use-phone';
import { ImpersonationBanner } from './impersonation-banner';
import { TenantShell } from './tenant-shell';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
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

  it('P18.8-T6 AC-2 the profile line: KPM Owner · Core Leader · the groups · the office', () => {
    const owner = tenantAdmin(true, 2);
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: makeMe({
        ...owner,
        membership: { ...owner.membership!, isCoreLeader: true, groups: ['Top Producers 2026'], office: { code: '0417', branch: 'Cempaka Putih' } },
      }),
    });
    expect(screen.getByText('KPM Owner · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih'))
      .toHaveAttribute('title', 'KPM Owner · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih');
  });

  it('P18.8-T6 AC-2 an Admin in no group, untagged: KPM Admin · the office', () => {
    const admin = tenantAdmin(false);
    renderWithSession(<TenantShell title="All members">body</TenantShell>, {
      me: makeMe({ ...admin, membership: { ...admin.membership!, isCoreLeader: false, groups: [], office: { code: '0417', branch: 'Cempaka Putih' } } }),
    });
    expect(screen.getByText('KPM Admin · 0417 · Cempaka Putih')).toBeInTheDocument();
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

  it.each([['the Owner', true], ['the Admin', false]])(
    'P18-T2 AC-1 gives %s Reporting › KPM analytics, live, and keeps Advanced analytics Upcoming',
    (_who, isOwner) => {
      // An `upcoming` item renders an anchor with no href: no link role, so a flag left on would fail this.
      renderWithSession(<TenantShell title="KPM Analytics">body</TenantShell>, { me: tenantAdmin(isOwner) });
      openGroup(/^Reporting/);

      expect(screen.getByRole('link', { name: 'KPM analytics' })).toHaveAttribute('href', '/kpm/analytics');
      expect(screen.queryByRole('link', { name: /Advanced analytics/ })).not.toBeInTheDocument();
      expect(screen.getByText('Advanced analytics').closest('a')).toHaveAttribute('aria-disabled');
    },
  );

  it.each([['the Owner', true], ['the Admin', false]])(
    'P18.1-T2 gives %s Leader Meetings › Strategic Leader Forum, live',
    (_who, isOwner) => {
      // An `upcoming` item renders an anchor with no href: no link role, so a flag left on would fail this.
      renderWithSession(<TenantShell title="Strategic Leader Forum">body</TenantShell>, { me: tenantAdmin(isOwner) });
      openGroup(/^Leader Meetings/);

      const item = screen.getByRole('link', { name: 'Strategic Leader Forum' });
      expect(item).toHaveAttribute('href', '/leader-meetings');
      expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
    },
  );

  it.each([['the Owner', true], ['the Admin', false]])(
    'P17-T5 AC-1 gives %s Settings › Recruitment pitch, right after Products',
    (_who, isOwner) => {
      renderWithSession(<TenantShell title="Recruitment pitch">body</TenantShell>, { me: tenantAdmin(isOwner) });
      openGroup(/^Settings/);

      const item = screen.getByRole('link', { name: 'Recruitment pitch' });
      expect(item).toHaveAttribute('href', '/kpm/settings/recruitment-pitch');
      const settings = within(item.closest('ul') as HTMLElement).getAllByRole('link').map((a) => a.textContent?.trim());
      expect(settings.indexOf('Recruitment pitch')).toBe(settings.indexOf('Products') + 1);
      expect(item.querySelector('svg')).not.toBeNull();
    },
  );
});

describe('Open agent view, in the identity menu (P13.2-T5, ADR-0114)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const chip = () => screen.getByRole('button', { name: /Rina/ });
  const panel = () => document.getElementById('sidebar-user-actions')!;
  /** The panel's links, in order, by their text. */
  const links = () => within(panel()).getAllByRole('link').map((a) => a.textContent);

  it('P13.2-T5 AC-1, P15-T4 AC-4 takes an Owner who leads people to their Unit Dashboard, above Your account', async () => {
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me: tenantAdmin(true, 3) });
    // Not a nav item: the console's nav is `KPM_Owner.html`'s, and has none of the field's.
    expect(screen.queryByRole('link', { name: 'Open agent view' })).not.toBeInTheDocument();
    await userEvent.click(chip());

    // Their field landing, the one function the sign-in uses (ADR-0114, D-landing).
    expect(within(panel()).getByRole('link', { name: 'Open agent view' })).toHaveAttribute('href', '/unit/dashboard');
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
    expect(within(panel()).getByRole('link', { name: 'Open agent view' })).toHaveAttribute('href', '/unit/dashboard');
  });

  it('P13.2-T5 AC-2 offers nothing to a reader who neither owns nor administers the office: they are never in the console', () => {
    /*
     * The shell followed the route group, so an AB whose grants passed the console's gate wore it, menu and all
     * — the leak of the product owner's report (2026-10-11). The console now admits only the Owner and the
     * Admins (`familyAllows`): an AB is sent to their own landing, and there is no menu to offer them anything.
     */
    const ab = makeMe({
      membership: {
        membershipId: 'mem-2', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['member:read_profile'],
    });
    router.replace.mockClear();
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me: ab });
    expect(router.replace.mock.calls).toEqual([['/unit/dashboard']]);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('P13.2-T5 AC-3, P18.95-T2 AC-4 on a phone opens the avatar’s menu with the switch before Your account — no nav', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query,
      matches: query === PHONE_QUERY,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })));
    renderWithSession(<TenantShell title="All members">body</TenantShell>, { me: tenantAdmin(true, 3) });
    // The bar's chip is the avatar alone since P18.95-T12, named for the account and the notices.
    await userEvent.click(screen.getByRole('button', { name: /^Account and notifications/ }));

    // The nav is the drawer ☰ opens (P18.95-T2); the menu keeps the account's items, after the notices (P18.95-T12).
    expect(within(panel()).queryByRole('navigation')).not.toBeInTheDocument();
    const viewSwitch = within(panel()).getByRole('link', { name: 'Open agent view' });
    const account = within(panel()).getByRole('link', { name: 'Your account' });
    expect(links()).toEqual(['Notifications', 'Open agent view', 'Your account']);
    expect(viewSwitch.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});

/**
 * **A setup session's banner stays on a phone** (P18.95-T2; ADR-0162): the banner sits above the shell, in the
 * root layout, and ☰ and its drawer change nothing about it.
 */
describe('the support banner over the phone’s bar (P18.95-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.95-T2 AC-1 keeps a setup session’s banner above the bar with ☰, open and closed', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: () => undefined, removeEventListener: () => undefined,
    })));
    const me = {
      ...tenantAdmin(true, 3), isImpersonating: true, impersonationReadOnly: true,
      impersonationPurpose: 'setup' as const, impersonatedBy: 'u-support',
    };
    renderWithSession(<><ImpersonationBanner /><TenantShell title="All members">body</TenantShell></>, { me });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('This is a setup session');
    // Above the bar in the reading order, as it is on screen.
    const burger = screen.getByRole('button', { name: 'Open menu' });
    expect(banner.compareDocumentPosition(burger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(burger);
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    expect(banner).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('status')).toHaveTextContent('Stop acting as them');
  });
});
