import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, InLanguage, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { messagesIn } from '@/i18n/catalogue';
import { KEPT_ENGLISH } from '@/i18n/glossary';
import { shellMessages } from '@/i18n/messages/shell';
import type { Me } from '@/lib/session';
import { AgentShell } from './agent-shell';
import { NotificationBell } from './notification-bell';
import { withUnread } from './unread-badge';
import { Shell } from './shell';

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
 * **P18.10-T1, the catalogue's first module in ID mode**: the shells' own words read the approved glossary's
 * Indonesian (§B.1, §B.2, §B.3, §B.8), and every kept-English term — the nav, the consoles' tags, the roles,
 * *Notifications*, the product's name — still reads in English (§A). The same screens in English are the shells' own
 * specs, untouched: the English default (AC-5).
 */
describe('P18.10-T1 the shells in Indonesian', () => {
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
    // *Advanced analytics* is a working item since P19.5-T4, kept English; *Survei* is the reader's word (C-R2).
    expect(within(nav).queryByText('Segera hadir')).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Advanced analytics' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Survei' })).toBeInTheDocument();
  });

  it('AC-1 names the frame’s controls in Indonesian: the rail’s toggle (the consoles’ ☰ went with P19.2-T1)', () => {
    renderInIndonesian(<AgentShell title="Coaching Session">body</AgentShell>, { me: member() });

    expect(screen.queryByRole('button', { name: 'Buka menu' })).not.toBeInTheDocument();
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

  it('P19.2-T1 AC-5 offers an Owner the views in Indonesian, the role kept: Akun saya · KPM Owner', async () => {
    renderInIndonesian(<AgentShell title="Coaching Session">body</AgentShell>, { me: member({ isKpmOwner: true }) });
    await userEvent.click(chip());

    const views = within(within(panel()).getByRole('list', { name: 'Tampilan' }));
    expect(views.getAllByRole('button').map((b) => b.textContent)).toEqual(['Akun saya', 'KPM Owner']);
    expect(within(panel()).queryByText(/Buka tampilan/)).not.toBeInTheDocument();
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

  it('P19.2-T1 AC-6 the office view in Indonesian: its role and its items English, Pengaturan translated, no console tag', async () => {
    route.path = '/people/members';
    renderInIndonesian(<Shell family="tenant" title="All Members">body</Shell>, {
      me: member({ isKpmOwner: true }, { permissions: ['member:read_profile'] }),
    });

    expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage KPM admins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pengaturan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'People' })).toBeInTheDocument();
    // *Advanced analytics* opens the survey tabs since P19.5-T4: no item is *Segera hadir*.
    expect(screen.getByRole('link', { name: 'Advanced analytics' })).toBeInTheDocument();
    expect(screen.queryByText('Segera hadir')).not.toBeInTheDocument();
    expect(chip()).toHaveTextContent('KPM Owner');
  });

  it('P19.2-T1 AC-12 the Super Admin’s tag and role English, the menu’s labels the catalogue’s (UI-130)', () => {
    route.path = '/admin';
    renderInIndonesian(<Shell family="admin" title="Overview">body</Shell>, {
      me: { ...SUPER_ADMIN, permissions: ['kpm:list_all'] },
    });

    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
    expect(chip()).toHaveTextContent('Superadmin');
    expect(screen.getByRole('link', { name: messagesIn(shellMessages, 'id').admin.manageCompanies })).toBeInTheDocument();
  });

  it('P19.2-T1 AC-9 the Super Admin’s bar in Indonesian: Overview · KPMs · Perusahaan · Analytics · Lainnya', () => {
    atWidth(375);
    route.path = '/admin';
    renderInIndonesian(<Shell family="admin" title="Overview">body</Shell>, {
      me: { ...SUPER_ADMIN, permissions: ['kpm:list_all'] },
    });
    const bar = document.querySelector('[data-tab-bar]')!;
    expect(Array.from(bar.querySelectorAll('[data-tab]')).map((t) => t.textContent)).toEqual(['Overview', 'KPMs', 'Perusahaan', 'Analytics', 'Lainnya']);
  });
});

/**
 * **AC-7: the nav is §A.1, all of it** — the glossary's 18 group headings and 48 items, each shell's as it draws it.
 * Rendered rather than read, so a heading or an item added to a shell without its kept term fails here.
 */
describe('P18.10-T1 AC-7 every heading and item of the three shells is a kept term', () => {
  const NAVIGATION: ReadonlySet<string> = new Set(KEPT_ENGLISH.navigation);
  /** UI-004's group headings in English: *Me*, *Activities*, *My team*, *Programs* (*KPM* is kept). */
  const FIELD_HEADINGS: ReadonlySet<string> = new Set(Object.values(messagesIn(shellMessages, 'en').fieldGroups));
  /**
   * **The one item that is the reader's word, not a kept term**: *Surveys* (ID *Survei*), the glossary's *Surveys (the
   * tile)* — translated, as the reminder mockup writes it in an Indonesian sheet (P19.5-T4, C-R2).
   */
  // P19.6-T1 (ADR-0218 §1): and *KPM branding* (ID *Tampilan KPM*), §B7's own Indonesian for the page.
  const TRANSLATED_ITEMS: ReadonlySet<string> = new Set([messagesIn(shellMessages, 'en').surveys, messagesIn(shellMessages, 'en').branding]);

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
    // P19.2-T1: the office view and the Super Admin's menu, in the one shell.
    ['the office view', () => <Shell family="tenant" title="x">x</Shell>, member({ isKpmOwner: true }, { permissions: ['member:read_profile'] })],
    ['the Super Admin’s menu', () => <Shell family="admin" title="x">x</Shell>, { ...SUPER_ADMIN, permissions: ['kpm:list_all'] }],
  ];

  it.each(SHELLS)('%s', (_, shell, me) => {
    // The office view is an office page's (ADR-0198 §5); the field's and the Super Admin's draw on any.
    route.path = me.membership?.isKpmOwner ? '/people/members' : me.membership ? '/coaching' : '/admin';
    renderWithSession(shell(), { me });
    const words = navWords();

    expect(words.length).toBeGreaterThan(8);
    // The group headings are the catalogue's since UI V1 (UI-004, D-20) — the field's translated, *Pengaturan* too (UI-147).
    expect(words.filter((w) => !NAVIGATION.has(w) && !FIELD_HEADINGS.has(w) && !TRANSLATED_ITEMS.has(w))).toEqual([]);
  });

  it('UI-004 the field shell’s group headings, and only those, are the catalogue’s words, translated', () => {
    renderInIndonesian(<AgentShell title="x">x</AgentShell>, { me: member({ directCount: 2, isCoreLeader: true }) });
    const nav = screen.getByRole('navigation', { name: 'Utama' });
    const headings = Array.from(nav.querySelectorAll('[aria-controls^="nav-group"]'))
      .map((b) => (b.textContent ?? '').trim()).filter(Boolean);
    expect(headings).toEqual(['Saya', 'Aktivitas', 'Tim saya', 'Program', 'KPM']);
  });
});

describe('P18.10-T1 the bell in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1 names the bell with its count, keeps the inbox’s title, and says the popover’s words in Indonesian', async () => {
    stubFetch({ '/notifications': [{ body: { items: [], unread: 2, total: 2, page: 1, pageSize: 8 } }] });
    renderWithSession(
      <InLanguage language="id"><NotificationBell href="/notifications" unread={2} /></InLanguage>,
      { me: member({}, { permissions: ['notification:read_inbox', 'notification:mark_read'] }) },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Notifications, 2 belum dibaca' }));

    // The popover's module loads on the first tap (`notification-popover.tsx`, the bundle).
    const popover = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(popover).getByRole('link', { name: 'Lihat semua notifikasi' })).toHaveAttribute('href', '/notifications');
    expect(await within(popover).findByRole('button', { name: 'Tandai semua sudah dibaca' })).toBeInTheDocument();
  });

  it('AC-1 says it is loading in Indonesian: Memuat notifikasi Anda…', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderInIndonesian(<NotificationBell href="/notifications" unread={0} />, {
      me: member({}, { permissions: ['notification:read_inbox'] }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Memuat notifikasi Anda…');
  });
});

describe('P18.10-T1 the shells’ words outside React, in a language', () => {
  it('AC-1 withUnread writes the count in the reader’s language, and the name alone at none', () => {
    expect(withUnread('Notifications', 3, 'id')).toBe('Notifications, 3 belum dibaca');
    expect(withUnread('Notifications', 0, 'id')).toBe('Notifications');
    // English is the default, what the bell's own spec reads.
    expect(withUnread('Notifications', 3)).toBe('Notifications, 3 unread');
  });
});
