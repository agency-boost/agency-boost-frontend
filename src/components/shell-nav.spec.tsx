import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { everyNavLink, openEveryGroup } from '@test/sidebar';
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
  // Group headings are buttons, not paragraphs: each group opens and closes on its own
  // (client feedback, 2026-09-24 and 2026-09-29). The chevron is part of the button's text.
  // Every group is opened first (any a spec folded); since P19.17-T3 the extras' names end with their *Owner* tag, which
  // is part of the name and is cut off here, so a group reads as its name.
  const nav = openEveryGroup();
  return Array.from(nav.querySelectorAll('[aria-controls^="nav-group"], a'))
    .map((el) => (el.textContent ?? '').replace('\u25b8', '').replace(/Owner$/, '').trim());
}

/**
 * Every destination in the nav.
 *
 * *Changed 2026-11-12 (P19.13-T2 AC-5; UI-196, ADR-0252 §4):* only the current page's group starts open, so the groups
 * are opened first, as a reader would (`openEveryGroup`). It read the nav with no click while every group started open
 * (P10.1-T3, which UI-196 reversed).
 */
async function everyItem() {
  return everyNavLink();
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

  /*
   * *Changed 2026-11-12 (P19.13-T2 AC-2; UI-196, ADR-0252):* **the app's icon**, not the prototype's 26px org-chart mark —
   * Boost holding a phone, the PWA's `/icons/icon-192.png`, 36px with 10px corners — beside *Agency**Boost*** and the
   * branch's name.
   */
  it('P19.13-T2 AC-2 carries the app icon, the wordmark AgencyBoost and the branch name', () => {
    const me = makeMe({ ...AGENT, membership: { ...AGENT.membership!, office: { code: '0417', branch: 'BSD City Branch' } } });
    const { container } = renderWithSession(<AgentShell title="x">body</AgentShell>, { me });
    const icon = container.querySelector('aside img[data-app-icon]');
    expect(icon).toHaveAttribute('src', '/icons/icon-192.png');
    expect(icon).toHaveClass('h-9', 'w-9', 'rounded-[10px]');
    expect(container.querySelector('svg[viewBox="0 0 26 26"]')).toBeNull();
    const word = screen.getByText('Boost');
    expect(word).toHaveClass('text-primary-on-secondary');
    expect(word.parentElement).toHaveTextContent(/^AgencyBoost$/);
    expect(word.parentElement).toHaveClass('text-lg', 'font-extrabold');
    const branch = container.querySelector('[data-branch-name]');
    expect(branch).toHaveTextContent('BSD City Branch');
    expect(branch).toHaveClass('text-xs', 'text-secondary-contrast/70');
  });

  /*
   * *Changed 2026-10-30 (UI V1, UI-004; ADR-0180):* the field shell's sidebar is regrouped as the *Lainnya* sheet — Home ·
   * Activity · Calendar · Unit Dashboard · Search agent, then Saya, Aktivitas, Tim saya, Program, KPM — and who sees each
   * item is pinned role by role in `field-shell.spec.tsx` and `lib/field-nav.spec.ts`. The prototype's nine sections, which
   * these cases pinned (P10.1-T2 AC-9, P13-T7 AC-5, P15-T2 AC-1, P11-T6 AC-7, P18.2-T1 AC-9), are gone with them.
   */

  /*
   * *Changed 2026-11-20 (P19.17-T3 AC-4, AC-5; ADR-0269; part E):* the office view (P19.2-T1 AC-6, ADR-0198 §2) is gone:
   * the Owner's menu is the field's groups, then *KPM* (Overview first) and *People*, on every page — and *Pengaturan*, one
   * item, pinned below the groups (`data-sidebar-pinned`), not a group of its own in the part that scrolls.
   */
  it('P19.17-T3 AC-4 KPM Owner: the field’s groups, then KPM · People, Pengaturan pinned last, no invented Office group', () => {
    for (const path of ['/kpm/overview', '/goals']) {
      route.path = path;
      const { unmount } = renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
      const labels = navLabels();
      const sections = labels.filter((t) => ['Program', 'Programs', 'KPM', 'Settings', 'People', 'Office', 'Reporting'].includes(t));
      expect(sections).toEqual(['Programs', 'KPM', 'People', 'Settings']);
      // Overview is the KPM group's first item; the last link of the nav is the pinned Pengaturan.
      expect(labels.indexOf('Overview')).toBe(labels.indexOf('KPM') + 1);
      expect(labels.at(-1)).toBe('Settings');
      unmount();
    }
  });

  it('KPM Owner: Overview is reachable — it is built', () => {
    route.path = '/kpm/overview';
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/kpm/overview');
  });

  it('P18.1-T2: KPM › Strategic Leader Forum is live, with no pill (`KPM_Owner.html:887-890`)', async () => {
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
    route.path = '/kpm/overview';
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.queryByText('Ratio benchmarks')).not.toBeInTheDocument();
  });

  it('P19.2-T1 AC-1 KPM Owner: no app named under the wordmark — one shell, as `kpm-owner-desktop` draws it', () => {
    route.path = '/kpm/overview';
    renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER });
    expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
  });

  it('P19.23-T1 AC-1 Superadmin: the six in the rail’s order, Platform pinned, and its own pill word (ADR-0277 §1)', () => {
    route.path = '/admin';
    renderWithSession(
      <AdminShell title="x">body</AdminShell>,
      { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
    );
    const labels = navLabels();
    expect(labels.filter((t) => ['Dashboard', 'KPM', 'Members', 'Companies', 'Approvals', 'Subscriptions', 'Platform'].includes(t)))
      .toEqual(['Dashboard', 'KPM', 'Members', 'Companies', 'Approvals', 'Subscriptions', 'Platform']);
    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
    // P18.5-T6 AC-2: the platform shell's profile line is the role alone — a Super Admin has no office.
    expect(screen.getByText('Superadmin')).toHaveAttribute('title', 'Superadmin');
  });

  it('P19.23-T1 AC-1 every console destination is a real link, and the console says Soon nowhere', async () => {
    route.path = '/admin';
    // `upcoming` renders an anchor with no href, so a flag left on after the screen shipped makes it reachable from
    // nowhere — what happened to /admin/kpm-requests in P3.1-T2. *Cross-platform analytics* is gone since P19.23
    // (ADR-0277: the Dashboard's *Adopsi per KPM*).
    renderWithSession(
      <AdminShell title="x">body</AdminShell>,
      { me: makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'] }) },
    );
    for (const name of ['Dashboard', 'KPM', 'Members', 'Companies', 'Approvals', 'Subscriptions', 'Platform']) {
      const item = (await everyItem()).find((a) => a.textContent?.trim() === name);
      expect(item, `${name} is not in the nav`).toBeDefined();
      expect(item).toHaveAttribute('href');
    }
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();
  });

  describe('every destination carries a glyph on the rail (client feedback, 2026-09-24)', () => {
    /*
     * The rail collapses to 64px and the label goes with it, so a nav item without an icon
     * is a blank square nobody notices until they collapse the sidebar — which is exactly
     * when they most need to know where they are. Asserted rather than trusted.
     *
     * *Changed 2026-11-20 (P19.17-T3 AC-5, AC-6; part E):* **every row has its glyph** at full width again, and on the
     * rail a group is one glyph of its own (a button) whose items open beside it.
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
      ['the Owner', () => <TenantShell title="x">body</TenantShell>, OWNER, '/kpm/overview'],
      ['the Super Admin', () => <AdminShell title="x">body</AdminShell>, SUPER, '/admin'],
    ] as const;

    it.each(shells)('%s draws one icon per item on the rail, from the registry', async (_name, shell, me, path) => {
      route.path = path;
      window.localStorage.setItem('ab.sidebar.rail', '1');
      try {
        renderWithSession(shell(), { me });
        const items = Array.from(screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a, [data-rail-group] > button'));
        expect(items.length).toBeGreaterThan(3);
        for (const item of items) {
          const icon = item.querySelector('svg');
          expect(icon, `${item.getAttribute('aria-label')} has no icon`).not.toBeNull();
          expect(icon!.getAttribute('viewBox')).toBe('0 0 24 24');
        }
      } finally {
        window.localStorage.removeItem('ab.sidebar.rail');
      }
    });

    it.each(shells)('P19.17-T3 AC-5 %s: every row, the top section’s and a group’s alike, carries its glyph', async (_name, shell, me, path) => {
      route.path = path;
      renderWithSession(shell(), { me });
      const nav = openEveryGroup();
      for (const a of Array.from(nav.querySelectorAll('a'))) {
        expect(a.querySelector('svg:not([data-mark])'), a.textContent ?? '').not.toBeNull();
      }
    });
  });
});

describe('one line, under the top section, in every shell (parity I-144; P19.13-T2)', () => {
  /*
   * The Owner's and the Super Admin's prototypes draw a line before every group; the agent's drew
   * two. Once every group became a toggle of its own (P10.1-T3), a heading with no line above it
   * read as part of the group before it, and the client asked for one rule everywhere
   * (2026-09-30).
   *
   * *Changed 2026-11-12 (P19.13-T2 AC-5; UI-196, the approved mockup's one `.hr`):* the groups start closed, each a 36px
   * heading row, and the headings are the groups' edges: **one line, under the top section**, so the KPM Owner's seven
   * groups do not cost six lines of height in a panel that must not scroll.
   */
  const SUPER = makeMe({
    user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
  });
  const SHELLS = [
    ['agent', () => renderWithSession(<AgentShell title="x">body</AgentShell>, { me: AGENT })],
    ['agent with no reports', () => renderWithSession(<AgentShell title="x">body</AgentShell>, { me: makeMe() })],
    ['KPM Owner', () => { route.path = '/kpm/overview'; return renderWithSession(<TenantShell title="x">body</TenantShell>, { me: OWNER }); }],
    ['Superadmin', () => { route.path = '/admin'; return renderWithSession(<AdminShell title="x">body</AdminShell>, { me: SUPER }); }],
  ] as const;

  afterEach(() => { route.path = '/group-tree'; });

  it.each(SHELLS)('%s: the top section ends with the one line, and no group does', (_shell, render) => {
    render();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    // P19.17-T3 AC-5: the groups sit in the part that scrolls; Pengaturan's line, pinned below it, is a border, not a rule.
    const sections = Array.from(nav.querySelector('[data-sidebar-scroll]')!.children);

    expect(within(nav).getAllByRole('separator')).toHaveLength(1);
    sections.forEach((section, i) => {
      expect(section.lastElementChild?.getAttribute('role') === 'separator').toBe(i === 0);
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
