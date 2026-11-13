import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { SRC } from '@test/copy-scan';
import { atWidth, makeMe, renderInIndonesian, renderLive, renderWithSession, resetLanguage, wears } from '@test/harness';
import AdminLayout from '@/app/(admin)/layout';
import TenantLayout from '@/app/(tenant)/layout';
import { shellMessages } from '@/i18n/messages/shell';
import type { Me } from '@/lib/session';
import { VIEW_KEY, resetViewsForTest } from '@/lib/views';
import { ImpersonationBanner } from './impersonation-banner';
import { Page } from './page';
import { Shell } from './shell';

/**
 * **P19.2-T1: one shell for every role, and the view switcher** (UI-146, UI-147, UI-169 items 1–4, UI-127 to UI-130;
 * ADR-0197, ADR-0198). Each role in the one shell at the four widths that decide it — 375, 768, 1024, 1280 — its menu,
 * its views and where a switch lands. Linked logins (*Tambah akun*, AC-8) are `linked-logins.spec.tsx`'s.
 */
const nav = vi.hoisted(() => ({ path: '/home', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(),
}));

function member(over: Partial<NonNullable<Me['membership']>> = {}, me: Partial<Me> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, office: { code: '0417', branch: 'Cempaka Putih' }, ...over,
    },
    ...me,
  });
}

/** Staging's four accounts (UI-146's *Seen as*), as their sessions read. */
const OWNER = member({ isKpmOwner: true, directCount: 3 }, {
  user: { ...makeMe().user, email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto', preferredName: 'Wilson', initials: 'WT' },
  permissions: ['member:read_profile', 'kpm_overview:read'],
});
const ADMIN = member({ isKpmAdmin: true, orgLevelCode: 'AGENT', hierarchyRole: 'agent' }, {
  user: { ...makeMe().user, email: 'admin@kpm0417.test', fullName: 'Maya Halim', preferredName: 'Maya', initials: 'MH' },
  permissions: ['member:read_profile', 'kpm_overview:read'],
});
const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Platform Operator', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all'],
});
const NEWCOMER = makeMe({
  user: { ...makeMe().user, email: 'newcomer@agencyboost.test', fullName: 'Nadia Putri', preferredName: null, initials: 'NP' },
  membership: null,
  permissions: ['kpm:read_directory', 'profile:read_self'],
});
const AB = member({ directCount: 4 }, { permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'] });
const AGENT = member({ orgLevelCode: 'AGENT', hierarchyRole: 'agent' });

const ROLES = [
  ['the Owner', OWNER, '/kpm/overview'],
  ['the Admin', ADMIN, '/people/members'],
  ['the Super Admin', SUPER_ADMIN, '/admin'],
  ['somebody in no office', NEWCOMER, '/profile'],
] as const;

/** A page in the one shell, as a layout and its page render it. */
function page(title = 'Overview', body: React.ReactNode = <p>content</p>) {
  return (
    <Shell>
      <Page title={title}>{body}</Page>
    </Shell>
  );
}

const tabBar = () => document.querySelector<HTMLElement>('[data-tab-bar]');
const tabWords = () => Array.from(tabBar()!.querySelectorAll('[data-tab]')).map((tab) => (tab.textContent ?? '').trim());
const frame = () => document.querySelector<HTMLElement>('[data-surface]')!;
const titleAvatar = () => document.querySelector<HTMLElement>('[data-title-avatar]')!;

async function openViews() {
  await userEvent.click(titleAvatar());
  return within(document.querySelector<HTMLElement>('[data-view-menu]')!);
}

beforeEach(() => {
  window.localStorage.clear();
  resetViewsForTest();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  nav.path = '/home';
  nav.push.mockClear();
  nav.replace.mockClear();
  resetLanguage();
});

describe('P19.2-T1 AC-1 every role in the one shell (UI-146)', () => {
  it.each(ROLES)('P19.2-T1 AC-1 %s at 375px: no dark top bar, the page token, the 20px title row with the 36px avatar', (_, me, path) => {
    atWidth(375);
    nav.path = path;
    renderWithSession(page(), { me });
    expect(document.querySelector('aside')).toBeNull();
    expect(document.querySelector('.bg-navy.sticky')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    // The page token (#EDEDEA) is the V1 surface's `--color-base`, every role's frame.
    expect(frame()).toHaveAttribute('data-surface', 'v1');
    expect(readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8')).toMatch(/:root:has\(\[data-surface='v1'\]\) \{\s*--color-base: #ededea;/);
    const title = screen.getByRole('heading', { level: 1, name: 'Overview' });
    expect(title).toHaveClass('text-title', 'font-extrabold', 'text-navy');
    expect(titleAvatar().querySelector('[aria-hidden="true"]')).toHaveClass('h-9', 'w-9');
    expect(tabBar()).not.toBeNull();
  });

  it.each(ROLES)('P19.2-T1 AC-1 %s at 1280px: the sidebar’s headings sentence case, 12px grey — none upper case', (_, me, path) => {
    atWidth(1280);
    nav.path = path;
    renderWithSession(page(), { me });
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    const headings = within(sidebar).getAllByRole('button', { expanded: true });
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading.className).not.toContain('uppercase');
      expect(heading).toHaveClass('text-xs', 'text-secondary-contrast/65');
    }
    expect(tabBar()).toBeNull();
  });

  it('P19.2-T1 AC-1 the title is 22px on a tablet on /admin, /kpm and /people, 20px on every other page (ADR-0197 §2)', () => {
    atWidth(768);
    const css = readFileSync(join(SRC, 'styles', 'globals.css'), 'utf8');
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1023\.98px\) \{\s*:root:has\(\[data-title-size='office'\]\) \{\s*--text-title: 1\.375rem;/,
    );
    for (const [me, path, office] of [
      [SUPER_ADMIN, '/admin/companies', true], [OWNER, '/kpm/settings/products', true], [ADMIN, '/people/org-tree', true],
      [OWNER, '/home', false], [OWNER, '/leader-meetings', false], [SUPER_ADMIN, '/profile', false], [AB, '/goals', false],
    ] as const) {
      nav.path = path;
      const { unmount } = renderWithSession(page(), { me });
      expect([path, frame().getAttribute('data-title-size')]).toEqual([path, office ? 'office' : null]);
      unmount();
    }
  });
});

describe('P19.2-T1 AC-2 the office’s and the platform’s routes render inside the shared layout', () => {
  it.each([768, 1024] as const)('P19.2-T1 AC-2 (tenant)/layout draws the one shell for the Owner at %ipx: the bar or the rail, no console', (px) => {
    atWidth(px);
    nav.path = '/kpm/overview';
    renderWithSession(<TenantLayout><Page title="Overview"><p>content</p></Page></TenantLayout>, { me: OWNER });
    expect(frame()).toHaveAttribute('data-surface', 'v1');
    expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
    if (px === 768) expect(tabWords()).toEqual(['Activity', 'Calendar', 'Home', 'Unit', 'More']);
    else expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();
  });

  it.each([768, 1024] as const)('P19.2-T1 AC-2 (admin)/layout draws the one shell for the Super Admin at %ipx', (px) => {
    atWidth(px);
    nav.path = '/admin';
    renderWithSession(<AdminLayout><Page title="Overview"><p>content</p></Page></AdminLayout>, { me: SUPER_ADMIN });
    expect(frame()).toHaveAttribute('data-surface', 'v1');
    if (px === 768) expect(tabWords()).toEqual(['Overview', 'KPMs', 'Companies', 'Analytics', 'More']);
    else expect(screen.getByRole('button', { name: 'Collapse the sidebar' })).toBeInTheDocument();
  });

  it('P19.2-T1 AC-2 the families stay: the office layout still sends an Agent to their own landing, the platform’s an Owner', () => {
    nav.path = '/kpm/overview';
    const { unmount } = renderWithSession(<TenantLayout><p>secret</p></TenantLayout>, { me: AGENT });
    expect(nav.replace).toHaveBeenCalledWith('/home');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    unmount();
    nav.path = '/admin';
    renderWithSession(<AdminLayout><p>secret</p></AdminLayout>, { me: OWNER });
    expect(nav.replace).toHaveBeenLastCalledWith('/home');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});

describe('P19.2-T1 AC-3 no Buka tampilan anywhere (UI-147, UI-169 item 3)', () => {
  it('P19.2-T1 AC-3 the catalogue holds no Open agent / Owner / Admin view', () => {
    for (const language of ['en', 'id'] as const) {
      const words = shellMessages[language] as unknown as Record<string, unknown>;
      expect(Object.keys(words)).not.toEqual(expect.arrayContaining(['openAgentView']));
      for (const key of ['openAgentView', 'openOwnerView', 'openAdminView']) expect(key in words).toBe(false);
    }
  });

  it.each([...ROLES, ['an AB', AB, '/home'] as const])('P19.2-T1 AC-3 %s: the rendered shell says it nowhere, its menus open', async (_, me, path) => {
    nav.path = path;
    atWidth(375);
    const phone = renderInIndonesian(page(), { me });
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
    await screen.findByRole('dialog', { name: 'Lainnya' });
    if (titleAvatar().tagName === 'BUTTON') await userEvent.click(titleAvatar());
    expect(document.body.textContent).not.toMatch(/Buka tampilan|Open (agent|Owner|Admin) view/);
    phone.unmount();
    atWidth(1280);
    renderInIndonesian(page(), { me });
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    expect(document.body.textContent).not.toMatch(/Buka tampilan|Open (agent|Owner|Admin) view/);
  });
});

describe('P19.2-T1 AC-4 after signing in, an Owner or an Admin is on their own Home, in Akun saya', () => {
  it.each([['an Owner', OWNER], ['an Admin', ADMIN]] as const)('P19.2-T1 AC-4 %s on /home with nothing remembered is in Akun saya', async (_, me) => {
    atWidth(375);
    nav.path = '/home';
    renderInIndonesian(page('Home'), { me });
    expect(within(titleAvatar()).getByText('Akun saya')).toBeInTheDocument();
    expect(titleAvatar()).toHaveAccessibleName('Akun Anda: Akun saya');
    // *Akun saya*'s menu: the field's groups, none of the office's.
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
    const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
    expect(within(sheet).queryByRole('heading', { name: 'Pengaturan' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: 'Tim saya' })).toBeInTheDocument();
  });

  it('P19.2-T1 AC-4 sign-in and sign-out forget the tab’s view, so the next session starts on Akun saya', () => {
    const provider = readFileSync(join(SRC, 'components', 'session-provider.tsx'), 'utf8');
    // Signing in adopts the session it was given (P19.12-T2: registering too), and adopting is where the view is forgotten.
    const adopt = provider.slice(provider.indexOf('const adopt = useCallback'), provider.indexOf('const signIn = useCallback'));
    const signIn = provider.slice(provider.indexOf('const signIn = useCallback'), provider.indexOf('const signOut = useCallback'));
    const signOut = provider.slice(provider.indexOf('const signOut = useCallback'), provider.indexOf('const endSupportSession'));
    expect(adopt).toContain('forgetView();');
    expect(signIn).toContain('return adopt(accessToken);');
    expect(signOut).toContain('forgetView();');
  });
});

describe('P19.2-T1 AC-5 the views in the avatar menu, on every page (UI-169 item 2)', () => {
  it('P19.2-T1 AC-5 an Owner’s: Akun saya · KPM Owner · <nama KPM>, the active one ticked, each a 44px target', async () => {
    nav.path = '/home';
    renderInIndonesian(page('Home'), { me: OWNER });
    const menu = await openViews();
    const entries = within(menu.getByRole('list', { name: 'Tampilan' })).getAllByRole('button');
    expect(entries.map((b) => b.textContent)).toEqual(['Akun saya', 'KPM Owner · Cempaka Putih']);
    expect(entries[0]).toHaveAttribute('aria-current', 'true');
    expect(entries[0].querySelector('svg')).not.toBeNull();
    expect(entries[1]).not.toHaveAttribute('aria-current');
    for (const entry of entries) expect(entry).toHaveClass('min-h-11');
    // Where the avatar always went is still in it.
    expect(menu.getByRole('link', { name: 'Profil saya' })).toHaveAttribute('href', '/profile');
  });

  it('P19.2-T1 AC-5 an Admin’s office entry is KPM Admin · <nama KPM>', async () => {
    nav.path = '/home';
    renderInIndonesian(page('Home'), { me: ADMIN });
    const menu = await openViews();
    // The views, then *Keluar* last (P19.11-T6 AC-1).
    expect(menu.getAllByRole('button').map((b) => b.textContent)).toEqual(['Akun saya', 'KPM Admin · Cempaka Putih', 'Keluar']);
  });

  it.each([375, 768, 1024, 1280])('P19.2-T1 AC-5 at %ipx the header names the active view beside the avatar, and in its name', (px) => {
    atWidth(px);
    nav.path = '/kpm/settings/products';
    renderInIndonesian(page('Products'), { me: OWNER });
    const named = titleAvatar().querySelector('[data-active-view]')!;
    expect(named).toHaveTextContent('KPM Owner');
    expect(wears(named, px)).toContain('text-xs');
    expect(titleAvatar()).toHaveAccessibleName('Akun Anda: KPM Owner');
  });

  it.each([['an AB', AB], ['an Agent', AGENT], ['somebody in no office', NEWCOMER], ['a Super Admin', SUPER_ADMIN]] as const)(
    'P19.2-T1 AC-5 %s has one view: no switcher, and nothing added to the header',
    async (_, me) => {
      atWidth(1280);
      nav.path = me === SUPER_ADMIN ? '/admin' : me === NEWCOMER ? '/profile' : '/home';
      renderWithSession(page(), { me });
      expect(titleAvatar().tagName).toBe('A');
      expect(titleAvatar()).toHaveAccessibleName('Your profile');
      expect(document.querySelector('[data-active-view]')).toBeNull();
      await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
      expect(document.querySelector('[data-account-views]')).toBeNull();
    },
  );

  it('P19.2-T1 AC-5 one tap switches, from either menu, and lands on that view’s landing', async () => {
    nav.path = '/home';
    renderWithSession(page('Home'), { me: OWNER });
    let menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'KPM Owner · Cempaka Putih' }));
    expect(nav.push).toHaveBeenLastCalledWith('/kpm/overview');
    expect(window.sessionStorage.getItem(VIEW_KEY)).toBe('kpm_owner');
    expect(document.querySelector('[data-view-menu]')).toBeNull();
    // The sidebar's account menu at 1280px holds the same list.
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    const account = within(document.getElementById('sidebar-user-actions')!);
    await userEvent.click(account.getByRole('button', { name: 'My account' }));
    expect(nav.push).toHaveBeenLastCalledWith('/home');
    expect(window.sessionStorage.getItem(VIEW_KEY)).toBe('self');
    menu = await openViews();
    expect(menu.getByRole('button', { name: 'My account' })).toHaveAttribute('aria-current', 'true');
  });

  it('P19.2-T1 AC-5 Escape closes the avatar’s menu and gives the focus back; a click outside closes it too', async () => {
    nav.path = '/home';
    renderWithSession(page('Home'), { me: OWNER });
    await openViews();
    await userEvent.keyboard('{Escape}');
    expect(document.querySelector('[data-view-menu]')).toBeNull();
    expect(titleAvatar()).toHaveFocus();
    await openViews();
    await userEvent.click(screen.getByText('content'));
    expect(document.querySelector('[data-view-menu]')).toBeNull();
  });
});

describe('P19.2-T1 AC-6 the office view’s menu (UI-147)', () => {
  it('P19.2-T1 AC-6 at 375px the Owner on an office page: the leader bar, and Lainnya adds KPM · Pengaturan · People after Program', async () => {
    atWidth(375);
    nav.path = '/kpm/overview';
    renderInIndonesian(page(), { me: OWNER });
    expect(tabWords()).toEqual(['Activity', 'Calendar', 'Home', 'Unit', 'Lainnya']);
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
    const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
    expect(within(sheet).getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Saya', 'Aktivitas', 'Tim saya', 'Program', 'KPM', 'Pengaturan', 'People']);
    expect(within(sheet).getByRole('link', { name: 'Manage KPM admins' })).toHaveAttribute('href', '/people/admins');
    expect(within(sheet).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it('P19.2-T1 AC-6 at 1280px the Admin’s sidebar: the same groups, without Manage KPM admins', () => {
    atWidth(1280);
    nav.path = '/people/members';
    renderInIndonesian(page('All members'), { me: ADMIN });
    const sidebar = within(screen.getByRole('navigation', { name: 'Utama' }));
    for (const heading of ['KPM', 'Pengaturan', 'People']) expect(sidebar.getByRole('button', { name: heading })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'All members' })).toHaveAttribute('aria-current', 'page');
    expect(sidebar.queryByRole('link', { name: 'Manage KPM admins' })).not.toBeInTheDocument();
  });

  it('P19.2-T1 AC-6 a field page after an office page keeps the office view: the tab remembers it', () => {
    atWidth(1280);
    nav.path = '/kpm/data-upload';
    const first = renderWithSession(page('Data upload'), { me: OWNER });
    expect(window.sessionStorage.getItem(VIEW_KEY)).toBe('kpm_owner');
    first.unmount();
    nav.path = '/calendar';
    renderWithSession(page('Calendar'), { me: OWNER });
    expect(screen.getByRole('link', { name: 'Data upload' })).toBeInTheDocument();
    expect(titleAvatar()).toHaveAccessibleName('Your account: KPM Owner');
  });
});

describe('P19.2-T1 AC-7 switching never mixes data, and needs no sign-out', () => {
  it('P19.2-T1 AC-7 from KPM Owner to Akun saya on /kpm/overview lands on Home', async () => {
    nav.path = '/kpm/overview';
    renderWithSession(page(), { me: OWNER });
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'My account' }));
    expect(nav.push).toHaveBeenCalledWith('/home');
  });

  it('P19.2-T1 AC-7 a switch clears the cached reads: the page under the shell mounts afresh and reads again', async () => {
    nav.path = '/home';
    const mounts = vi.fn();
    function Reader() {
      useEffect(() => { mounts(); }, []);
      return <p>content</p>;
    }
    renderWithSession(page('Home', <Reader />), { me: OWNER });
    expect(mounts).toHaveBeenCalledTimes(1);
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'KPM Owner · Cempaka Putih' }));
    expect(mounts).toHaveBeenCalledTimes(2);
  });

  it('P19.2-T1 AC-7 the view is never in a request: a switch sends nothing to the API', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) } as Response));
    vi.stubGlobal('fetch', fetch);
    nav.path = '/home';
    renderWithSession(page('Home'), { me: OWNER });
    fetch.mockClear();
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'KPM Owner · Cempaka Putih' }));
    expect(fetch).not.toHaveBeenCalled();
    expect(readFileSync(join(SRC, 'lib', 'api-client.ts'), 'utf8')).not.toMatch(/ab\.view|VIEW_KEY|views'/);
  });

  it('P19.2-T1 AC-7 with storage refused nothing fails: the page decides — an office page the office view, Home Akun saya', () => {
    const refuse = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
    nav.path = '/kpm/overview';
    const office = renderWithSession(page(), { me: OWNER });
    expect(titleAvatar()).toHaveAccessibleName('Your account: KPM Owner');
    office.unmount();
    // A reload, storage still refused: nothing outlives the page.
    resetViewsForTest();
    nav.path = '/home';
    renderWithSession(page('Home'), { me: OWNER });
    expect(titleAvatar()).toHaveAccessibleName('Your account: My account');
  });
});

describe('P19.2-T1 AC-9 the Super Admin’s phone (UI-127)', () => {
  it.each([360, 375])('P19.2-T1 AC-9 at %ipx: Overview · KPMs · Perusahaan · Analytics · Lainnya, labelled, never wrapping', (px) => {
    atWidth(px);
    nav.path = '/admin/tenants';
    renderInIndonesian(page('All KPMs'), { me: SUPER_ADMIN });
    expect(tabWords()).toEqual(['Overview', 'KPMs', 'Perusahaan', 'Analytics', 'Lainnya']);
    const bar = within(tabBar()!);
    expect(bar.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/admin');
    expect(bar.getByRole('link', { name: 'KPMs' })).toHaveAttribute('href', '/admin/tenants');
    expect(bar.getByRole('link', { name: 'KPMs' })).toHaveAttribute('aria-current', 'page');
    expect(bar.getByRole('link', { name: 'Perusahaan' })).toHaveAttribute('href', '/admin/companies');
    expect(bar.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/admin/analytics');
    for (const face of tabBar()!.querySelectorAll('[data-tab-face]')) expect(face).toHaveClass('whitespace-nowrap');
  });

  it('P19.2-T1 AC-9 Lainnya: the account row with ID | EN, the sidebar’s groups as tiles four to a row, Keluar last', async () => {
    atWidth(375);
    nav.path = '/admin';
    renderLive(page(), { me: SUPER_ADMIN });
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Lainnya' }));
    expect(sheet.getByText('Platform Operator')).toBeInTheDocument();
    expect(sheet.getByRole('group', { name: 'Bahasa' })).toBeInTheDocument();
    expect(sheet.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Companies', 'KPMs', 'Platform admin', 'Reporting']);
    const tiles = (group: string) => Array.from(document.querySelectorAll(`[data-more-group="${group}"] [data-tile]`)).map((t) => t.textContent);
    expect(tiles('companies')).toEqual(['Manage companies', 'Org role ladder']);
    // P19.4-T3 AC-1 (SA UI-010): *All members* after *All KPMs*.
    expect(tiles('kpms')).toEqual(['All KPMs', 'All members', 'Pending KPM requests', 'Leaders past the limit', 'Billing & subscription']);
    expect(tiles('platformAdmin')).toEqual(['KPM Owners & Admins', 'Audit / role change log']);
    expect(tiles('reporting')).toEqual(['Cross-platform analytics']);
    expect(document.querySelector('[data-more-group="companies"] ul')).toHaveClass('grid-cols-4');
    const last = Array.from(screen.getByRole('dialog', { name: 'Lainnya' }).querySelectorAll('a[href], button')).at(-1)!;
    expect(last).toHaveTextContent('Keluar');
  });

  it('P19.2-T1 AC-9, AC-13 the bell keeps its place on the Super Admin’s Overview below 1024px, as on Home', () => {
    atWidth(375);
    nav.path = '/admin';
    renderWithSession(page(), { me: SUPER_ADMIN });
    expect(document.querySelector('[data-title-bell]')).toHaveAttribute('href', '/notifications');
  });
});

describe('P19.2-T1 AC-10 /admin on a tablet uses the phone’s navigation; the labelled sidebar from 1024px (UI-128)', () => {
  it.each([768, 1023])('P19.2-T1 AC-10 at %ipx: no rail of icons — the bar, every item labelled, a 64px pill', (px) => {
    atWidth(px);
    nav.path = '/admin/audit';
    renderWithSession(page('Audit / Role Change Log'), { me: SUPER_ADMIN });
    expect(document.querySelector('aside')).toBeNull();
    expect(tabBar()).toHaveClass('h-16');
    for (const tab of tabBar()!.querySelectorAll('[data-tab]')) expect((tab.textContent ?? '').trim()).not.toBe('');
  });

  it.each([1024, 1152, 1280])('P19.2-T1 AC-10 at %ipx: the labelled sidebar, its groups as today, SUPERADMIN under the wordmark', (px) => {
    atWidth(px);
    nav.path = '/admin/companies';
    renderWithSession(page('Manage Companies'), { me: SUPER_ADMIN });
    expect(screen.getByRole('button', { name: 'Collapse the sidebar' })).toBeInTheDocument();
    const sidebar = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(sidebar.getAllByRole('button', { expanded: true }).map((b) => b.textContent)).toEqual(['Companies', 'KPMs', 'Platform admin', 'Reporting']);
    expect(sidebar.getByRole('link', { name: 'Manage companies' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
  });

  it.each([1024, 1152])('P19.2-T1 AC-10 the Owner’s pages keep Phase 19.1’s rail at %ipx (ADR-0197 §4)', (px) => {
    atWidth(px);
    nav.path = '/kpm/overview';
    renderWithSession(page(), { me: OWNER });
    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();
  });
});

describe('P19.2-T1 AC-11 ID | EN only in the account menu (UI-129)', () => {
  it.each([375, 768, 1024, 1280])('P19.2-T1 AC-11 at %ipx no /admin, /kpm or /people page carries it', (px) => {
    atWidth(px);
    for (const [me, path] of [[SUPER_ADMIN, '/admin/tenants'], [OWNER, '/kpm/settings/products'], [ADMIN, '/people/members']] as const) {
      nav.path = path;
      const { unmount } = renderLive(page(), { me });
      expect(within(document.querySelector('main')!).queryByRole('group', { name: 'Bahasa' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('P19.2-T1 AC-11 at 1280px it is in the sidebar’s account menu, and choosing it changes every page', async () => {
    atWidth(1280);
    nav.path = '/admin';
    renderLive(page(), { me: SUPER_ADMIN });
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    const group = within(document.getElementById('sidebar-user-actions')!).getByRole('group', { name: 'Bahasa' });
    await userEvent.click(within(group).getByRole('button', { name: /EN/ }));
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('P19.2-T1 AC-12 the /admin menu and titles come from the catalogue (UI-130, O-8)', () => {
  /**
   * The keys whose Indonesian the owner has not supplied or approved yet: each still reads its kept English in ID mode.
   * One moves off this list in the change that writes the owner's word for it.
   */
  const AWAITING_APPROVAL = [
    'overview', 'manageCompanies', 'orgRoleLadder', 'allKpms', 'allMembers', 'pendingKpmRequests', 'leadersPastTheLimit', 'billing',
    'tenantAdmins', 'audit', 'crossPlatformAnalytics', 'barKpms', 'barAnalytics',
  ];

  it('P19.2-T1 AC-12 lists the labels still awaiting the owner’s Indonesian; the bar’s Perusahaan is theirs already', () => {
    const { en, id } = shellMessages;
    const same = Object.keys(en.admin).filter((key) => en.admin[key as keyof typeof en.admin] === id.admin[key as keyof typeof id.admin]);
    expect(same).toEqual(AWAITING_APPROVAL);
    expect(id.admin.barCompanies).toBe('Perusahaan');
  });

  it('P19.2-T1 AC-12 every label of the Super Admin’s menu is a catalogue key: what the sidebar draws is the catalogue’s', () => {
    atWidth(1280);
    nav.path = '/admin';
    renderInIndonesian(page(), { me: SUPER_ADMIN });
    const words = new Set(Object.values(shellMessages.id.admin) as string[]);
    const drawn = Array.from(screen.getByRole('navigation', { name: 'Utama' }).querySelectorAll('a')).map((a) => a.textContent ?? '');
    // Ten until P19.4-T3 added *All members* (SA UI-010).
    expect(drawn.length).toBe(11);
    for (const label of drawn) expect(words).toContain(label);
  });
});

describe('P19.2-T1 AC-13 the support banner and the bell keep their places, for every role', () => {
  it.each(ROLES)('P19.2-T1 AC-13 %s at 1280px: the bell at the sidebar’s foot, beside the account', (_, me, path) => {
    atWidth(1280);
    nav.path = path;
    renderWithSession(page(), { me });
    const foot = document.querySelector('[aria-controls="sidebar-user-actions"]')!.closest('div.ml-auto')!;
    expect(within(foot as HTMLElement).getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('P19.2-T1 AC-13 a support session as an Owner: the banner over the one shell, read-only, the Owner’s own views offered', async () => {
    atWidth(375);
    nav.path = '/kpm/overview';
    const supporting = { ...OWNER, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' };
    renderWithSession(<><ImpersonationBanner />{page()}</>, { me: supporting });
    const banner = screen.getAllByRole('status').find((el) => /Wilson/.test(el.textContent ?? ''))!;
    expect(banner).toBeDefined();
    expect(banner.compareDocumentPosition(frame()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabBar()).not.toBeNull();
    const menu = await openViews();
    // The views, then *Sign out* last (P19.11-T6 AC-1): signing out is always available, support session or not.
    expect(menu.getAllByRole('button').map((b) => b.textContent)).toEqual(['My account', 'KPM Owner · Cempaka Putih', 'Sign out']);
    // The root layout mounts the banner once, outside every shell, so the one shell cannot drop it.
    expect(readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8').match(/<ImpersonationBanner \/>/g)).toHaveLength(1);
  });
});

describe('P19.2-T1 axe on the shell, for each role', () => {
  /** Colour contrast needs a canvas jsdom does not have; `contrast.spec.ts` pins the tokens instead. */
  const RULES = { rules: { 'color-contrast': { enabled: false } } };

  it('P19.2-T1 the Owner’s office view at 375px, its avatar menu open', async () => {
    atWidth(375);
    nav.path = '/kpm/overview';
    const { container } = renderWithSession(page(), { me: OWNER });
    await openViews();
    expect((await axe(container, RULES)).violations).toEqual([]);
  });

  it('P19.2-T1 the Admin at 1280px, the sidebar’s account menu open with the views', async () => {
    atWidth(1280);
    nav.path = '/people/members';
    const { container } = renderWithSession(page('All members'), { me: ADMIN });
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    expect((await axe(container, RULES)).violations).toEqual([]);
  });

  it('P19.2-T1 the Super Admin at 375px with Lainnya open', async () => {
    atWidth(375);
    nav.path = '/admin';
    renderWithSession(page(), { me: SUPER_ADMIN });
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('dialog', { name: 'More' });
    await act(async () => undefined);
    expect((await axe(document.body, RULES)).violations).toEqual([]);
  });
});

describe('P19.2-T1 the profile line follows the view (P18.5-T6 AC-2, ported from the office console’s spec)', () => {
  it('P19.2-T1 AC-6 in the office view: KPM Owner · Core Leader · the groups · the office, as the console said it', () => {
    atWidth(1280);
    nav.path = '/people/members';
    const owner = member({ isKpmOwner: true, isCoreLeader: true, groups: ['Top Producers 2026'] });
    renderWithSession(page('All members'), { me: owner });
    expect(screen.getByText('KPM Owner · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih'))
      .toHaveAttribute('title', 'KPM Owner · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih');
  });

  it('P19.2-T1 AC-6 an Admin in no group, untagged, in the office view: KPM Admin · the office', () => {
    atWidth(1280);
    nav.path = '/people/members';
    renderWithSession(page('All members'), { me: member({ isKpmAdmin: true, groups: [] }) });
    expect(screen.getByText('KPM Admin · 0417 · Cempaka Putih')).toBeInTheDocument();
  });

  it('P19.2-T1 AC-6 in Akun saya the rung’s, as every member’s: AB · the office', () => {
    atWidth(1280);
    nav.path = '/home';
    renderWithSession(page('Home'), { me: OWNER });
    expect(screen.getByText('AB · 0417 · Cempaka Putih')).toBeInTheDocument();
  });
});

describe('P19.2-T1 AC-9 the Super Admin’s queue count keeps its place in Lainnya', () => {
  it('P19.2-T1 AC-9 Leaders past the limit carries its pending count on its tile, in its name too', async () => {
    atWidth(375);
    nav.path = '/admin';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }],
    } as Response)));
    renderWithSession(page(), { me: { ...SUPER_ADMIN, permissions: ['kpm:list_all', 'leader_limit_request:decide'] } });
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'More' }));
    await waitFor(() => expect(document.querySelector('[data-tile="leaderLimit"]')).toHaveTextContent('2'));
    expect(sheet.getByRole('link', { name: 'Leaders past the limit, 2' })).toHaveAttribute('href', '/admin/leader-limit-requests');
  });
});

/*
 * **P19.11-T6 AC-1 — *Keluar* in the account dropdown** (UX-8, UXQ5; the owner's screenshot of 9 November): the last row,
 * under *Profil saya* with a divider above it, red as *Lainnya*'s, busy while it runs; one tap ends the session — no
 * confirmation — and `/login` replaces the page. Wherever the dropdown is: at 375, 768 and 1280px. A single-view account
 * has no dropdown, and keeps *Keluar* in *Lainnya*, the sidebar and *Profil*. That the session itself ends — both logins,
 * the token, the cached reads — is `linked-logins.spec.tsx`'s, with the real session provider.
 */
describe('P19.11-T6 AC-1 Keluar in the account dropdown (UX-8)', () => {
  const panel = () => document.querySelector<HTMLElement>('[data-view-menu]')!;

  it.each([375, 768, 1280])('P19.11-T6 AC-1 at %ipx the dropdown ends with Keluar, under Profil saya, a divider above it, red as Lainnya’s', async (px) => {
    atWidth(px);
    nav.path = '/home';
    renderInIndonesian(page('Home'), { me: OWNER });
    const menu = await openViews();
    const out = menu.getByRole('button', { name: 'Keluar' });
    const profile = menu.getByRole('link', { name: 'Profil saya' });
    // The last thing in the panel, and right after *Profil saya*.
    const focusable = [...panel().querySelectorAll('a[href], button')];
    expect(focusable.at(-1)).toBe(out);
    expect(profile.nextElementSibling).toBe(out);
    expect(out).toHaveAttribute('data-sign-out');
    // The divider above it, as above *Profil saya*; *Lainnya*'s red; a 44px row.
    expect(out).toHaveClass('border-t', 'border-divider', 'text-pill-red-ink', 'min-h-11', 'font-semibold');
    expect(profile).toHaveClass('border-t', 'border-divider');
    expect(out).not.toHaveAttribute('aria-busy');
    expect(out).toBeEnabled();
  });

  it('P19.11-T6 AC-1 in English it reads Sign out', async () => {
    nav.path = '/home';
    renderWithSession(page('Home'), { me: OWNER });
    const menu = await openViews();
    expect([...panel().querySelectorAll('a[href], button')].at(-1)).toBe(menu.getByRole('button', { name: 'Sign out' }));
  });

  it('P19.11-T6 AC-1 one tap signs out at once — no confirmation — and /login replaces the page', async () => {
    nav.path = '/kpm/overview';
    const signOut = vi.fn(async () => undefined);
    renderInIndonesian(page(), { me: OWNER, signOut });
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Keluar' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
    // Replaced, never pushed: Back does not return to the page the session was on.
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('P19.11-T6 AC-1 busy while it runs: Sedang keluar…, aria-busy, not pressed twice', async () => {
    nav.path = '/home';
    let finish: () => void = () => undefined;
    const signOut = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderInIndonesian(page('Home'), { me: OWNER, signOut });
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Keluar' }));
    const busy = await within(panel()).findByRole('button', { name: 'Sedang keluar…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
  });

  it.each([375, 1280])('P19.11-T6 AC-1 at %ipx a single-view account has no dropdown: the avatar is its link to Profil, Keluar where it was', async (px) => {
    atWidth(px);
    nav.path = '/home';
    renderInIndonesian(page('Home'), { me: AGENT });
    expect(titleAvatar().tagName).toBe('A');
    expect(titleAvatar()).toHaveAttribute('href', '/profile');
    expect(document.querySelector('[data-sign-out]')).toBeNull();
    if (px < 1024) {
      await userEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
      expect(within(await screen.findByRole('dialog', { name: 'Lainnya' })).getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    } else {
      await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
      expect(screen.getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    }
  });

  it('P19.11-T6 AC-1 axe on the dropdown with Keluar, at 375px', async () => {
    atWidth(375);
    nav.path = '/home';
    const { container } = renderInIndonesian(page('Home'), { me: OWNER });
    await openViews();
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});
