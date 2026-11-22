import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { BSD, CONSOLE_SUPER_ADMIN, PEOPLE } from '@test/console-fixtures';
import { enteredKpmId, leaveKpm } from '@/lib/super-admin-kpm';
import KpmPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => `/admin/tenants/${BSD}`,
  useSearchParams: () => new URLSearchParams(),
}));

const viewAs = vi.hoisted(() => ({ open: vi.fn(async () => undefined) }));
vi.mock('@/lib/view-as', () => ({
  openViewAsWindow: viewAs.open,
  ViewAsBlocked: class ViewAsBlocked extends Error {},
}));

const RULES = { rules: { 'color-contrast': { enabled: false } } };

/** The Overview's *Performa vs target* for the month, as the Owner reads it (`GET /kpm/overview/performance`). */
const PERFORMANCE = {
  month: '2026-10', currentMonth: '2026-11', earliestMonth: '2026-01', latestMonth: '2026-11', max: 99, currency: 'IDR',
  held: true, group: null, canWrite: true, groups: [],
  total: {
    activeAgentTarget: 14, rekrutTarget: 8, rekrutYtdTarget: 40, apeTargetMinor: 68_600_000_000, unset: 0, abGroups: 4, people: 27,
    actual: { apeMinor: 59_700_000_000, apePct: 87, activeAgents: 8, rekrut: 4 },
  },
};

/** The element once it is drawn: `waitFor` asks again until it is. */
const drawn = (selector: string) => waitFor(() => {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error(`${selector} is not drawn yet`);
  return el;
});

const render = () => renderInIndonesian(<KpmPage params={routeParams({ kpmId: BSD })} />, { me: CONSOLE_SUPER_ADMIN });

/**
 * **Inside a KPM** (P19.23-T2 AC-4 to AC-7; ADR-0277 §3): opening the page enters the KPM; the header, the switcher and the
 * thin bar; the navy tiles from the Owner's own Overview; *Owner & admin*, *Anggota*, the eight owner pages and *Lihat
 * sebagai*, whose button opens the new window for the person chosen.
 */
describe('/admin/tenants/[kpmId] — inside a KPM (P19.23-T2)', () => {
  beforeEach(() => {
    atWidth(1280);
    viewAs.open.mockClear();
    stubFetch({
      [`/admin/tenants/${BSD}/people`]: { body: PEOPLE },
      '/kpm/overview/performance': { body: PERFORMANCE },
    });
  });
  afterEach(() => {
    leaveKpm();
    vi.unstubAllGlobals();
  });

  it('P19.23-T2 AC-4 opening it enters the KPM: the Owner’s own read below carries X-Kpm-Id', async () => {
    const { calls } = stubFetch({
      [`/admin/tenants/${BSD}/people`]: { body: PEOPLE },
      '/kpm/overview/performance': { body: PERFORMANCE },
    });
    render();
    await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    expect(enteredKpmId()).toBe(BSD);
    await waitFor(() => expect(calls.find((c) => c.url.includes('/kpm/overview/performance'))).toBeDefined());
    const headers = new Headers(calls.find((c) => c.url.includes('/kpm/overview/performance'))!.init.headers);
    expect(headers.get('X-Kpm-Id')).toBe(BSD);
    // The console's own route is never sent the header.
    expect(new Headers(calls.find((c) => c.url.includes('/people'))!.init.headers).get('X-Kpm-Id')).toBeNull();
  });

  it('P19.23-T2 AC-4 the switcher chip and the bar: Anda di dalam KPM ini sebagai Super Admin', async () => {
    render();
    await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    expect(screen.getAllByRole('button', { name: 'Ganti KPM: BSD City Branch · Prudential' }).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-inside-kpm-bar]')).toHaveTextContent(
      'Anda di dalam KPM ini sebagai Super Admin · semua akses owner · tercatat di audit log',
    );
  });

  it('P19.23-T2 AC-4 the navy tiles: Anggota, Active Agent, Rekrut and APE against their targets', async () => {
    render();
    const tiles = await waitFor(() => {
      const el = document.querySelector('[data-kpm-tiles]') as HTMLElement | null;
      if (!el || !el.textContent?.includes('Oktober')) throw new Error('not yet');
      return el;
    });
    expect(tiles).toHaveTextContent('BSD City Branch · Prudential · Oktober 2026');
    expect(tiles).toHaveTextContent('9 leader · 18 agent');
    expect(tiles).toHaveTextContent('dari target 14');
    expect(tiles).toHaveTextContent('dari target 8');
    expect(tiles).toHaveTextContent('87% dari target');
  });

  it('P19.23-T2 AC-4, P19.27-T2 AC-6 Owner & admin: KPM Owner · n with Tambah owner, Admin, Core leader, Ganti / Atur, + Tambah admin', async () => {
    render();
    const card = within(await drawn('[data-owners-card]'));
    // Names in capitals by the style (`uppercase`), their words as written.
    expect(card.getByText('Wilson Tanoto')).toHaveClass('uppercase');
    expect(card.getByText('Linda Kusuma')).toBeInTheDocument();
    expect(card.getByText('Satria Nugraha')).toBeInTheDocument();
    // P19.27 (ADR-0285): the owner list in the card — *KPM Owner · 1*, *Tambah owner*; *Ganti owner*'s page is gone.
    expect(card.getByRole('heading', { name: 'KPM Owner · 1' })).toBeInTheDocument();
    expect(card.getByRole('button', { name: /Tambah owner/ })).toBeInTheDocument();
    expect(card.queryByRole('link', { name: 'Ganti', current: false })).toHaveAttribute('href', '/people/admins');
    expect(document.querySelector(`a[href="/admin/tenants/${BSD}/owner"]`)).toBeNull();
    expect(card.getByRole('link', { name: 'Atur' })).toHaveAttribute('href', '/people/admins');
    expect(card.getByRole('link', { name: 'Tambah admin' })).toHaveAttribute('href', '/people/admins');
  });

  it('P19.23-T2 AC-4 Anggota · n: the first five, their group and when they last used it, Import people, Lihat semua', async () => {
    render();
    const card = within(await drawn('[data-members-card]'));
    expect(card.getByRole('heading', { name: 'Anggota · 27' })).toBeInTheDocument();
    expect(card.getAllByRole('listitem')).toHaveLength(5);
    expect(card.getAllByText('Hari ini')[0]).toHaveClass('bg-pill-green');
    expect(card.getByText('22 hari lalu')).toHaveClass('bg-pill-red');
    expect(card.getByText('Belum pernah')).toHaveClass('bg-pill-red');
    expect(card.getByText('Tanpa group')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Import people' })).toHaveAttribute('href', '/people/import');
    expect(card.getByRole('link', { name: 'Lihat semua' })).toHaveAttribute('href', '/people/members');
  });

  it('P19.23-T2 AC-4 the eight owner pages, each the Owner’s own address', async () => {
    render();
    const pages = await drawn('[data-owner-pages]');
    expect(Array.from(pages.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Overview', '/kpm/overview'], ['Advanced analytics', '/kpm/advanced-analytics'],
      ['Strategic Leader Forum', '/leader-meetings'], ['Data upload', '/kpm/data-upload'],
      ['All members', '/people/members'], ['Org tree', '/people/org-tree'], ['KPM admins', '/people/admins'],
      ['Pengaturan', '/kpm/settings'],
    ]);
  });

  it('P19.23-T2 AC-7 Lihat sebagai: four roles, a real person each, Buka jendela baru with the card’s reason', async () => {
    render();
    const section = await drawn('[data-view-as]');
    expect(Array.from(section.querySelectorAll('[data-view-as-role] b')).map((b) => b.textContent))
      .toEqual(['KPM Owner', 'KPM Admin', 'AB', 'Agent']);
    // A role with nobody in it says so and offers no button.
    const agent = within(section.querySelector('[data-view-as-role="agent"]') as HTMLElement);
    expect(agent.getByText('Belum ada')).toBeInTheDocument();
    expect(agent.queryByRole('button', { name: /Buka jendela baru/ })).not.toBeInTheDocument();
    const ab = within(section.querySelector('[data-view-as-role="ab"]') as HTMLElement);
    await userEvent.click(ab.getByRole('button', { name: /Buka jendela baru/ }));
    expect(viewAs.open).toHaveBeenCalledWith(
      { userId: 'u-agus', fullName: 'Agus Prasetyo' }, 'Lihat sebagai AB dari halaman KPM BSD City Branch',
    );
  });

  it('P19.23-T2 AC-4 a KPM that is not there: the server’s 404 in its words', async () => {
    stubFetch({
      [`/admin/tenants/${BSD}/people`]: { status: 404, body: { error: { code: 'NOT_FOUND', message: 'KPM tidak ditemukan.', requestId: 'r-2' } } },
    });
    render();
    expect(await screen.findByText('KPM tidak ditemukan.')).toBeInTheDocument();
  });

  it('P19.23-T2 AC-4 tiles a KPM cannot answer read “–”, never the page’s error', async () => {
    stubFetch({
      [`/admin/tenants/${BSD}/people`]: { body: PEOPLE },
      '/kpm/overview/performance': { status: 409, body: { error: { code: 'TENANT_SUSPENDED', message: 'x', requestId: 'r' } } },
    });
    render();
    await waitFor(() => expect(document.querySelector('[data-kpm-tiles]')?.textContent).toContain('–'));
    expect(screen.queryByText('x')).not.toBeInTheDocument();
  });

  // *Changed 2026-11-22 (P19.29-T1; UI-200 (21 Nov)):* below 768px the title is the switcher (the block below); the
  // full-width chip under the title is a tablet's alone now, from 768 to 1023px.
  it('P19.23-T7 AC-1 from 768 to 1023px the switcher chip sits full width under the title', async () => {
    atWidth(800);
    render();
    await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    const inBody = Array.from(document.querySelectorAll('[data-kpm-switcher]')).filter((b) => b.closest('.lg\\:hidden'));
    expect(inBody).toHaveLength(1);
    expect(document.querySelector('[data-kpm-header]')).toBeNull();
  });

  it('P19.23-T2 axe on the populated page', async () => {
    const { container } = render();
    await waitFor(() => expect(document.querySelector('[data-view-as]')).not.toBeNull());
    expect((await axe(container, RULES)).violations).toEqual([]);
  });

  it('P18.10-T7 AC-1 in Indonesian, no English of the console’s own is left', async () => {
    render();
    await waitFor(() => expect(document.querySelector('[data-view-as]')).not.toBeNull());
    expect(englishShown(document.body, englishOnly(adminConsoleMessages))).toEqual([]);
  });
});

/**
 * **Inside a KPM on a phone** (P19.29-T1, T4; UI-200, UI-211, UI-213 (21 Nov); ADR-0287): the title is the switcher, one
 * 44px row of the pill, *PDF* and ⋯, the month alone on the navy card, the owner pages as rows, *Lihat sebagai* one card
 * and no grey notes — and from 768px the page as it was.
 */
describe('/admin/tenants/[kpmId] on a phone (P19.29)', () => {
  const TENANTS = [
    { _id: BSD, branchName: 'BSD City Branch', companyName: 'Prudential', status: 'active' },
    { _id: 'kpm-bekasi', branchName: 'Bekasi Barat Branch', companyName: 'Prudential', status: 'active' },
    { _id: 'kpm-old', branchName: 'Old Branch', companyName: 'Prudential', status: 'archived' },
  ];
  beforeEach(() => {
    atWidth(375);
    viewAs.open.mockClear();
    stubFetch({
      [`/admin/tenants/${BSD}/people`]: { body: PEOPLE },
      '/kpm/overview/performance': { body: PERFORMANCE },
      '/admin/tenants': { body: TENANTS },
      '/admin/companies': { body: [] },
    });
  });
  afterEach(() => {
    leaveKpm();
    vi.unstubAllGlobals();
  });

  it('P19.29-T1 AC-1 the title is the switcher: the KPM ⌄ at 20/800, the other KPMs and Semua KPM under it', async () => {
    render();
    const title = await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    const button = within(title).getByRole('button', { name: 'BSD City Branch' });
    expect(button).toHaveClass('text-title', 'font-extrabold', 'min-h-11');
    expect(button).toHaveAccessibleDescription('Ganti KPM');
    // The chevron is a line icon, never a ⌄ character.
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button).not.toHaveTextContent('⌄');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(button.getAttribute('aria-controls')!) as HTMLElement;
    await waitFor(() => expect(within(list).getByRole('link', { name: /Bekasi Barat Branch/ })).toHaveAttribute('href', '/admin/tenants/kpm-bekasi'));
    // The other KPMs: not the one in the title, not an archived one; Semua KPM last.
    expect(within(list).queryByRole('link', { name: /BSD City Branch/ })).not.toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: /Old Branch/ })).not.toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /Semua KPM/ })).toHaveAttribute('href', '/admin/tenants');
    expect(list).toHaveClass('left-0', 'w-[min(20rem,calc(100vw-2rem))]');
  });

  it('P19.29-T1 AC-1 one meta line under it: Prudential · KPM 0417, 13/400 grey', async () => {
    render();
    const meta = await drawn('[data-kpm-meta]');
    expect(meta).toHaveTextContent(/^Prudential · KPM 0417$/);
    expect(meta).toHaveClass('text-base', 'text-muted');
  });

  it('P19.29-T1 AC-2 row 2: the navy pill, a white round PDF and a white round ⋯ — each 44px, 13/600', async () => {
    render();
    const row = await drawn('[data-kpm-controls]');
    expect(row).toHaveClass('h-11');
    const pill = row.querySelector('[data-kpm-pill]') as HTMLElement;
    expect(pill).toHaveTextContent(/^Super Admin · akses penuh$/);
    expect(pill).toHaveClass('flex-1', 'h-11', 'bg-secondary', 'text-base', 'font-semibold');
    expect(pill.querySelector('svg')).not.toBeNull();
    const pdf = within(row).getByRole('button', { name: 'Laporan KPM BSD City Branch (PDF)' });
    expect(pdf).toHaveClass('h-11', 'w-11', 'rounded-full', 'bg-card');
    const more = within(row).getByRole('button', { name: 'Lainnya untuk KPM ini' });
    expect(more).toHaveClass('h-11', 'w-11', 'rounded-full', 'bg-card', 'text-base', 'font-semibold');
    expect(more).not.toHaveTextContent('⋯');
  });

  it('P19.29-T1 AC-2 ⋯ holds Simpan sebagai template, which opens its dialog; the foot of the page has no button', async () => {
    render();
    const more = await screen.findByRole('button', { name: 'Lainnya untuk KPM ini' });
    expect(screen.queryByRole('button', { name: 'Simpan sebagai template' })).not.toBeInTheDocument();
    await userEvent.click(more);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Simpan sebagai template' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('P19.29-T1 AC-3 the navy card’s header is the month alone', async () => {
    render();
    const tiles = await waitFor(() => {
      const el = document.querySelector('[data-kpm-tiles]') as HTMLElement | null;
      if (!el || !el.textContent?.includes('Oktober')) throw new Error('not yet');
      return el;
    });
    expect(tiles.querySelector('p')).toHaveTextContent(/^Oktober 2026$/);
    // The phone type scale's big numbers, 24/800, in the navy card's light orange — below 768px only.
    expect(tiles.querySelector('b')).toHaveClass('text-[1.625rem]', 'text-primary', 'max-md:text-figure', 'max-md:text-on-navy-orange');
    // A compact sum on one line on a phone (the walk of 2026-11-22: *Rp 647,3 Jt* on two at 375): the digits 24/800, *Rp*
    // and the unit at 15px — measured in Chrome by `kpm-page.browser.spec.ts`. The words are the figure's, whole.
    const ape = Array.from(tiles.querySelectorAll('dd > b')).find((b) => b.textContent?.startsWith('Rp'))!;
    expect(ape).toHaveTextContent(/^Rp 597 Jt$/);
    expect(ape).toHaveClass('max-md:whitespace-nowrap');
    expect(Array.from(ape.querySelectorAll('span')).map((el) => [el.textContent, el.className]))
      .toEqual([['Rp ', 'max-md:text-row'], [' Jt', 'max-md:text-row']]);
  });

  it('P19.29-T1 AC-4 the KPM’s name is written once: no second switcher, no thin bar', async () => {
    render();
    await waitFor(() => expect(document.querySelector('[data-kpm-tiles]')?.textContent).toContain('Oktober'));
    expect(document.body.textContent!.split('BSD City Branch')).toHaveLength(2);
    expect(document.querySelectorAll('[data-kpm-switcher]')).toHaveLength(1);
    expect(document.querySelector('[data-inside-kpm-bar]')).toBeNull();
  });

  it('P19.29-T4 AC-2 the eight owner pages are 44px rows: icon · label · ›', async () => {
    render();
    const rows = await drawn('[data-owner-page-rows]');
    expect(screen.getByRole('heading', { name: 'Halaman owner' })).toBeInTheDocument();
    const links = Array.from(rows.querySelectorAll('a'));
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Overview', '/kpm/overview'], ['Advanced analytics', '/kpm/advanced-analytics'],
      ['Strategic Leader Forum', '/leader-meetings'], ['Data upload', '/kpm/data-upload'],
      ['All members', '/people/members'], ['Org tree', '/people/org-tree'], ['KPM admins', '/people/admins'],
      ['Pengaturan', '/kpm/settings'],
    ]);
    expect(screen.getByRole('heading', { name: 'Halaman owner' })).toHaveClass('text-row', 'font-bold');
    for (const a of links) {
      expect(a).toHaveClass('min-h-11');
      expect(a.querySelector('span:not([aria-hidden])')).toHaveClass('text-row', 'font-semibold');
      // The page's icon and the row's ›, both line icons.
      expect(a.querySelectorAll('svg')).toHaveLength(2);
    }
  });

  it('P19.29-T4 AC-1 Lihat sebagai is one card: four role chips, one picker, one Buka jendela baru', async () => {
    render();
    const card = await drawn('[data-view-as-card]');
    const roles = within(card).getByRole('group', { name: 'Lihat sebagai peran' });
    const chips = within(roles).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Owner', 'Admin', 'AB', 'Agent']);
    for (const chip of chips) expect(chip).toHaveClass('min-h-11', 'text-base', 'font-semibold');
    // It opens on the first role with somebody in it.
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(within(card).getAllByRole('button', { name: /Buka jendela baru/ })).toHaveLength(1);
    await userEvent.click(chips[2]);
    expect(chips[2]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(card).getByRole('button', { name: /Buka jendela baru/ }));
    expect(viewAs.open).toHaveBeenCalledWith(
      { userId: 'u-agus', fullName: 'Agus Prasetyo' }, 'Lihat sebagai AB dari halaman KPM BSD City Branch',
    );
  });

  it('P19.29-T4 AC-1 a role with nobody in it says so, and the button is not live', async () => {
    render();
    const card = await drawn('[data-view-as-card]');
    await userEvent.click(within(card).getByRole('button', { name: 'Agent' }));
    expect(within(card).getByText('Belum ada')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Buka jendela baru/ })).toBeDisabled();
  });

  it('P19.29-T4 AC-3 the grey sentences are gone: the window’s behind ⓘ, the two notes not drawn', async () => {
    render();
    const card = await drawn('[data-view-as-card]');
    expect(screen.queryByText(/^Jendela baru menampilkan persis/)).not.toBeInTheDocument();
    const tip = within(card).getByRole('button', { name: 'Tentang Lihat sebagai' });
    expect(tip).toHaveAccessibleDescription(/Jendela baru menampilkan persis yang dilihat orang itu/);
    expect(document.querySelector('[data-kpm-notes]')).toHaveClass('max-md:hidden');
  });

  it('P19.29 axe on the populated page at 375px', async () => {
    const { container } = render();
    await waitFor(() => expect(document.querySelector('[data-view-as-card]')).not.toBeNull());
    expect((await axe(container, RULES)).violations).toEqual([]);
  });

  it('P19.29 from 768px nothing changes: the title, the chip, the bar, the tiles, the four cards and the notes', async () => {
    atWidth(1280);
    render();
    await screen.findByRole('heading', { level: 1, name: 'BSD City Branch' });
    await drawn('[data-view-as]');
    expect(document.querySelector('[data-kpm-header]')).toBeNull();
    expect(document.querySelector('[data-inside-kpm-bar]')).not.toBeNull();
    expect(document.querySelector('[data-owner-page-rows]')).toBeNull();
    expect(document.querySelector('[data-view-as-card]')).toBeNull();
    expect(document.querySelectorAll('[data-view-as-role]')).toHaveLength(4);
    expect(screen.getByText(/^Jendela baru menampilkan persis/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Semua halaman owner untuk KPM ini' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan sebagai template' })).toBeInTheDocument();
  });
});
