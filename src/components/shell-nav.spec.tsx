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
  // A leader still in their own activation, with hires of their own: every section is offered.
  activation: { open: true, complete: false },
  newHires: true,
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

  it('agent app: the prototype nine sections, in order, with Admin last', () => {
    // `Overall.html`'s eight, and *Recruitment tools* after *Sales tools* (`Recruitment_Section.html:251-254`, P17-T3 AC-1).
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const sections = navLabels().filter((t) =>
      ['Personal tools', 'Unit tools', 'New agent', 'Training', 'Sales tools', 'Recruitment tools', 'KPM', 'Campaign', 'Admin']
        .includes(t),
    );
    expect(sections).toEqual([
      'Personal tools', 'Unit tools', 'New agent', 'Training', 'Sales tools', 'Recruitment tools', 'KPM', 'Campaign', 'Admin',
    ]);
  });

  it('agent app: Group tree comes before User management inside Admin', () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const labels = navLabels();
    expect(labels.indexOf('Group tree')).toBeLessThan(labels.indexOf('User management'));
  });

  describe('Unit tools and Group tree follow the graph, not the rung (P10.1-T2 AC-9, OD-23)', () => {
    /*
     * The prototype's nav is static for every rung (`Overall.html:2624-2678`), so an Agent saw
     * *Unit dashboard*, *Coaching session* and *Group tree* — the leak `roles-and-permissions.md`
     * §4.2 names. A leader is someone with an active direct report (OD-23), so the gate is
     * `directCount`, and an AAB who leads nobody is on the same side of it as an Agent: the tree
     * either would see is a leader node and themselves. Per case, because a gate keyed on the
     * role label would pass the Agent case and fail only the childless AAB.
     */
    const member = (role: 'ab' | 'aab' | 'agent', directCount: number) => makeMe({
      membership: {
        membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: role.toUpperCase(), hierarchyRole: role,
        status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount,
      },
      permissions: [],
    });
    // *New agent* follows the reader's own activation and hires (P13-T7 AC-5), which none of these has.
    const SECTIONS = ['Personal tools', 'Unit tools', 'Training', 'Sales tools', 'Recruitment tools', 'KPM', 'Campaign', 'Admin'];

    it.each([
      ['an Agent', member('agent', 0)],
      ['an AAB with no reports', member('aab', 0)],
      ['an AB with no reports', member('ab', 0)],
    ])('%s sees neither', (_who, me) => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me });
      for (const label of ['Unit tools', 'Unit dashboard', 'Coaching session', 'Group tree']) {
        expect(screen.queryByText(label), `${label} is offered`).not.toBeInTheDocument();
      }
      // The rest of Admin stays: User management is every member's. Seven sections, in order.
      expect(screen.getByText('User management').closest('a')).toHaveAttribute('href', '/user-management/kpm');
      expect(navLabels().filter((t) => SECTIONS.includes(t))).toEqual(SECTIONS.filter((s) => s !== 'Unit tools'));
    });

    it.each([
      ['an AB with reports', member('ab', 2)],
      ['an AAB with reports', member('aab', 1)],
    ])('%s sees both', (_who, me) => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me });
      // Both items under *Unit tools*, each a live link: *Unit dashboard* since the dashboard was built
      // (P15-T2 AC-1), *Coaching session* since the roster was (P11-T6 AC-7); *Group tree* a live link,
      // first in Admin.
      expect(screen.getByText('Unit dashboard').closest('a')).toHaveAttribute('href', '/unit/dashboard');
      expect(screen.getByText('Coaching session').closest('a')).toHaveAttribute('href', '/coaching');
      expect(screen.getByText('Group tree').closest('a')).toHaveAttribute('href', '/group-tree');
      const labels = navLabels();
      expect(labels.filter((t) => SECTIONS.includes(t))).toEqual(SECTIONS);
      expect(labels.indexOf('Group tree')).toBeLessThan(labels.indexOf('User management'));
    });

    it('a member with no membership: the gate fails closed, so neither is offered', () => {
      // `(membership?.directCount ?? 0) > 0`: a reader with no office is on the Agent's side of
      // the gate, not a leader's. (With no session at all the shell renders nothing, so there is
      // no nav to assert on.)
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: makeMe({ membership: null }) });
      for (const label of ['Unit tools', 'Unit dashboard', 'Coaching session', 'Group tree']) {
        expect(screen.queryByText(label), `${label} is offered`).not.toBeInTheDocument();
      }
      expect(screen.getByText('User management').closest('a')).toHaveAttribute('href', '/user-management/kpm');
    });
  });

  describe('P13-T7 AC-5 New agent shows exactly what the reader has (`Overall.html:2638-2647`, `:6638-6642`)', () => {
    const reader = (over: Partial<Parameters<typeof makeMe>[0]> = {}) => makeMe({
      membership: {
        membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 0,
      },
      ...over,
    });
    const section = () => navLabels().filter((t) => ['Your 90-day activation', 'New hires'].includes(t) || t === 'New agent');

    it('P13-T4 AC-1 a hire with an open activation sees it, live, and no New hires', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader({ activation: { open: true, complete: false } }) });
      expect(section()).toEqual(['New agent', 'Your 90-day activation']);
      const item = screen.getByText('Your 90-day activation').closest('a')!;
      expect(item).toHaveAttribute('href', '/activation');
      expect(item).not.toHaveAttribute('aria-disabled');
      expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
      // No check below 100%.
      expect(item.querySelector('[data-mark="done"]')).toBeNull();
      expect(item).toHaveAccessibleName('Your 90-day activation');
    });

    it('P13-T7 AC-5 draws the amber check at 100%, and says it', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader({ activation: { open: true, complete: true } }) });
      const item = screen.getByRole('link', { name: 'Your 90-day activation — complete' });
      const check = item.querySelector('[data-mark="done"]')!;
      expect(check).toHaveAttribute('aria-hidden', 'true');
      expect(check.getAttribute('class')).toContain('text-amber');
    });

    it('P13-T7 AC-5 marks the activation current on its own page', () => {
      route.path = '/activation';
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader({ activation: { open: true, complete: false } }) });
        expect(screen.getByText('Your 90-day activation').closest('a')).toHaveAttribute('aria-current', 'page');
      } finally {
        route.path = '/group-tree';
      }
    });

    it('P13-T5 AC-1 a reader with hires sees New hires, live, and current on a hire’s page', () => {
      route.path = '/new-hires/mem-9';
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader({ newHires: true }) });
        expect(section()).toEqual(['New agent', 'New hires']);
        const item = screen.getByText('New hires').closest('a')!;
        expect(item).toHaveAttribute('href', '/new-hires');
        expect(item).toHaveAttribute('aria-current', 'page');
      } finally {
        route.path = '/group-tree';
      }
    });

    it.each([
      ['no activation and no hires', {}],
      ['a graduated or ended activation and no hires', { activation: { open: false, complete: true } }],
    ])('P13-T7 AC-5 hides the whole section for %s', (_who, over) => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader(over) });
      expect(section()).toEqual([]);
      expect(screen.queryByText('New agent')).not.toBeInTheDocument();
    });

    it('P13-T7 AC-5 both, in the prototype’s order', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: reader({ activation: { open: true, complete: false }, newHires: true }) });
      expect(section()).toEqual(['New agent', 'Your 90-day activation', 'New hires']);
    });
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

  /*
   * P18.5-T1 AC-9 (I-150 amended): *Training modules* is live for every field rung and for the Owner and
   * the Admin in their field view, current on the list and on every module's page. It was this file's
   * example of an unbuilt item; `app-shell.spec.tsx` keeps that behaviour pinned on its own item.
   */
  describe('P18.5-T1 AC-9 Training modules is live (`Overall.html:2651`)', () => {
    it('is a link to the learner’s list, with no pill', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
      const training = screen.getByText('Training modules').closest('a')!;
      expect(training).toHaveAttribute('href', '/training');
      expect(training).not.toHaveAttribute('aria-disabled');
      expect(within(training).queryByText('Upcoming')).not.toBeInTheDocument();
    });

    it.each(['/training', '/training/SALES', '/training/SALES/CLOSING_TECHNIQUES'])('is the current item on %s', (path) => {
      route.path = path;
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
        expect(screen.getByText('Training modules').closest('a')).toHaveAttribute('aria-current', 'page');
      } finally {
        route.path = '/group-tree';
      }
    });

    it.each(['/coaching/me/training', '/coaching/mem-9/training', '/trainings'])('is not current on %s', (path) => {
      // The coaching *Training* tabs are coaching's; a prefix is not a parent.
      route.path = path;
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
        expect(screen.getByText('Training modules').closest('a')).not.toHaveAttribute('aria-current');
      } finally {
        route.path = '/group-tree';
      }
    });
  });

  describe('P15-T2 AC-1 Unit dashboard is live for a member who leads somebody (`Overall.html:2634`)', () => {
    /*
     * *Upcoming* from P10.1-T2 while its page was a sign (the client, 2026-10-01: a page that is not
     * ready says so like the others). The dashboard is built, so the item is a link with no pill, and
     * the current one on the reader's own unit and on every unit below them.
     */
    it('is a link to the reader’s own unit, with no pill', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
      const unit = screen.getByText('Unit dashboard').closest('a')!;
      expect(unit).toHaveAttribute('href', '/unit/dashboard');
      expect(unit).not.toHaveAttribute('aria-disabled');
      expect(within(unit).queryByText('Upcoming')).not.toBeInTheDocument();
      expect(unit).toHaveAccessibleName('Unit dashboard');
    });

    it.each(['/unit/dashboard', '/unit/dashboard/mem-9'])('is the current item on %s, and Coaching session is not', (path) => {
      // A unit below the reader is the same screen over another head (P15-T4 AC-2), so the item that
      // opened it stays current there.
      route.path = path;
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
        const unit = screen.getByText('Unit dashboard').closest('a')!;
        expect(unit).toHaveAttribute('aria-current', 'page');
        expect(unit.className).toContain('bg-amber/15');
        expect(screen.getByText('Coaching session').closest('a')).not.toHaveAttribute('aria-current');
      } finally {
        route.path = '/group-tree';
      }
    });

    it.each(['/unit', '/unit/dashboards', '/coaching/mem-9/summary', '/group-tree'])('is not current on %s', (path) => {
      // A prefix is not a parent: `/unit/dashboards` is not beneath `/unit/dashboard`. And a drill from
      // a row into a person's coaching tabs is coaching's, not the dashboard's.
      route.path = path;
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
        expect(screen.getByText('Unit dashboard').closest('a')).not.toHaveAttribute('aria-current');
      } finally {
        route.path = '/group-tree';
      }
    });
  });

  describe('P11-T6 AC-7 Coaching session is live for a member who leads somebody', () => {
    it('is a link to the roster, with no pill', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
      const coaching = screen.getByText('Coaching session').closest('a')!;
      expect(coaching).toHaveAttribute('href', '/coaching');
      expect(coaching).not.toHaveAttribute('aria-disabled');
      expect(within(coaching).queryByText('Upcoming')).not.toBeInTheDocument();
    });

    it.each(['/coaching', '/coaching/me', '/coaching/mem-9/session'])('is the current item on %s', (path) => {
      // The roster, the reader's own notes and every person's tabs are all coaching: the prototype's
      // item returns to the roster from any of them (`Overall.html:10596`).
      route.path = path;
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
        expect(screen.getByText('Coaching session').closest('a')).toHaveAttribute('aria-current', 'page');
      } finally {
        route.path = '/group-tree';
      }
    });

    it('is not current anywhere else', () => {
      // The Unit Dashboard's own addresses included: P15-T2 AC-1's cases above assert it there.
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
      expect(screen.getByText('Coaching session').closest('a')).not.toHaveAttribute('aria-current');
    });
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

  it('P18.1-T2: Leader Meetings › Strategic Leader Forum is live, with no pill (`KPM_Owner.html:887-890`)', async () => {
    route.path = '/leader-meetings/m-14';
    try {
      renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
      const item = (await everyItem()).find((a) => a.textContent?.trim() === 'Strategic Leader Forum');
      expect(item).toHaveAttribute('href', '/leader-meetings');
      expect(item).not.toHaveAttribute('aria-disabled');
      expect(item).toHaveAttribute('aria-current', 'page');
      expect(within(item!).queryByText('Upcoming')).not.toBeInTheDocument();
    } finally {
      route.path = '/group-tree';
    }
  });

  it('P18.1-T2, P18.8-T5 AC-5: a field member who is no Core Leader has no forum item and no Core leader group', async () => {
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    const items = await everyItem();
    expect(items.some((a) => /Strategic Leader Forum|Leader Meetings|KPM analytics/.test(a.textContent ?? ''))).toBe(false);
    expect(items.some((a) => a.getAttribute('href')?.startsWith('/leader-meetings'))).toBe(false);
    expect(navLabels()).not.toContain('Core leader');
  });

  describe('P18.8-T5 AC-5 the Core leader group (ADR-0159 §3)', () => {
    const CORE_LEADER = makeMe({ ...AGENT, membership: { ...AGENT.membership!, isCoreLeader: true } });

    it('comes after Campaign and before Admin, to a Core Leader only', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: CORE_LEADER });
      const sections = navLabels().filter((t) => ['Campaign', 'Core leader', 'Admin'].includes(t));
      expect(sections).toEqual(['Campaign', 'Core leader', 'Admin']);
    });

    it('holds the forum and KPM analytics, live, and Advanced analytics disabled and marked Soon', async () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, { me: CORE_LEADER });
      const labels = navLabels();
      const at = labels.indexOf('Core leader');
      expect(labels.slice(at + 1, at + 4)).toEqual(['Strategic Leader Forum', 'KPM analytics', 'Advanced analyticsSoon']);
      const items = await everyItem();
      const item = (name: string) => items.find((a) => a.textContent?.startsWith(name))!;
      expect(item('Strategic Leader Forum')).toHaveAttribute('href', '/leader-meetings');
      expect(item('KPM analytics')).toHaveAttribute('href', '/kpm/analytics');
      const soon = item('Advanced analytics');
      expect(soon).not.toHaveAttribute('href');
      expect(soon).toHaveAttribute('aria-disabled');
      expect(within(soon).getByText('Soon')).toBeInTheDocument();
    });

    it.each([
      ['/leader-meetings/m-14', 'Strategic Leader Forum'],
      ['/kpm/analytics/compliance', 'KPM analytics'],
    ])('is current on %s', async (path, name) => {
      route.path = path;
      try {
        renderWithSession(<AgentShell title="x">body</AgentShell>, { me: CORE_LEADER });
        const items = await everyItem();
        expect(items.find((a) => a.textContent === name)).toHaveAttribute('aria-current', 'page');
      } finally {
        route.path = '/group-tree';
      }
    });

    it('an Owner tagged and on a leader rung sees it in their field view too', () => {
      renderWithSession(<AgentShell title="x">body</AgentShell>, {
        me: makeMe({ ...OWNER, membership: { ...OWNER.membership!, isCoreLeader: true } }),
      });
      expect(navLabels()).toContain('Core leader');
    });
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
    // P18.8-T6 AC-2: the platform shell's profile line is the role alone — a Super Admin has no office.
    expect(screen.getByText('Superadmin')).toHaveAttribute('title', 'Superadmin');
  });

  it('P18-T8 AC-4: Cross-platform analytics is live, and the console says Soon nowhere', async () => {
    // It was the console's last `Soon` (`Superadmin.html:204`). Built, it is a link like the
    // rest, current on its own route, and no pill is left in `Reporting` or anywhere else.
    route.path = '/admin/analytics';
    try {
      renderWithSession(
        <AdminShell title="x">body</AdminShell>,
        { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
      );
      const item = (await everyItem()).find((a) => a.textContent?.trim() === 'Cross-platform analytics');
      expect(item).toHaveAttribute('href', '/admin/analytics');
      expect(item).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByText('Soon')).not.toBeInTheDocument();
    } finally {
      route.path = '/group-tree';
    }
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
      'Audit / role change log', 'Cross-platform analytics',
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
    // Seven groups, not eight: *Unit tools* is absent for a member who leads nobody (P10.1-T2
    // AC-9), and the rule must hold for the groups that remain, with Admin still last.
    ['agent with no reports', () => renderWithSession(<AgentShell title="x">body</AgentShell>, { me: makeMe() })],
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
