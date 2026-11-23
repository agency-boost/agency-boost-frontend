import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, routeParams, stubFetch, wears } from '@test/harness';
import { transfer } from '@test/joining-fixtures';
import AdminsPage from './admins/page';
import PeopleImportPage from './import/page';
import MemberPage from './members/[membershipId]/page';
import MembersPage from './members/page';
import OrgTreePage from './org-tree/page';
import { budi, KPM_TREE, row as rosterRow } from '@test/people-fixtures';

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
    'org_tree:read', 'kpm:import_roster', 'member:change_role', 'member:tag_group', 'member:read_role_change_log',
    'member:complete_personal',
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

const COUNTS = { directory: 2, pending: 1, removed: 0 };
const ROSTER = [rosterRow(), rosterRow({ membershipId: 'mem-dewi', role: 'aab', fullName: 'Dewi Lestari', isCoreLeader: false })];
const MEMBERS_ROUTES = {
  '/transfer-requests': { body: [transfer()] },
  '/join/requests': { body: [] },
  '/people/history': { body: [{ id: 'h-1', kind: 'role', membershipId: 'mem-dewi', fullName: 'Dewi Lestari', agentCode: '80007', role: 'aab', photoUrl: null, fromRole: 'agent', toRole: 'aab', fromLeaderName: null, toLeaderName: null, reason: null, actorName: 'Agus Prasetyo', at: '2026-10-07T02:00:00.000Z', openable: true }] },
  '/members/mem-budi/tags': { body: {} },
  '/members/mem-budi': { body: budi() },
  '/members': (req: { url: string }) => ({
    body: {
      members: req.url.includes('status=pending') ? [rosterRow({ membershipId: 'mem-p', fullName: 'Putri Anggraini', status: 'pending', groupPlace: undefined })] : ROSTER,
      nextCursor: req.url.includes('status=pending') ? null : 'next',
      counts: COUNTS,
    },
  }),
};

describe('P19.20 no target under 44px on /people/* at 375 and 768 (UI-142)', () => {
  it.each([375, 768])('P19.20-T1 at %ipx All members: the tabs, the search, the chips, the rows, the group chips and See all', async (px) => {
    atWidth(px);
    stubFetch(MEMBERS_ROUTES);
    inShell(<MembersPage />);
    await screen.findAllByText('Dewi Lestari');
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.20-T1 at %ipx Menunggu and Riwayat', async (px) => {
    atWidth(px);
    stubFetch(MEMBERS_ROUTES);
    inShell(<MembersPage />);
    await userEvent.click(await screen.findByRole('tab', { name: /Waiting/ }));
    await screen.findByText('Putri Anggraini');
    expect(under44(px)).toEqual([]);
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    await screen.findByRole('list', { name: 'History, newest first' });
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.20-T2 at %ipx the member sheet: its pencils, + Isi, ✓ and its two buttons', async (px) => {
    atWidth(px);
    stubFetch(MEMBERS_ROUTES);
    inShell(<MemberPage params={routeParams({ membershipId: 'mem-budi' })} />);
    const sheet = await screen.findByRole('dialog');
    await within(sheet).findByText('Budi Santoso');
    expect(under44(px, sheet)).toEqual([]);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Change Agent code' }));
    expect(under44(px, sheet)).toEqual([]);
  });

  it.each([375, 768])('P19.20-T3 at %ipx Org tree: the search, Buka semua, every row and ⌄', async (px) => {
    atWidth(px);
    stubFetch({ '/members/tree': { body: KPM_TREE } });
    inShell(<OrgTreePage />);
    await screen.findByText('Agus Prasetyo');
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.20-T4 at %ipx KPM admins: Tambah admin and Cabut', async (px) => {
    atWidth(px);
    stubFetch({
      '/members/admins': { body: [{ membershipId: 'mem-maya', fullName: 'Maya Halim', initials: 'MH', agentCode: '80004', role: 'ab', grantedAt: null, grantedByName: null, canRevoke: true, photoUrl: null }] },
      '/people/stewards': { body: { owner: null, owners: [], canManageOwners: false, admins: 1, coreLeaders: 0 } },
    });
    inShell(<AdminsPage />);
    await screen.findByText('Maya Halim');
    expect(under44(px)).toEqual([]);
  });

  it.each([375, 768])('P19.20-T5 at %ipx Import people: the card’s buttons, Lihat kolom and its grid, the structure', async (px) => {
    atWidth(px);
    stubFetch({ '/members/tree': { body: KPM_TREE }, '/people/imports': { body: [] } });
    inShell(<PeopleImportPage />);
    await screen.findAllByText('Agus Prasetyo');
    await userEvent.click(screen.getByRole('button', { name: 'See the columns' }));
    expect(under44(px)).toEqual([]);
  });
});
