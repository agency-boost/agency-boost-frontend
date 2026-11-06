import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { AgentShell } from './agent-shell';
import { Shell } from './shell';

/** The office's pages and the platform's, in the one shell since P19.2-T1 (ADR-0197). */
function TenantShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <Shell family="tenant" title={title}>{children}</Shell>;
}
function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <Shell family="admin" title={title}>{children}</Shell>;
}

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
  afterEach(() => {
    vi.unstubAllGlobals();
    route.path = '/group-tree';
  });

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
   * these cases pinned (P10.1-T2 AC-9, P13-T7 AC-5, P15-T2 AC-1, P11-T6 AC-7, P18.2-T1 AC-9), are gone with them.
   */

  /*
   * *Changed 2026-11-05 (P19.2-T1 AC-6; UI-147, ADR-0198 §2):* the office console's sidebar — Overview alone, Reporting,
   * Leader Meetings, Settings, People (`KPM_Owner.html:872-913`) — is the one shell's **office view**: the field's groups,
   * then *KPM* (Overview first), *Pengaturan* and *People* last.
   */
  it('P19.2-T1 AC-6 KPM Owner: the field’s groups, then KPM · Settings · People, People last, and no invented Office group', () => {
    route.path = '/kpm/overview';
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    const labels = navLabels();
    const sections = labels.filter((t) => ['Program', 'Programs', 'KPM', 'Settings', 'People', 'Office', 'Reporting'].includes(t));
    expect(sections).toEqual(['Programs', 'KPM', 'Settings', 'People']);
    // Overview is the KPM group's first item.
    expect(labels.indexOf('Overview')).toBe(labels.indexOf('KPM') + 1);
  });

  it('KPM Owner: Overview is reachable — it is built', () => {
    route.path = '/kpm/overview';
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/kpm/overview');
  });

  it('P18.1-T2: KPM › Strategic Leader Forum is live, with no pill (`KPM_Owner.html:887-890`)', async () => {
    route.path = '/leader-meetings/m-14';
    window.sessionStorage.setItem('ab.view', 'kpm_owner');
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
    route.path = '/kpm/overview';
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.queryByText('Ratio benchmarks')).not.toBeInTheDocument();
  });

  it('P19.2-T1 AC-1 KPM Owner: no app named under the wordmark — one shell, as `kpm-owner-desktop` draws it', () => {
    route.path = '/kpm/overview';
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
  });

  it('Superadmin: five groups in the prototype order, and its own pill word', () => {
    route.path = '/admin';
    renderWithSession(
      <AdminShell title="x">body</AdminShell>,
      { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
    );
    const labels = navLabels();
    expect(labels.filter((t) => ['Companies', 'KPMs', 'Platform admin', 'Reporting'].includes(t)))
      .toEqual(['Companies', 'KPMs', 'Platform admin', 'Reporting']);
    expect(labels.indexOf('Overview')).toBeLessThan(labels.indexOf('Companies'));
    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
    // P18.5-T6 AC-2: the platform shell's profile line is the role alone — a Super Admin has no office.
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
    route.path = '/admin';
    // `upcoming` renders an anchor with no href, so a flag left on after the screen
    // shipped makes it reachable from nowhere. That is what happened to
    // /admin/kpm-requests: the screen, its endpoints and its manual chapter all shipped
    // in P3.1-T2 while the nav item stayed inert. Nothing caught it, because the nav
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
      ['the agent app', () => <AgentShell title="x">body</AgentShell>, AGENT, '/group-tree'],
      ['the office view', () => <TenantShell title="x">body</TenantShell>, OWNER, '/kpm/overview'],
      ['the Super Admin', () => <AdminShell title="x">body</AdminShell>, SUPER, '/admin'],
    ] as const;

    it.each(shells)('%s draws one icon per item, from the registry', async (_name, shell, me, path) => {
      route.path = path;
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
    ['KPM Owner', () => { route.path = '/kpm/overview'; return renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER }); }],
    ['Superadmin', () => { route.path = '/admin'; return renderWithSession(<AdminShell title="x">body</AdminShell>, { me: SUPER }); }],
  ] as const;

  afterEach(() => { route.path = '/group-tree'; });

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

/*
 * *Removed 2026-11-05 (P19.2-T1; ADR-0197, which ends ADR-0167 §3 and ADR-0178 §1 for the consoles):* three describes
 * pinned the consoles' phone chrome — the ☰ drawer holding each shell's sidebar (P18.7-T2 AC-2), the phone bar's avatar
 * holding the account and the notices (P18.7-T12), and the tablet's icon rail from 768 to 1023px (P18.9-T6 AC-1). No role
 * has any of them now: below 1024px every role has the floating bar and *Lainnya*, pinned for every role in
 * `shell-views.spec.tsx` (AC-1, AC-9, AC-10) and for the field in `field-shell.spec.tsx`.
 */
