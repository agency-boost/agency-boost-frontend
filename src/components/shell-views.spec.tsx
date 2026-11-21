import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { SRC } from '@test/copy-scan';
import { atWidth, makeMe, renderInIndonesian, renderLive, renderWithSession, resetLanguage } from '@test/harness';
import AdminLayout from '@/app/(admin)/layout';
import TenantLayout from '@/app/(tenant)/layout';
import { shellMessages } from '@/i18n/messages/shell';
import type { Me } from '@/lib/session';
import { ImpersonationBanner } from './impersonation-banner';
import { Page } from './page';
import { Shell } from './shell';

/**
 * **P19.2-T1: one shell for every role** (UI-146, UI-127 to UI-130; ADR-0197). Each role in the one shell at the four
 * widths that decide it — 375, 768, 1024, 1280 — and its menu.
 *
 * *Changed 2026-11-20 (P19.17-T3; ADR-0269):* **the views are gone** (ADR-0198, ADR-0199 superseded): one login, one
 * menu decided by the role, one title row for everybody — the title, the page's control and the 36px avatar to *Profil
 * saya*, no *Akun saya*, no role text, no dropdown. The view switcher's cases (AC-3 to AC-8, the profile line *in the
 * office view*, P19.11-T6's *Keluar* in the avatar's dropdown) went with it; what replaces them is pinned below.
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

beforeEach(() => {
  window.localStorage.clear();
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

  // *Changed 2026-11-20 (P19.17-T3 AC-5; part E):* small grey capitals with a chevron, every group open.
  it.each(ROLES)('P19.2-T1 AC-1, P19.17-T3 AC-5 %s at 1280px: the sidebar’s group names grey capitals, every one open', (_, me, path) => {
    atWidth(1280);
    nav.path = path;
    renderWithSession(page(), { me });
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    const headings = Array.from(sidebar.querySelectorAll<HTMLElement>('[aria-controls^="nav-group"]'));
    // The console's sidebar has no groups since P19.23-T1 (ADR-0277 §1): its six in one list, Platform pinned.
    if (me.user.platformRole !== 'super_admin') expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading).toHaveClass('uppercase', 'text-xs', 'text-secondary-muted');
      expect(heading).toHaveAttribute('aria-expanded', 'true');
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
    renderWithSession(<AdminLayout><Page title="Dashboard"><p>content</p></Page></AdminLayout>, { me: SUPER_ADMIN });
    expect(frame()).toHaveAttribute('data-surface', 'v1');
    // P19.23-T1 AC-1 (ADR-0277 §1): the console's bar, and from 1024px its rail.
    if (px === 768) expect(tabWords()).toEqual(['Dashboard', 'KPM', 'Members', 'Subscriptions', 'More']);
    else expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();
  });

  it('P19.2-T1 AC-2 the families stay: the office layout still sends an Agent to their own landing, the platform’s an Owner', () => {
    nav.path = '/kpm/overview';
    const { unmount } = renderWithSession(<TenantLayout><p>secret</p></TenantLayout>, { me: AGENT });
    expect(nav.replace).toHaveBeenCalledWith('/home');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    unmount();
    nav.path = '/admin';
    renderWithSession(<AdminLayout><p>secret</p></AdminLayout>, { me: OWNER });
    // P19.17-T3 AC-8: the Owner's own landing is the KPM Overview.
    expect(nav.replace).toHaveBeenLastCalledWith('/kpm/overview');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});

describe('P19.2-T1 AC-3, P19.17-T3 AC-1 no view, no switcher, no second login anywhere (ADR-0269 §1)', () => {
  it('P19.17-T3 AC-1 the catalogue holds no Open agent view, no Akun saya, no Tambah akun, no Panduan', () => {
    for (const language of ['en', 'id'] as const) {
      const words = shellMessages[language] as unknown as Record<string, unknown>;
      for (const key of [
        'openAgentView', 'openOwnerView', 'openAdminView', 'views', 'viewSelf', 'viewKpmOwner', 'viewKpmAdmin',
        'viewSuperAdmin', 'viewMenu', 'addAccount', 'guide', 'opensInNewTab',
      ]) expect(key in words).toBe(false);
    }
  });

  it.each([...ROLES, ['an AB', AB, '/home'] as const])('P19.2-T1 AC-3 %s: the rendered shell says it nowhere, its menus open', async (_, me, path) => {
    nav.path = path;
    atWidth(375);
    const phone = renderInIndonesian(page(), { me });
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
    await screen.findByRole('dialog', { name: 'Lainnya' });
    // The title row's avatar is a link to *Profil saya* for everybody: no menu behind it.
    expect(titleAvatar().tagName).toBe('A');
    expect(document.body.textContent).not.toMatch(/Buka tampilan|Open (agent|Owner|Admin) view|Akun saya|Tambah akun|Panduan/);
    phone.unmount();
    atWidth(1280);
    renderInIndonesian(page(), { me });
    await userEvent.click(document.querySelector<HTMLElement>('[aria-controls="sidebar-user-actions"]')!);
    expect(document.body.textContent).not.toMatch(/Buka tampilan|Open (agent|Owner|Admin) view|Akun saya|Tambah akun|Panduan/);
  });
});

/*
 * **P19.17-T3 AC-2: one title row for everyone** (ADR-0269 §2; the brief's gap 4): the page's title, its control and the
 * 36px avatar — the AB's — for the Owner and the Admin too: no *Akun saya* or *KPM Owner* beside the circle, no role text.
 */
describe('P19.17-T3 AC-2 one title row for everyone', () => {
  it.each([375, 768, 1024, 1280])('P19.17-T3 AC-2 at %ipx the Owner’s title row is the AB’s: the title, then the 36px avatar, a link to Profil saya', (px) => {
    atWidth(px);
    for (const [me, path] of [[OWNER, '/kpm/overview'], [ADMIN, '/people/members'], [AB, '/home'], [AGENT, '/home']] as const) {
      nav.path = path;
      const { unmount } = renderWithSession(page(), { me });
      const row = document.querySelector<HTMLElement>('[data-title-row]')!;
      const avatar = titleAvatar();
      expect(avatar.tagName).toBe('A');
      expect(avatar).toHaveAttribute('href', '/profile');
      expect(avatar).toHaveAccessibleName('Your profile');
      expect(avatar.querySelector('[aria-hidden="true"]')).toHaveClass('h-9', 'w-9');
      expect(row.querySelector('[data-active-view], [data-view-menu]')).toBeNull();
      expect(row.textContent).not.toMatch(/My account|KPM Owner|KPM Admin|Superadmin/);
      unmount();
    }
  });
});



describe('P19.23-T1 AC-1 the Super Admin’s phone (ADR-0277 §1)', () => {
  it.each([360, 375])('P19.23-T1 AC-1 at %ipx: Dashboard · KPM · Anggota · Langganan · Lainnya, labelled, never wrapping', (px) => {
    atWidth(px);
    nav.path = '/admin/tenants';
    renderInIndonesian(page('KPM'), { me: SUPER_ADMIN });
    expect(tabWords()).toEqual(['Dashboard', 'KPM', 'Anggota', 'Langganan', 'Lainnya']);
    const bar = within(tabBar()!);
    expect(bar.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
    expect(bar.getByRole('link', { name: 'KPM' })).toHaveAttribute('href', '/admin/tenants');
    expect(bar.getByRole('link', { name: 'KPM' })).toHaveAttribute('aria-current', 'page');
    expect(bar.getByRole('link', { name: 'Anggota' })).toHaveAttribute('href', '/admin/members');
    expect(bar.getByRole('link', { name: 'Langganan' })).toHaveAttribute('href', '/admin/billing');
    for (const face of tabBar()!.querySelectorAll('[data-tab-face]')) expect(face).toHaveClass('whitespace-nowrap');
  });

  it('P19.23-T1 AC-1 Lainnya: the account row with ID | EN, Perusahaan & template · Persetujuan · Platform, Keluar last', async () => {
    atWidth(375);
    nav.path = '/admin';
    renderLive(page(), { me: SUPER_ADMIN });
    await userEvent.click(screen.getByRole('button', { name: 'Lainnya' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Lainnya' }));
    expect(sheet.getByText('Platform Operator')).toBeInTheDocument();
    expect(sheet.getByRole('group', { name: 'Bahasa' })).toBeInTheDocument();
    const tiles = Array.from(document.querySelectorAll('[data-more-group="console"] [data-tile]')).map((t) => t.textContent);
    expect(tiles).toEqual(['Perusahaan & template', 'Persetujuan', 'Platform']);
    const last = Array.from(screen.getByRole('dialog', { name: 'Lainnya' }).querySelectorAll('a[href], button')).at(-1)!;
    expect(last).toHaveTextContent('Keluar');
  });

  it('P19.2-T1 AC-9, AC-13 the bell keeps its place on the Super Admin’s Dashboard below 1024px, as on Home', () => {
    atWidth(375);
    nav.path = '/admin';
    renderWithSession(page(), { me: SUPER_ADMIN });
    expect(document.querySelector('[data-title-bell]')).toHaveAttribute('href', '/notifications');
  });
});

describe('P19.23-T1 AC-1 the console’s rail on a tablet and a laptop, Platform pinned (ADR-0277 §1)', () => {
  it.each([768, 1023])('P19.2-T1 AC-10 at %ipx: no sidebar yet — the bar, every item labelled, a 64px pill', (px) => {
    atWidth(px);
    nav.path = '/admin/platform/audit';
    renderWithSession(page('Platform'), { me: SUPER_ADMIN });
    expect(document.querySelector('aside')).toBeNull();
    expect(tabBar()).toHaveClass('h-16');
    for (const tab of tabBar()!.querySelectorAll('[data-tab]')) expect((tab.textContent ?? '').trim()).not.toBe('');
  });

  it.each([1024, 1152])('P19.23-T1 AC-1 at %ipx: the rail of the six, Platform pinned under a line, SUPERADMIN once open', (px) => {
    atWidth(px);
    nav.path = '/admin/companies';
    renderWithSession(page('Perusahaan'), { me: SUPER_ADMIN });
    expect(document.querySelector('aside')).toHaveAttribute('data-sidebar', 'rail');
    const rail = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(rail.getByRole('link', { name: 'Companies' })).toHaveAttribute('aria-current', 'page');
    expect(document.querySelector('[data-sidebar-pinned] a')).toHaveAttribute('href', '/admin/platform');
  });

  it('P19.23-T1 AC-1 at 1280px: the labelled sidebar, the six in order, Platform pinned, SUPERADMIN under the wordmark', () => {
    atWidth(1280);
    nav.path = '/admin/companies';
    renderWithSession(page('Perusahaan'), { me: SUPER_ADMIN });
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    const scrolled = Array.from(sidebar.querySelectorAll('[data-sidebar-scroll] a')).map((a) => a.textContent);
    expect(scrolled).toEqual(['Dashboard', 'KPM', 'Members', 'Companies', 'Approvals', 'Subscriptions']);
    expect(sidebar.querySelector('[data-sidebar-pinned] a')).toHaveTextContent('Platform');
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

describe('P19.23-T1 AC-1 the console’s menu comes from the catalogue, in the mockups’ Indonesian', () => {
  it('P19.23-T1 AC-1 the Indonesian is the mockups’; only Dashboard, KPM and Platform read the same in both', () => {
    const { en, id } = shellMessages;
    const same = Object.keys(en.admin).filter((key) => en.admin[key as keyof typeof en.admin] === id.admin[key as keyof typeof id.admin]);
    expect(same).toEqual(['dashboard', 'kpm', 'platform']);
    expect(id.admin).toMatchObject({
      members: 'Anggota', companies: 'Perusahaan', companiesTile: 'Perusahaan & template', approvals: 'Persetujuan', billing: 'Langganan',
    });
  });

  it('P19.23-T1 AC-1 every label of the console’s sidebar is a catalogue key: seven of them', () => {
    atWidth(1280);
    nav.path = '/admin';
    renderInIndonesian(page(), { me: SUPER_ADMIN });
    const words = new Set(Object.values(shellMessages.id.admin) as string[]);
    const drawn = Array.from(screen.getByRole('navigation', { name: 'Utama' }).querySelectorAll('a')).map((a) => a.textContent ?? '');
    expect(drawn.length).toBe(7);
    for (const label of drawn) expect(words).toContain(label);
  });
});

describe('P19.2-T1 AC-13 the support banner and the bell keep their places, for every role', () => {
  it.each(ROLES)('P19.2-T1 AC-13 %s at 1280px: the bell at the sidebar’s foot, beside the account', (_, me, path) => {
    atWidth(1280);
    nav.path = path;
    renderWithSession(page(), { me });
    // The account card since P19.13-T2 AC-6 (UI-196): the avatar, the name, the role line and the bell.
    const foot = document.querySelector('[aria-controls="sidebar-user-actions"]')!.closest('[data-account-card]')!;
    expect(within(foot as HTMLElement).getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('P19.2-T1 AC-13, P19.17-T3 a support session as an Owner: the banner over the one shell, the Owner’s menu, no views', async () => {
    atWidth(375);
    nav.path = '/kpm/overview';
    const supporting = { ...OWNER, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' };
    renderWithSession(<><ImpersonationBanner />{page()}</>, { me: supporting });
    const banner = screen.getAllByRole('status').find((el) => /Wilson/.test(el.textContent ?? ''))!;
    expect(banner).toBeDefined();
    expect(banner.compareDocumentPosition(frame()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabBar()).not.toBeNull();
    // The avatar is the link to *Profil saya*, as for everybody (P19.17-T3 AC-2); *Keluar* is in *Lainnya*.
    expect(titleAvatar().tagName).toBe('A');
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'More' }));
    expect(sheet.getByRole('link', { name: 'All members' })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    // The root layout mounts the banner once, outside every shell, so the one shell cannot drop it.
    expect(readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8').match(/<ImpersonationBanner \/>/g)).toHaveLength(1);
  });
});

describe('P19.2-T1 axe on the shell, for each role', () => {
  /** Colour contrast needs a canvas jsdom does not have; `contrast.spec.ts` pins the tokens instead. */
  const RULES = { rules: { 'color-contrast': { enabled: false } } };

  it('P19.17-T3 the Owner at 375px, Lainnya open with the extras', async () => {
    atWidth(375);
    nav.path = '/kpm/overview';
    renderWithSession(page(), { me: OWNER });
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByRole('dialog', { name: 'More' });
    await act(async () => undefined);
    expect((await axe(document.body, RULES)).violations).toEqual([]);
  });

  it('P19.17-T3 the Admin at 1280px, the sidebar’s account menu open', async () => {
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

describe('P19.17-T3 the profile line: the office’s role for whoever runs it, on every page (P18.5-T6 AC-2)', () => {
  it.each(['/people/members', '/home'])('P19.17-T3 the Owner on %s: KPM Owner · Core Leader · the groups · the office', (path) => {
    atWidth(1280);
    nav.path = path;
    const owner = member({ isKpmOwner: true, isCoreLeader: true, groups: ['Top Producers 2026'] });
    renderWithSession(page('All members'), { me: owner });
    expect(screen.getByText('KPM Owner · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih'))
      .toHaveAttribute('title', 'KPM Owner · Core Leader · Top Producers 2026 · 0417 · Cempaka Putih');
  });

  it('P19.17-T3 an Admin in no group, untagged: KPM Admin · the office', () => {
    atWidth(1280);
    nav.path = '/home';
    renderWithSession(page('Home'), { me: member({ isKpmAdmin: true, groups: [] }) });
    expect(screen.getByText('KPM Admin · 0417 · Cempaka Putih')).toBeInTheDocument();
  });

  it('P19.17-T3 everybody else the rung’s: AB · the office', () => {
    atWidth(1280);
    nav.path = '/home';
    renderWithSession(page('Home'), { me: AB });
    expect(screen.getByText('AB · 0417 · Cempaka Putih')).toBeInTheDocument();
  });
});

describe('P19.23-T1 AC-1 the approvals waiting ride Persetujuan, in Lainnya too', () => {
  it('P19.23-T1 AC-1 Persetujuan carries the KPM requests and leaders past the limit waiting, on its tile and in its name', async () => {
    atWidth(375);
    nav.path = '/admin';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => [{ status: 'pending' }, { status: 'approved' }],
    } as Response)));
    renderWithSession(page(), {
      me: { ...SUPER_ADMIN, permissions: ['kpm:list_all', 'kpm_request:read', 'leader_limit_request:read'] },
    });
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'More' }));
    await waitFor(() => expect(document.querySelector('[data-tile="consoleApprovals"]')).toHaveTextContent('2'));
    expect(sheet.getByRole('link', { name: 'Approvals, 2' })).toHaveAttribute('href', '/admin/approvals');
  });
});

/*
 * *Removed 2026-11-20 (P19.17-T3 AC-1, AC-2; ADR-0269 §2):* P19.11-T6 AC-1's *Keluar* in the title avatar's dropdown —
 * the dropdown was the view switcher's, and is gone with it. The avatar is a link to *Profil saya* for everybody;
 * *Keluar* is the sidebar's account menu (`sidebar-user-menu.spec.tsx`), *Lainnya*'s last row (`field-shell.spec.tsx`)
 * and *Profil saya*'s.
 */
