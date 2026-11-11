import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, routeParams, stubFetch, wears } from '@test/harness';
import { joinRequest, transfer } from '@test/joining-fixtures';
import AdminsPage from './admins/page';
import PeopleImportPage from './import/page';
import MemberPage from './members/[membershipId]/page';
import { loggedRecently, RECENT_ACTIVITY_DAYS } from './members/member-rows';
import MembersPage from './members/page';
import OrgTreePage from './org-tree/page';

/**
 * **No target under 44px in `main` at 375 and 768 on `/people/*`** (P19.2-T3 AC-4; UI-142, the full UI report of
 * 3 November: *"Ubah", "Arsipkan" … text links 17px tall; tab rows 38px (Members 34px); Org tree names 17px*). The
 * report's measurement script, read the way jsdom can: every control a finger aims at in the page — a button, a
 * link, a field, a box to tick with its line, a fold — wears a 44px height at that width (`wears`), or is stretched
 * over a row that does, or is an ⓘ whose 44px area takes the tap. A link inside a sentence is the inline exception
 * (WCAG 2.5.8): its sentence is the target.
 *
 * **The pages are drawn inside the shared shell's frame** (`data-surface="v1"`): P19.2-T1 renders the Owner's pages in
 * `AppShell` (ADR-0197), whose frame gives the shared primitives — `Button`, `TextInput`, `Select`, `RouteTabs`, the
 * inline buttons — their 44px below 1024px (`components/ui/touch.ts`). The frame stands for the shell here, so these
 * tests read the pages alone, whatever the shell's own state.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

afterEach(() => vi.unstubAllGlobals());

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: [
    'member:read_profile', 'member:transfer_approve', 'kpm_admin:grant', 'kpm_admin:revoke', 'kpm_admin:list',
    'org_tree:read', 'kpm:import_roster', 'member:change_role', 'member:remove', 'member:tag',
  ],
});

/** The shell's frame: what P19.2-T1's `AppShell` draws round every Owner page. */
const inShell = (page: ReactNode) => renderWithSession(<div data-surface="v1"><main>{page}</main></div>, { me: OWNER });

/** A height that is 44px or more, as Tailwind writes it. */
const TALL = new Set(['h-11', 'h-12', 'min-h-11', 'min-h-12', 'min-h-14', 'min-h-16', 'min-h-[3.75rem]']);
const tall = (el: Element, px: number) => wears(el, px).split(' ').some((c) => TALL.has(c));

/** Whether a control is a 44px target at `px`, by the rules above; the reason it is not, when it is not. */
function target(el: HTMLElement, px: number): string | null {
  if (el.closest('.sr-only')) return null;
  // A box to tick or a choice: its label's line is the target.
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    const line = el.closest('label');
    return line && tall(line, px) ? null : 'its line';
  }
  if (tall(el, px)) return null;
  // A field laid over its face, the face's size (`DateField`): the face is the target.
  if (el.tagName === 'INPUT' && el.classList.contains('inset-0') && el.nextElementSibling && tall(el.nextElementSibling, px)) return null;
  // …or laid over the box it sits in (`MonthShapeField`, P19.12-T5): the box is the target.
  if (el.tagName === 'INPUT' && el.classList.contains('inset-0') && el.parentElement && tall(el.parentElement, px)) return null;
  // A number's field filling its box after the fixed +62 (`PhoneField`): the box is the target.
  if (el.tagName === 'INPUT' && el.closest('[data-phone-field]') && tall(el.closest('[data-phone-field]')!, px)) return null;
  // A field inside a pill that is its label: the pill is the target (`SearchPill`).
  if (el.tagName === 'INPUT' && el.closest('label') && tall(el.closest('label')!, px)) return null;
  const worn = wears(el, px);
  // An ⓘ: its glyph stays small, a 44px area centred on it takes the tap.
  if (worn.includes('after:h-[max(100%,2.75rem)]')) return null;
  // Stretched over its row (the shared person row, an org-tree line): the row is the target.
  if (worn.includes('after:inset-0')) {
    const row = el.parentElement?.closest('[data-person-row], [data-list-row], [data-node] > div, li');
    if (row && (tall(row, px) || row.querySelector('[data-person-row]') !== null)) return null;
    return 'its row';
  }
  // A link inside a sentence: WCAG 2.5.8's inline exception.
  if (el.tagName === 'A' && el.closest('p')) return null;
  return 'itself';
}

/** Every control in `main` — or in `root`, a sheet drawn over the page — that is not a 44px target at `px`, by its name. */
function under44(px: number, root: HTMLElement = screen.getByRole('main')): string[] {
  const controls = root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary');
  return [...controls]
    .map((el) => ({ el, why: target(el, px) }))
    .filter(({ why }) => why !== null)
    .map(({ el, why }) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? el.getAttribute('name') ?? '').trim()}" (${why})`);
}

const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', agentCode: 'KPM0417-001', role: 'agent', status: 'active',
  fullName: 'Rina Wijaya', preferredName: null, email: 'rina@kpm0417.test', initials: 'RW',
  leaderId: 'mem-owner', leaderName: 'Wilson Tanoto', depth: 1, directCount: 0, subtreeCount: 0,
  isLeader: false, isKpmOwner: false, isKpmAdmin: false, joinedAt: '2026-03-01T00:00:00.000Z', removedAt: null,
  canChangeRole: true, canPromoteToAb: true, canRemove: true, lastActivityDays: 2, lastActivityOn: '2026-10-25',
  ...over,
});
const ROSTER = [
  member({
    membershipId: 'mem-owner', fullName: 'Wilson Tanoto', role: 'ab', isKpmOwner: true, leaderId: null, leaderName: null,
    isLeader: true, directCount: 1, subtreeCount: 1, canTagCoreLeader: true, lastActivityDays: 0,
  }),
  member(),
];
const COUNTS = { directory: 2, pending: 1, removed: 0 };
const TREE = {
  nodes: [
    { membershipId: 'mem-owner', fullName: 'Wilson Tanoto', preferredName: null, initials: 'WT', agentCode: 'KPM0417-000', role: 'ab', depth: 0, layer: 1, leaderId: null, directCount: 1, directCounts: { ab: 0, aab: 0, agent: 1, total: 1 }, subtreeCount: 1, isLeader: true, isSelf: true },
    { membershipId: 'mem-1', fullName: 'Rina Wijaya', preferredName: null, initials: 'RW', agentCode: 'KPM0417-001', role: 'agent', depth: 1, layer: 2, leaderId: 'mem-owner', directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0, isLeader: false, isSelf: false },
  ],
  leader: null, rootIds: ['mem-owner'], selfId: 'mem-owner', counts: { ab: 1, aab: 0, agent: 1, total: 2 },
};
const MEMBERS_ROUTES = {
  '/members/role-changes': {
    body: [{ membershipId: 'mem-1', fullName: 'Rina Wijaya', agentCode: 'KPM0417-001', fromRole: 'agent', toRole: 'aab', reason: 'Grew', actorName: 'Wilson Tanoto', changedAt: '2026-10-01T03:00:00.000Z' }],
  },
  '/members/groups': { body: [{ groupId: 'g-1', name: 'Mentoring', ownerMembershipId: 'mem-owner', ownerName: 'Wilson Tanoto', ownerHasLeft: false, memberCount: 2 }] },
  '/members/tree': { body: TREE },
  '/join/inbox': { body: [] },
  '/join/requests': { body: [joinRequest({ membershipId: 'mem-p', requestedAt: '2026-10-20T03:00:00.000Z' })] },
  '/transfer-requests': { body: [transfer()] },
  '/leader-limit-requests': { body: [] },
  '/members?status=pending': { body: { members: [member({ membershipId: 'mem-p', fullName: 'Putri Anggraini', status: 'pending' })], nextCursor: null, counts: COUNTS } },
  '/members': { body: { members: ROSTER, nextCursor: 'next', counts: COUNTS } },
};

describe('P19.2-T3 AC-4 no target under 44px on /people/* at 375 and 768 (UI-142)', () => {
  it.each([375, 768])('P19.2-T3 AC-4 at %ipx All members: the tabs, the search pill, the chips, the rows and the pager', async (px) => {
    atWidth(px);
    stubFetch(MEMBERS_ROUTES);
    inShell(<MembersPage />);
    await screen.findByRole('list', { name: 'Office roster' });
    await within(screen.getByRole('group', { name: 'Filter by role' })).findByRole('button', { name: 'AB 1' });
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx All members’ other tabs: Pending, Role change log and Groups', async (px) => {
    atWidth(px);
    stubFetch(MEMBERS_ROUTES);
    inShell(<MembersPage />);
    await screen.findByRole('list', { name: 'Office roster' });
    await userEvent.click(screen.getByRole('button', { name: /^Pending/ }));
    await screen.findByText('Putri Anggraini');
    await screen.findAllByRole('button', { name: 'Approve' });
    expect(under44(px)).toEqual([]);
    // Approve opens the row's join date: the field and its two buttons.
    await userEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    expect(under44(px)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Role change log' }));
    await screen.findByRole('link', { name: 'Rina Wijaya' });
    expect(under44(px)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Groups' }));
    await screen.findByText('Mentoring');
    expect(under44(px)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx a member’s page: the way back, a report, the tags, a role change and a removal', async (px) => {
    atWidth(px);
    stubFetch({
      '/members/mem-1/reports': { body: [member({ membershipId: 'mem-2', fullName: 'Dimas Pratama' })] },
      // P19.3-T4: the four tiles' read (ADR-0205 §1); *Lihat dashboard ›* is a 44px pill below 1024px.
      '/members/mem-1/performance': {
        body: {
          membershipId: 'mem-1', today: '2026-11-05', activity: { from: '2026-10-30', to: '2026-11-05', count: 14 },
          production: { year: '2026', actualMinor: null, targetMinor: null, attainmentPct: null, goalSet: false },
          lastOneOnOne: null, leads: { month: '2026-11', open: 9, closing: 2 },
        },
      },
      '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false, canBeCoreLeader: true } },
      '/members/groups': { body: [{ groupId: 'g-1', name: 'Mentoring', ownerMembershipId: 'mem-owner', ownerName: 'Wilson Tanoto', ownerHasLeft: false, memberCount: 2 }] },
      '/leader-limit-requests': { body: [] },
      '/members/mem-1': { body: member({ isLeader: true, directCount: 1, subtreeCount: 1 }) },
    });
    inShell(<MemberPage params={routeParams({ membershipId: 'mem-1' })} />);
    await screen.findByRole('link', { name: 'Dimas Pratama' });
    expect(under44(px)).toEqual([]);
    // P19.12-T5 (ADR-0248 §1): the informal groups' form, a sheet over the page: each group's tick and *Core Leader*'s,
    // their lines 44px, and its buttons.
    await userEvent.click(screen.getByRole('button', { name: 'Edit informal groups' }));
    expect(screen.getByRole('checkbox', { name: 'Mentoring' })).toBeInTheDocument();
    expect(under44(px, screen.getByRole('dialog'))).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // The role form and the removal form: the select, the reason, the word, the choices for a leader's people.
    await userEvent.click(screen.getByRole('button', { name: 'Edit role' }));
    expect(under44(px, screen.getByRole('dialog'))).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove from the office' }));
    expect(under44(px, screen.getByRole('dialog'))).toEqual([]);
  });

  /* P19.12-T5 AC-2, AC-3 (ADR-0248 §2, §3): *Data pribadi* opened — its summary, the WhatsApp link — and *Lengkapi data*. */
  it.each([375, 768])('P19.12-T5 AC-2, AC-3 at %ipx a member’s data opened, its WhatsApp link, and Complete details', async (px) => {
    atWidth(px);
    stubFetch({
      '/members/mem-1/reports': { body: [] },
      '/members/mem-1/performance': {
        body: {
          membershipId: 'mem-1', today: '2026-11-05', activity: { from: '2026-10-30', to: '2026-11-05', count: 14 },
          production: { year: '2026', actualMinor: null, targetMinor: null, attainmentPct: null, goalSet: false },
          lastOneOnOne: null, leads: { month: '2026-11', open: 9, closing: 2 },
        },
      },
      '/members/mem-1/tags': { body: { membershipId: 'mem-1', fullName: 'Rina Wijaya', groupIds: [], isCoreLeader: false } },
      '/members/groups': { body: [] },
      '/members/mem-1': {
        body: member({
          personal: {
            dateOfBirth: null, gender: null, companyJoinMonth: null, workStatus: null, phone: null, companyName: 'Prudential',
          },
        }),
      },
    });
    renderWithSession(<div data-surface="v1"><main><MemberPage params={routeParams({ membershipId: 'mem-1' })} /></main></div>, {
      me: makeMe({ ...OWNER, permissions: [...OWNER.permissions, 'member:complete_personal'] }),
    });
    await userEvent.click((await screen.findByRole('heading', { name: 'Personal data' })).closest('summary')!);
    expect(under44(px)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Complete details' }));
    expect(screen.getByLabelText('WhatsApp number')).toBeInTheDocument();
    expect(under44(px, screen.getByRole('dialog'))).toEqual([]);
  });

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx Manage KPM Admins: the grant, the list and a revoke asked first', async (px) => {
    atWidth(px);
    stubFetch({
      '/members/admins': {
        body: [{ membershipId: 'mem-admin', fullName: 'Maya Halim', initials: 'MH', agentCode: 'KPM0417-002', role: 'ab', grantedAt: '2026-10-14T00:00:00.000Z', grantedByName: 'Wilson Tanoto', canRevoke: true }],
      },
      '/members/tree': { body: TREE },
    });
    inShell(<AdminsPage />);
    await screen.findByText('Maya Halim');
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx Org Tree: the list, every line the person’s link, every + or − 44 × 44px', async (px) => {
    atWidth(px);
    stubFetch({ '/members/tree': { body: TREE } });
    inShell(<OrgTreePage />);
    await screen.findByRole('button', { name: /Wilson Tanoto/ });
    expect(screen.queryByTestId('tree-canvas')).toBeNull();
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx Import people: the downloads, the guide’s fold, the two ways in and the file', async (px) => {
    atWidth(px);
    const HEADER = 'fullName,email,agentCode,role,leaderAgentCode,dateOfBirth,companyJoinMonth,workStatus,gender';
    stubFetch({ '/admin/tenants/roster-template': { body: { header: HEADER, columns: [], template: `${HEADER}\n`, examples: [] } } });
    inShell(<PeopleImportPage />);
    await screen.findByRole('button', { name: /Excel/ });
    expect(under44(px)).toEqual([]);
  });

  it('P19.2-T3 AC-4 Import people’s own 44px lines are its own: the Super Admin’s roster import draws what it drew', async () => {
    // `touchTargets` is opt-in (`RosterImport`): `/admin/tenants/[kpmId]/roster` does not pass it (UI-135 is T2's).
    const source = readFileSync(join(__dirname, '..', '..', '(admin)', 'admin', 'tenants', '[kpmId]', 'roster', 'page.tsx'), 'utf8');
    expect(source).not.toContain('touchTargets');
    const office = readFileSync(join(__dirname, 'import', 'page.tsx'), 'utf8');
    expect(office).toContain('touchTargets');
  });
});

describe('P19.2-T3 AC-2 the last-activity pill’s week is the office’s rolling week', () => {
  it('P19.2-T3 AC-2 RECENT_ACTIVITY_DAYS is the backend’s PERIOD.ROLLING_7D_DAYS, read from its constants module', () => {
    const constants = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'index.ts'), 'utf8',
    );
    const declared = /ROLLING_7D_DAYS:\s*(\d+)/.exec(constants);
    expect(Number(declared?.[1])).toBe(RECENT_ACTIVITY_DAYS);
  });

  it('P19.2-T3 AC-2 today and the six days before it are within the week; the seventh, never and nothing are not', () => {
    expect([0, 1, 6].map(loggedRecently)).toEqual([true, true, true]);
    expect([7, 14, null, undefined].map(loggedRecently)).toEqual([false, false, false, false]);
  });
});
