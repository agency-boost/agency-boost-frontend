import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth as screenAt, makeMe, renderWithSession, stubFetch, wears } from '@test/harness';
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

  /*
   * *Changed 2026-10-30 (UI V1, UI-004; ADR-0180):* the field shell's sidebar is regrouped as the *Lainnya* sheet — Home ·
   * Activity · Calendar · Unit Dashboard · Search agent, then Saya, Aktivitas, Tim saya, Program, KPM — and who sees each
   * item is pinned role by role in `field-shell.spec.tsx` and `lib/field-nav.spec.ts`. The prototype's nine sections, which
   * these cases pinned (P10.1-T2 AC-9, P13-T7 AC-5, P15-T2 AC-1, P11-T6 AC-7, P18.5-T1 AC-9), are gone with them.
   */

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

  // The *KPM* group (a Core Leader's, ADR-0159 §3) is pinned in `field-shell.spec.tsx` since UI V1.

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

/**
 * **The phone's drawer is each shell's sidebar** (P18.95-T2 AC-2, ADR-0167 §3): below 768px ☰ opens the nav the
 * sidebar draws wider — the field's, the office's and the console's — with the same groups in the same order,
 * the same labels and badges, the *Core leader* group where the reader has it, and the current page marked.
 * Compared against the sidebar itself, at a desktop's width, so neither can drift from the other.
 */
describe('P18.95-T2 AC-2 the phone’s drawer holds each shell’s sidebar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    route.path = '/group-tree';
  });

  /** A width the shell can ask about, and move — each of the three ranges answered for it (`test/harness.tsx`). */
  const atWidth = (px: number) => screenAt(px).resize;

  const SUPER = makeMe({
    user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
  });
  // The field shell has no drawer since UI V1 (UI-004): its tab bar and *Lainnya* sheet are `field-shell.spec.tsx`'s.

  it.each([
    ['office', () => <TenantShell title="x">body</TenantShell>, OWNER, '/people/members', 'All members', 'People'],
    ['console', () => <AdminShell title="x">body</AdminShell>, SUPER, '/admin/tenants', 'All KPMs', 'Platform admin'],
  ] as const)('the %s shell: the same groups, labels, order and current page', async (_shell, shell, me, path, current, group) => {
    route.path = path;
    const resize = atWidth(1280);
    renderWithSession(shell(), { me });
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    const words = navLabels();
    const markup = sidebar.innerHTML;
    expect(words).toContain(group);

    resize(375);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    const nav = within(drawer).getByRole('navigation', { name: 'Main' });

    expect(navLabels()).toEqual(words);
    expect(nav.innerHTML).toBe(markup);
    expect(within(nav).getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page');
    // The sidebar's foot comes with it: who is signed in.
    expect(within(drawer).getByRole('button', { name: /Rina|Signed in|Super Admin/ })).toBeInTheDocument();
  });

  it('the console: a badge on an item rides into the drawer as it is drawn in the sidebar', async () => {
    // Two waiting and one decided: the count is the two (ADR-0157 §3).
    stubFetch({ '/admin/leader-limit-requests': { body: [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }] } });
    const resize = atWidth(1280);
    renderWithSession(<AdminShell title="x">body</AdminShell>, {
      me: { ...SUPER, permissions: [...SUPER.permissions, 'leader_limit_request:decide'] },
    });
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    const item = () => within(sidebar).getByRole('link', { name: /Leaders past the limit/ });
    await waitFor(() => expect(item()).toHaveTextContent('Leaders past the limit2'));
    const badge = item().textContent;

    resize(375);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const nav = within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /Leaders past the limit/ }).textContent).toBe(badge);
  });
});

/**
 * **The phone's bar in each shell: the avatar holds the account and the notices** (P18.95-T12, the product owner's
 * request of 2026-10-27). Below 768px the field's, the office's and the console's bar is ☰, the brand and the avatar
 * alone, wearing the bell's count; the avatar's menu reads the person's details, *Notifications*, then the account's
 * items. Every shell reads its count from `useUnreadCount`, one read of the inbox, so the avatar, its menu and — from
 * 768px — the bell cannot disagree. The console's profile line has no office part (ADR-0159 §5).
 */
describe('P18.95-T12 the phone’s bar in each shell: the avatar holds the account and the notices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    route.path = '/group-tree';
  });

  const atWidth = (px: number) => screenAt(px).resize;

  const SUPER = makeMe({
    user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
  });
  /** The inbox's count, as `useUnreadCount` reads it: a page of one. */
  const inbox = (unread: number) => stubFetch({
    '/notifications': { body: { items: [], unread, total: unread, page: 1, pageSize: 1 } },
  });

  const OFFICE = { code: '0417', branch: 'Cempaka Putih' };
  // A Core Leader in a group, so the field's line has every part; the office's an Owner's; the console's no office.
  const OFFICE_READER = makeMe({ ...OWNER, membership: { ...OWNER.membership!, office: OFFICE } });

  const SHELLS = [
    ['office', () => <TenantShell title="x">body</TenantShell>, OFFICE_READER, '/people/members',
      ['Notifications', 'Open agent view', 'Your account'], 'KPM Owner · 0417 · Cempaka Putih'],
    ['console', () => <AdminShell title="x">body</AdminShell>, SUPER, '/admin/tenants', ['Notifications', 'Your account'],
      'Superadmin'],
  ] as const;

  const bar = () => document.querySelector('aside')!;
  const panel = () => document.getElementById('sidebar-user-actions');

  it.each(SHELLS)('the %s shell: the avatar alone on the bar, then one menu — details, Notifications, the account’s items', async (_shell, render, me, path, links, line) => {
    route.path = path;
    inbox(3);
    const resize = atWidth(1280);
    renderWithSession(render(), { me });
    // The sidebar's chip first: the same profile line, and the bell's count.
    await screen.findByRole('button', { name: 'Notifications, 3 unread' });
    expect(within(within(bar()).getByRole('button', { name: /Rina/ })).getByTitle(line)).toHaveTextContent(line);

    resize(375);
    // AC-1: ☰, the brand, the avatar; no name, no profile line, no bell.
    expect(within(bar()).queryByText('Rina')).not.toBeInTheDocument();
    expect(within(bar()).queryByText(line)).not.toBeInTheDocument();
    expect(within(bar()).queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
    expect(within(bar()).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Open menu', 'Account and notifications, 3 unread']);
    // AC-2: the count on the avatar.
    const avatar = within(bar()).getByRole('button', { name: 'Account and notifications, 3 unread' });
    expect(within(avatar).getByText('3')).toHaveClass('bg-alert');

    // AC-3: the full name, the profile line, the email; Notifications with the count; the account's items.
    await userEvent.click(avatar);
    const lines = Array.from(panel()!.querySelectorAll('p')).map((p) => p.textContent);
    expect(lines).toEqual(['Rina Wijaya', line, 'rina@kpm0417.test']);
    expect(within(panel()!).getAllByRole('link').map((a) => a.textContent))
      .toEqual(links.map((l) => (l === 'Notifications' ? 'Notifications3' : l)));
    expect(within(panel()!).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    const notices = within(panel()!).getByRole('link', { name: 'Notifications, 3 unread' });
    expect(notices).toHaveAttribute('href', '/notifications');

    // AC-4: focus in on Notifications; Escape shuts it and gives the focus back to the avatar.
    expect(notices).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(panel()).toBeNull();
    expect(avatar).toHaveFocus();
  });

  it.each(SHELLS)('the %s shell: Notifications goes to the inbox and closes the menu', async (_shell, render, me, path) => {
    route.path = path;
    inbox(2);
    atWidth(375);
    const swallow = (event: Event) => event.preventDefault();
    document.addEventListener('click', swallow);
    try {
      renderWithSession(render(), { me });
      await userEvent.click(await within(bar()).findByRole('button', { name: 'Account and notifications, 2 unread' }));
      const notices = within(panel()!).getByRole('link', { name: 'Notifications, 2 unread' });
      expect(notices).toHaveAttribute('href', '/notifications');
      await userEvent.click(notices);
      expect(panel()).toBeNull();
    } finally {
      document.removeEventListener('click', swallow);
    }
  });

  it.each(SHELLS.flatMap(([shell, render, me, path]) => [
    [shell, render, me, path, 12, '9+', 'Account and notifications, 12 unread'],
    [shell, render, me, path, 0, null, 'Account and notifications'],
  ] as const))('the %s shell at %i unread: the avatar’s badge reads %s', async (_shell, render, me, path, unread, badge, name) => {
    route.path = path;
    inbox(unread);
    atWidth(375);
    renderWithSession(render(), { me });
    const avatar = await within(bar()).findByRole('button', { name });
    if (badge) {
      expect(within(avatar).getByText(badge)).toHaveAttribute('aria-hidden', 'true');
    } else {
      // The initials alone: no badge, and no pill in the menu's row.
      expect(avatar).toHaveTextContent(/^RW$/);
      await userEvent.click(avatar);
      expect(within(panel()!).getByRole('link', { name: 'Notifications' })).toHaveTextContent(/^Notifications$/);
    }
  });

  /*
   * *Changed 2026-10-28 (P18.97-T6 AC-1):* this read *from 768px*, and its stub answered the phone's query alone, so
   * 768 was a desktop to the shell. From 768 to 1023px the sidebar now opens on the rail (UI-033): the full chip and
   * the bell beside it are the desktop's, from 1024px, and a tablet's sidebar opened full (the case after).
   */
  it.each(SHELLS)('the %s shell from 1024px: the chip with the name and the bell beside it, as before', async (_shell, render, me, path) => {
    route.path = path;
    inbox(3);
    atWidth(1024);
    renderWithSession(render(), { me });
    const bell = await within(bar()).findByRole('button', { name: 'Notifications, 3 unread' });
    expect(within(bell).getByText('3')).toBeInTheDocument();
    expect(within(bar()).getByRole('button', { name: /Rina/ })).toHaveTextContent(/Rina/);
    expect(within(bar()).queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();
    // The bell is the sidebar's foot's last control, after the chip, as it was.
    const row = bell.parentElement!.parentElement!;
    expect(row.lastElementChild).toBe(bell.parentElement);
  });

  it.each(SHELLS)('P18.97-T6 AC-1 the %s shell from 768px: the rail’s foot — the bell above the avatar — and opened full, the chip and the bell as from 1024px', async (_shell, render, me, path, _links, line) => {
    route.path = path;
    inbox(3);
    atWidth(768);
    window.localStorage.clear();
    renderWithSession(render(), { me });
    const bell = await within(bar()).findByRole('button', { name: 'Notifications, 3 unread' });
    // The avatar alone, the name and the profile line in its name; never the phone's avatar menu.
    const chip = within(bar()).getByRole('button', { name: `Rina — ${line}` });
    expect(chip).toHaveTextContent(/^RW$/);
    expect(within(bar()).queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();
    expect(bell.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(within(bar()).getByRole('button', { name: 'Expand the sidebar' }));
    const full = within(bar()).getByRole('button', { name: /Rina/ });
    expect(full).toHaveTextContent(/Rina/);
    const row = within(bar()).getByRole('button', { name: 'Notifications, 3 unread' }).parentElement!.parentElement!;
    expect(row.lastElementChild).toContainElement(within(bar()).getByRole('button', { name: 'Notifications, 3 unread' }));
    window.localStorage.clear();
  });
});

/**
 * **Every shell opens on the rail on a tablet** (P18.97-T6 AC-1, ADR-0178 §1; the client's UI-033, reviewed in the
 * office's but asked of every shell): the field's, the office's and the console's all draw their sidebar through
 * `AppShell`, so each opens on the rail from 768 to 1023px, full from 1024px, and as the phone's bar below 768px.
 * One reader's choice is one browser's, so a tablet opened full in one shell is opened full in the others.
 */
describe('P18.97-T6 AC-1 every shell: the rail from 768 to 1023px, full from 1024px, the phone’s bar below 768px', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    route.path = '/group-tree';
  });

  const SUPER = makeMe({
    user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
  });
  const SHELLS = [
    ['office', () => <TenantShell title="x">body</TenantShell>, OWNER, '/people/members', 'All members', 'People'],
    ['console', () => <AdminShell title="x">body</AdminShell>, SUPER, '/admin/tenants', 'All KPMs', 'Platform admin'],
  ] as const;
  const toggle = () => screen.queryByRole('button', { name: /^(Expand|Collapse) the sidebar$/ });
  const aside = () => document.querySelector('aside')!;

  it.each(SHELLS.flatMap(([shell, ...rest]) => [767, 768, 1023, 1024].map((px) => [shell, px, ...rest] as const)))(
    'P18.97-T6 AC-1 the %s shell at %ipx',
    async (_shell, px, render, me, path, current, group) => {
      route.path = path;
      window.localStorage.clear();
      screenAt(px);
      renderWithSession(render(), { me });
      if (px < 768) {
        // The phone's bar, unchanged: ☰, no sidebar nav, no rail to open or close.
        expect(toggle()).toBeNull();
        expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        const menu = within(screen.getByRole('dialog', { name: 'Menu' }));
        expect(menu.getByRole('button', { name: new RegExp(group) })).toBeInTheDocument();
        expect(menu.getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page');
        return;
      }
      const nav = within(screen.getByRole('navigation', { name: 'Main' }));
      const here = nav.getByRole('link', { name: current });
      expect(here).toHaveAttribute('aria-current', 'page');
      if (px < 1024) {
        expect(toggle()).toHaveAttribute('aria-label', 'Expand the sidebar');
        expect(wears(aside(), px).split(' ')).toContain('w-[var(--sidebar-rail-width)]');
        // A glyph per item, named and tipped by its label; no heading to click.
        expect(here).toHaveAttribute('title', current);
        expect(here.textContent).toBe('');
        expect(nav.queryByRole('button', { name: new RegExp(group) })).toBeNull();
      } else {
        expect(toggle()).toHaveAttribute('aria-label', 'Collapse the sidebar');
        expect(wears(aside(), px).split(' ')).toContain('w-sidebar');
        expect(here).toHaveTextContent(current);
        expect(nav.getByRole('button', { name: new RegExp(group) })).toHaveAttribute('aria-expanded', 'true');
      }
      expect(window.localStorage.getItem('ab.sidebar.rail.tablet')).toBeNull();
    },
  );

  it('UI-004 a tablet opened full in the office’s shell leaves the field shell’s desktop choice alone: the field has no tablet rail', async () => {
    route.path = '/people/members';
    window.localStorage.clear();
    screenAt(900);
    const office = renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    await userEvent.click(screen.getByRole('button', { name: 'Expand the sidebar' }));
    expect(window.localStorage.getItem('ab.sidebar.rail.tablet')).toBe('0');
    expect(window.localStorage.getItem('ab.sidebar.rail')).toBeNull();
    office.unmount();
    cleanup();

    // The field shell from 1024px: the full sidebar, its desktop default, whatever a tablet chose.
    route.path = '/leads';
    screenAt(1280);
    renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT });
    expect(screen.getByRole('button', { name: 'Collapse the sidebar' })).toBeInTheDocument();
  });
});
