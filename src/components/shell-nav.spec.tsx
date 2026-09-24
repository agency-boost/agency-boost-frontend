import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { AgentShell } from './agent-shell';
import { AdminShell } from './admin-shell';
import { TenantShell } from './tenant-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/group-tree',
}));

/**
 * Section order, not just presence.
 *
 * Presence tests passed for months while the agent sidebar carried two invented sections
 * in the wrong order and the KPM Owner's People and Settings were swapped. Order is the
 * thing that drifts, so order is the thing asserted.
 */
function navLabels() {
  const nav = screen.getByRole('navigation', { name: 'Main' });
  // Group headings are buttons now, not paragraphs: the sidebar collapses one group at a
  // time (client feedback, 2026-09-24). The chevron is part of the button's text.
  return Array.from(nav.querySelectorAll('[aria-controls^="nav-group"], a'))
    .map((el) => (el.textContent ?? '').replace('\u25b8', '').trim());
}

/**
 * Open every group in turn and collect what each holds.
 *
 * One group is open at a time, so a test that wants every destination has to walk them.
 * That is the accordion doing its job; asserting around it would assert a nav nobody has.
 */
async function everyItem() {
  const nav = () => screen.getByRole('navigation', { name: 'Main' });
  const names = Array.from(nav().querySelectorAll('[aria-controls^="nav-group"]'))
    .map((b) => (b.textContent ?? '').replace('\u25b8', '').trim());

  const items = Array.from(nav().querySelectorAll('a')).map((a) => a as HTMLAnchorElement);
  for (const name of names) {
    await userEvent.click(within(nav()).getByRole('button', { name: new RegExp(`^${name}`) }));
    items.push(...Array.from(nav().querySelectorAll('a')).map((a) => a as HTMLAnchorElement));
  }
  // The unheaded group is always open, so its links arrive more than once.
  return [...new Map(items.map((a) => [a.textContent + a.getAttribute('href'), a])).values()];
}

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: [],
});

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['member:read_profile'],
});

describe('the sidebar matches the prototype', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('carries the product mark, not a bare wordmark', () => {
    // The 26x26 org-chart mark is in all fifteen prototype files; we rendered none.
    const { container } = renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const svg = container.querySelector('svg[viewBox="0 0 26 26"]');
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll('circle')).toHaveLength(3);
    expect(screen.getByText('AgencyBoost')).toBeInTheDocument();
  });

  it('agent app: the prototype eight sections, in order, with Admin last', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const sections = navLabels().filter((t) =>
      ['Personal tools', 'Unit tools', 'New agent', 'Training', 'Sales tools', 'KPM', 'Campaign', 'Admin'].includes(t),
    );
    expect(sections).toEqual([
      'Personal tools', 'Unit tools', 'New agent', 'Training', 'Sales tools', 'KPM', 'Campaign', 'Admin',
    ]);
  });

  it('agent app: Group tree comes before User management inside Admin', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const labels = navLabels();
    expect(labels.indexOf('Group tree')).toBeLessThan(labels.indexOf('User management'));
  });

  it('agent app: the shell carries no User Management sub-tabs', () => {
    // Three screens used to show them — the group tree, the unit dashboard and the
    // activity log — tabs for a module they are not part of. That was fixed with a
    // `subtabs` opt-in; route groups then made the opt-in unnecessary. A layout renders
    // for everything beneath it, so a strip that belongs to four of its routes belongs to
    // those four: `UserManagementTabs`, rendered by the page.
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    expect(screen.queryByRole('link', { name: 'Register KPM' })).not.toBeInTheDocument();
  });

  it('agent app: the nav item carries no count', () => {
    // P3.5-T5 AC-3: no prototype puts a badge inside a nav anchor — `tab-badge` appears
    // only on the sub-tab. The specified one lives on Pending Requests and still does.
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const item = screen.getByText('User management').closest('a')!;
    expect(item.textContent).toBe('User management');
  });

  it('agent app: an unbuilt item is disabled and keeps its pill', async () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    // The route is `/group-tree`, so `Admin` is the group that opens itself. One group is
    // open at a time, so reaching another is a click.
    await userEvent.click(screen.getByRole('button', { name: /^Personal tools/ }));
    const leads = screen.getByText('Leads management').closest('a')!;
    expect(leads).toHaveAttribute('aria-disabled');
    expect(within(leads).getByText('Upcoming')).toBeInTheDocument();
  });

  it('KPM Owner: Overview alone at the top, People last, and no invented Office group', () => {
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    const labels = navLabels();
    const sections = labels.filter((t) =>
      ['Reporting', 'Leader Meetings', 'Settings', 'People', 'Office'].includes(t),
    );
    expect(sections).toEqual(['Reporting', 'Leader Meetings', 'Settings', 'People']);
    // Overview is the first thing in the nav, above the first section heading.
    expect(labels.indexOf('Overview')).toBeLessThan(labels.indexOf('Reporting'));
  });

  it('KPM Owner: Overview is reachable — it is built', () => {
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/kpm/overview');
  });

  it('KPM Owner: Ratio benchmarks is not a sidebar item — it is a sub-tab', () => {
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.queryByText('Ratio benchmarks')).not.toBeInTheDocument();
  });

  it('KPM Owner: names the app under the wordmark', () => {
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.getByText('KPM OWNER')).toBeInTheDocument();
  });

  it('Superadmin: five groups in the prototype order, and its own pill word', () => {
    renderWithSession(
      <AdminShell title="x">body</AdminShell>,
      { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
    );
    const labels = navLabels();
    expect(labels.filter((t) => ['Companies', 'KPMs', 'Platform admin', 'Reporting'].includes(t)))
      .toEqual(['Companies', 'KPMs', 'Platform admin', 'Reporting']);
    expect(labels.indexOf('Overview')).toBeLessThan(labels.indexOf('Companies'));
    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
  });

  it('Superadmin: says Soon where the KPM Owner app says Upcoming', async () => {
    // Each prototype writes its own word. The only unbuilt console destination left is
    // `Cross-platform analytics`, and `Reporting` is not the group that opens first — so
    // the word is reached by opening it, which is the accordion working.
    renderWithSession(
      <AdminShell title="x">body</AdminShell>,
      { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
    );
    await userEvent.click(screen.getByRole('button', { name: /^Reporting/ }));

    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0);
  });

  it('every built Superadmin destination is a real link', async () => {
    // `upcoming` renders an anchor with no href, so a flag left on after the screen
    // shipped makes it reachable from nowhere. That is what happened to
    // /admin/kpm-requests: the screen, its endpoints and its manual chapter all shipped
    // in P3.5-T2 while the nav item stayed inert. Nothing caught it, because the nav
    // spec asserted section order and the screen spec asserted screen behaviour.
    renderWithSession(
      <AdminShell title="x">body</AdminShell>,
      { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
    );

    /*
     * `Create / assign KPM` and `Product catalog` are deliberately **not** here since
     * 2026-09-24. The first was a third route to a form `/admin/tenants` already offers
     * twice; the second pointed at `/admin/products`, which ADR-0033 removed from the route
     * registry when the catalog moved to the Company template's Products tab.
     */
    for (const name of [
      'Overview', 'Manage companies', 'All KPMs',
      'Pending KPM requests', 'KPM Owners & Admins',
      'Audit / role change log',
    ]) {
      const item = (await everyItem()).find((a) => a.textContent?.trim() === name);
      expect(item, `${name} is not in the nav`).toBeDefined();
      expect(item).toHaveAttribute('href');
    }
  });

  describe('every destination carries a glyph (client feedback, 2026-09-24)', () => {
    /*
     * The rail collapses to 56px and the label goes with it, so a nav item without an icon
     * is a blank square nobody notices until they collapse the sidebar — which is exactly
     * when they most need to know where they are. Asserted rather than trusted.
     */
    const SUPER = makeMe({
      user: { ...makeMe().user, platformRole: 'super_admin' },
      membership: null,
      permissions: ['kpm:list_all'],
    });
    // Thunks rather than elements: an array of JSX is an array React wants keys for, and a
    // key on a fixture says nothing about the thing under test.
    const shells = [
      ['the agent app', () => <AgentShell title="x">body</AgentShell>, AGENT],
      ['the office', () => <TenantShell title="x">body</TenantShell>, OWNER],
      ['the console', () => <AdminShell title="x">body</AdminShell>, SUPER],
    ] as const;

    it.each(shells)('%s draws one icon per item, from the registry', async (_name, shell, me) => {
      renderWithSession(shell(), { me });

      for (const item of await everyItem()) {
        const icon = item.querySelector('svg');
        expect(icon, `${item.textContent?.trim()} has no icon`).not.toBeNull();
        expect(icon!.getAttribute('viewBox')).toBe('0 0 24 24');
      }
    });
  });
});
