import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { AgentShell } from './agent-shell';
import { AdminShell } from './admin-shell';
import { TenantShell } from './tenant-shell';

// Mutable so one test can stand on a typed URL; every other test reads `/group-tree`.
const route = vi.hoisted(() => ({ path: '/group-tree' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => route.path,
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
  // Group headings are buttons, not paragraphs: each group opens and closes on its own
  // (client feedback, 2026-09-24 and 2026-09-29). The chevron is part of the button's text.
  return Array.from(nav.querySelectorAll('[aria-controls^="nav-group"], a'))
    .map((el) => (el.textContent ?? '').replace('\u25b8', '').trim());
}

/**
 * Every destination in the nav, as the reader first sees it.
 *
 * **Every group starts open** (P10.1-T3, client item 3), so the whole nav is on the first render
 * with nothing to click. This walked the groups one at a time while opening one closed the rest;
 * reading them without a click is now the assertion that they start open.
 */
async function everyItem() {
  const nav = screen.getByRole('navigation', { name: 'Main' });
  const headers = Array.from(nav.querySelectorAll('[aria-controls^="nav-group"]'));
  expect(headers.every((b) => b.getAttribute('aria-expanded') === 'true')).toBe(true);
  return Array.from(nav.querySelectorAll('a')).map((a) => a as HTMLAnchorElement);
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
    // Every group starts open (P10.1-T3), so no click reaches it. Personal summary was this
    // example until P10-T4 built it.
    const training = screen.getByText('Training modules').closest('a')!;
    expect(training).toHaveAttribute('aria-disabled');
    expect(within(training).getByText('Upcoming')).toBeInTheDocument();
  });

  it('agent app: Unit dashboard is Upcoming, as Coaching session is — its page is a sign (P10.1-T2)', async () => {
    // The client, 2026-10-01: a page that is not ready says so like the others. It was a live link
    // to the sign with no pill, beside a Coaching session that had one. On its own typed URL it is
    // still not the current item: an upcoming item is never where the reader is.
    route.path = '/unit/dashboard';
    try {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
      const unit = screen.getByText('Unit dashboard').closest('a')!;
      expect(unit).toHaveAttribute('aria-disabled');
      expect(unit).not.toHaveAttribute('href');
      expect(unit).not.toHaveAttribute('aria-current');
      // An inert anchor never carries `aria-current`, so the tint is what would show it as here.
      expect(unit.className).not.toContain('bg-amber/15');
      expect(within(unit).getByText('Upcoming')).toBeInTheDocument();
    } finally {
      route.path = '/group-tree';
    }
  });

  it('agent app: Personal summary is a live link, not a pill (P10-T4)', async () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const summary = screen.getByText('Personal summary').closest('a')!;
    expect(summary).toHaveAttribute('href', '/summary');
    expect(summary).not.toHaveAttribute('aria-disabled');
    expect(within(summary).queryByText('Upcoming')).not.toBeInTheDocument();
  });

  it('agent app: Goal settings is a live link, not a pill', async () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });

    const goals = screen.getByText('Goal settings').closest('a')!;
    expect(goals).toHaveAttribute('href', '/goals');
    expect(goals).not.toHaveAttribute('aria-disabled');
    expect(within(goals).queryByText('Upcoming')).not.toBeInTheDocument();
  });

  it('agent app: Leads management is a live link, not a pill', async () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });

    const leads = screen.getByText('Leads management').closest('a')!;
    expect(leads).toHaveAttribute('href', '/leads');
    expect(leads).not.toHaveAttribute('aria-disabled');
    expect(within(leads).queryByText('Upcoming')).not.toBeInTheDocument();
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
    // `Cross-platform analytics`, in `Reporting`, which starts open like every group (P10.1-T3).
    renderWithSession(
      <AdminShell title="x">body</AdminShell>,
      { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
    );
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

describe('a line between every two groups, in all three shells (parity I-144)', () => {
  /*
   * The Owner's and the Super Admin's prototypes draw a line before every group; the agent's drew
   * two. Once every group became a toggle of its own (P10.1-T3), a heading with no line above it
   * read as part of the group before it, and the client asked for one rule everywhere
   * (2026-09-30). Asserted by count and by position, so a shell that drops one, or draws one
   * under its last group, fails.
   */
  const SUPER = makeMe({
    user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
  });
  const SHELLS = [
    ['agent', () => renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT })],
    ['KPM Owner', () => renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER })],
    ['Superadmin', () => renderWithSession(<AdminShell title="x">body</AdminShell>, { me: SUPER })],
  ] as const;

  it.each(SHELLS)('%s: every group but the last ends with a line', (_shell, render) => {
    render();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const sections = Array.from(nav.children);

    expect(within(nav).getAllByRole('separator')).toHaveLength(sections.length - 1);
    sections.forEach((section, i) => {
      expect(section.lastElementChild?.getAttribute('role') === 'separator').toBe(i < sections.length - 1);
    });
  });
});
