import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, InLanguage, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { messagesIn } from '@/i18n/catalogue';
import { KEPT_ENGLISH } from '@/i18n/glossary';
import { shellMessages } from '@/i18n/messages/shell';
import type { Me } from '@/lib/session';
import { viewSwitchFor } from '@/lib/landing';
import { AdminShell } from './admin-shell';
import { AgentShell } from './agent-shell';
import { NotificationBell, withUnread } from './notification-bell';
import { TenantShell } from './tenant-shell';

const route = vi.hoisted(() => ({ path: '/coaching' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => route.path,
}));

/** A member of the office, with only what a case is about spelled out. */
function member(over: Partial<NonNullable<Me['membership']>> = {}, rest: Partial<Me> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
    },
    ...rest,
  });
}

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null, pronoun: 'they',
    initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
});

const chip = () => screen.getByRole('button', { name: /Rina|Root/ });
const panel = () => document.getElementById('sidebar-user-actions')!;

/**
 * **P18.98-T1, the catalogue's first module in ID mode**: the shells' own words read the approved glossary's
 * Indonesian (§B.1, §B.2, §B.3, §B.8), and every kept-English term — the nav, the consoles' tags, the roles,
 * *Notifications*, the product's name — still reads in English (§A). The same screens in English are the shells' own
 * specs, untouched: the English default (AC-5).
 */
describe('P18.98-T1 the shells in Indonesian', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    route.path = '/coaching';
  });

  it('AC-7, UI-004 keeps the field nav’s items English, word for word, writes its group headings in Indonesian, and translates its pill', () => {
    renderInIndonesian(<AgentShell title="Coaching Session">body</AgentShell>, {
      me: member({ directCount: 2, isCoreLeader: true }),
    });
    const nav = screen.getByRole('navigation', { name: 'Utama' });

    for (const item of ['Activity', 'Leads', 'Unit Dashboard', 'Strategic Leader Forum', 'Goal Setting', 'User Management']) {
      expect(within(nav).getByRole('link', { name: item })).toBeInTheDocument();
    }
    // UI-004's groups are Indonesian words (D-20), as the *Lainnya* sheet writes them; *KPM* is kept.
    for (const heading of ['Saya', 'Aktivitas', 'Tim saya', 'Program', 'KPM']) {
      expect(within(nav).getByRole('button', { name: heading })).toBeInTheDocument();
    }
    // *Soon* is a status word (§B.3): *Segera hadir*, beside the kept item's own name.
    expect(within(nav).getByText('Segera hadir')).toBeInTheDocument();
    expect(within(nav).queryByText('Soon')).not.toBeInTheDocument();
    expect(within(nav).getByText('Advanced analytics')).toBeInTheDocument();
  });

  it('AC-1 names the frame’s controls in Indonesian: ☰ and the rail’s toggle', () => {
    renderInIndonesian(<AgentShell title="Coaching Session">body</AgentShell>, { me: member() });

    expect(screen.getByRole('button', { name: 'Buka menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ciutkan menu samping' })).toHaveAttribute('title', 'Ciutkan menu samping');
  });

  it('AC-1 says the account menu in Indonesian: Akun Anda and Keluar', async () => {
    renderInIndonesian(<AgentShell title="Coaching Session">body</AgentShell>, { me: member() });
    await userEvent.click(chip());

    expect(within(panel()).getByRole('link', { name: 'Akun Anda' })).toHaveAttribute('href', '/profile');
    expect(within(panel()).getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
  });

  it('AC-1 says Sedang keluar… while signing out', async () => {
    let finish: () => void = () => undefined;
    const signOut = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    stubFetch({});
    renderInIndonesian(<AgentShell title="Coaching Session">body</AgentShell>, { me: member(), signOut });
    await userEvent.click(chip());
    await userEvent.click(within(panel()).getByRole('button', { name: 'Keluar' }));

    expect(await within(panel()).findByRole('button', { name: 'Sedang keluar…' })).toBeDisabled();
    finish();
  });

  it('AC-1 offers an Owner the view switch in Indonesian, the role kept: Buka tampilan Owner', async () => {
    renderInIndonesian(<AgentShell title="Coaching Session">body</AgentShell>, { me: member({ isKpmOwner: true }) });
    await userEvent.click(chip());

    expect(within(panel()).getByRole('link', { name: 'Buka tampilan Owner' })).toHaveAttribute('href', '/kpm/overview');
  });

  it('AC-1 says somebody in no office has none yet, with the office called KPM (§B.9)', () => {
    renderInIndonesian(<AgentShell title="Find your KPM">body</AgentShell>, { me: makeMe({ membership: null }) });

    expect(chip()).toHaveTextContent('Belum punya KPM');
  });

  it('AC-1 says a done item’s check in Indonesian, after its kept name: — selesai', () => {
    route.path = '/activation';
    renderInIndonesian(<AgentShell title="Your 90-Day Activation">body</AgentShell>, {
      me: member({}, { activation: { open: true, complete: true } }),
    });

    expect(screen.getByRole('link', { name: 'Your 90-day activation — selesai' })).toBeInTheDocument();
  });

  it('AC-7 keeps the office console’s tag, its role and its nav English, and offers Buka tampilan Agent', async () => {
    route.path = '/people/members';
    renderInIndonesian(<TenantShell title="All Members">body</TenantShell>, {
      me: member({ isKpmOwner: true }, { permissions: ['member:read_profile'] }),
    });

    expect(screen.getByText('KPM OWNER')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage KPM admins' })).toBeInTheDocument();
    // The office console's *Upcoming* is a status word too (§B.3).
    expect(screen.getByText('Segera hadir')).toBeInTheDocument();
    await userEvent.click(chip());
    expect(chip()).toHaveTextContent('KPM Owner');
    expect(within(panel()).getByRole('link', { name: 'Buka tampilan Agent' })).toBeInTheDocument();
  });

  it('AC-7 keeps the platform console’s tag and role English', () => {
    route.path = '/admin';
    renderInIndonesian(<AdminShell title="Overview">body</AdminShell>, {
      me: { ...SUPER_ADMIN, permissions: ['kpm:list_all'] },
    });

    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
    expect(chip()).toHaveTextContent('Superadmin');
    expect(screen.getByRole('link', { name: 'Manage companies' })).toBeInTheDocument();
  });

  it('AC-1 names the phone’s avatar in Indonesian, with its count: Akun dan notifikasi, 3 belum dibaca', async () => {
    // The office console's bar: the field shell has no bar on a phone since UI V1 (UI-004).
    atWidth(375);
    route.path = '/people/members';
    stubFetch({ '/notifications': { body: { items: [], unread: 3, total: 3, page: 1, pageSize: 1 } } });
    renderInIndonesian(<TenantShell title="All Members">body</TenantShell>, {
      me: member({ isKpmOwner: true }, { permissions: ['member:read_profile', 'notification:read_inbox'] }),
    });

    const avatar = await screen.findByRole('button', { name: 'Akun dan notifikasi, 3 belum dibaca' });
    await userEvent.click(avatar);
    // The inbox's own title is kept English (§A.2); its count is the reader's.
    expect(screen.getByRole('link', { name: 'Notifications, 3 belum dibaca' })).toHaveTextContent('Notifications');
  });
});

/**
 * **AC-7: the nav is §A.1, all of it** — the glossary's 18 group headings and 48 items, each shell's as it draws it.
 * Rendered rather than read, so a heading or an item added to a shell without its kept term fails here.
 */
describe('P18.98-T1 AC-7 every heading and item of the three shells is a kept term', () => {
  const NAVIGATION: ReadonlySet<string> = new Set(KEPT_ENGLISH.navigation);
  /** UI-004's group headings in English: *Me*, *Activities*, *My team*, *Programs* (*KPM* is kept). */
  const FIELD_HEADINGS: ReadonlySet<string> = new Set(Object.values(messagesIn(shellMessages, 'en').fieldGroups));

  /** The nav's own words: each group's heading, and each item's name before any pill or count. */
  function navWords(): string[] {
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const headings = within(nav).queryAllByRole('button').map((b) => b.textContent ?? '');
    const items = [...nav.querySelectorAll('li > a')].map((a) => a.childNodes[1]?.textContent ?? '');
    return [...headings, ...items].map((w) => w.trim()).filter((w) => w !== '');
  }

  const SHELLS: [string, () => React.ReactElement, Me][] = [
    // Leading people, in their own activation, with hires, and a Core Leader: every item the field nav has.
    ['the field shell', () => <AgentShell title="x">x</AgentShell>, member({ directCount: 2, isCoreLeader: true }, {
      activation: { open: true, complete: false }, newHires: true,
    })],
    ['the office console', () => <TenantShell title="x">x</TenantShell>, member({ isKpmOwner: true }, { permissions: ['member:read_profile'] })],
    ['the platform console', () => <AdminShell title="x">x</AdminShell>, { ...SUPER_ADMIN, permissions: ['kpm:list_all'] }],
  ];

  it.each(SHELLS)('%s', (_, shell, me) => {
    renderWithSession(shell(), { me });
    const words = navWords();

    expect(words.length).toBeGreaterThan(8);
    // The field shell's group headings are Indonesian words since UI V1 (UI-004, D-20) — translated, not kept.
    expect(words.filter((w) => !NAVIGATION.has(w) && !FIELD_HEADINGS.has(w))).toEqual([]);
  });

  it('UI-004 the field shell’s group headings, and only those, are the catalogue’s words, translated', () => {
    renderInIndonesian(<AgentShell title="x">x</AgentShell>, { me: member({ directCount: 2, isCoreLeader: true }) });
    const nav = screen.getByRole('navigation', { name: 'Utama' });
    const headings = Array.from(nav.querySelectorAll('[aria-controls^="nav-group"]'))
      .map((b) => (b.textContent ?? '').trim()).filter(Boolean);
    expect(headings).toEqual(['Saya', 'Aktivitas', 'Tim saya', 'Program', 'KPM']);
  });
});

describe('P18.98-T1 the bell in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1 names the bell with its count, keeps the inbox’s title, and says the popover’s words in Indonesian', async () => {
    stubFetch({ '/notifications': [{ body: { items: [], unread: 2, total: 2, page: 1, pageSize: 8 } }] });
    renderWithSession(
      <InLanguage language="id"><NotificationBell href="/notifications" unread={2} /></InLanguage>,
      { me: member({}, { permissions: ['notification:read_inbox', 'notification:mark_read'] }) },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Notifications, 2 belum dibaca' }));

    const popover = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(popover).getByRole('link', { name: 'Lihat semua notifikasi' })).toHaveAttribute('href', '/notifications');
    expect(await within(popover).findByRole('button', { name: 'Tandai semua sudah dibaca' })).toBeInTheDocument();
  });

  it('AC-1 says it is loading in Indonesian: Memuat notifikasi Anda…', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderInIndonesian(<NotificationBell href="/notifications" unread={0} />, {
      me: member({}, { permissions: ['notification:read_inbox'] }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByRole('status')).toHaveTextContent('Memuat notifikasi Anda…');
  });
});

describe('P18.98-T1 the shells’ words outside React, in a language', () => {
  it('AC-1 withUnread writes the count in the reader’s language, and the name alone at none', () => {
    expect(withUnread('Notifications', 3, 'id')).toBe('Notifications, 3 belum dibaca');
    expect(withUnread('Notifications', 0, 'id')).toBe('Notifications');
    // English is the default, what the bell's own spec reads.
    expect(withUnread('Notifications', 3)).toBe('Notifications, 3 unread');
  });

  it('AC-1 viewSwitchFor says the view switch in the reader’s language, the roles kept', () => {
    const owner = member({ isKpmOwner: true, directCount: 2 });
    expect(viewSwitchFor(owner, 'office', 'id')).toEqual({ href: '/home', label: 'Buka tampilan Agent' });
    expect(viewSwitchFor(owner, 'field', 'id')).toEqual({ href: '/kpm/overview', label: 'Buka tampilan Owner' });
    expect(viewSwitchFor(member({ isKpmAdmin: true }), 'field', 'id')?.label).toBe('Buka tampilan Admin');
  });
});
