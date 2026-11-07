import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import HomePage from '@/app/(agent)/home/page';
import type { HomeTeamPerson, HomeView } from '@/lib/home';
import type { Me } from '@/lib/session';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch, wears } from '@test/harness';
import {
  AGENT_VIEW, AGUS_AB, DEWI_AAB, HUDDLE_ENTRY, LEADER, NEW_LEADER, RINA_AGENT, TEAM,
} from '@test/home-fixtures';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => nav,
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  nav.push.mockClear();
});

/**
 * **P19.8-T2 — Home, as the owner approved it on 7 November** (`revisions/2026-11-09/`; ADR-0228; MOB UI-163 to UI-170;
 * `home-mobile-stopmotion-2026-11-07.html`): the order, *Tim saya* gone, the button row, six tiles by role, the event's
 * detail over Home, *Laporan aktivitas tim*. A phone at 375 and 360 unless a test says otherwise.
 */

const PHONES = [375, 360] as const;
const BLOCKS = ['quote', 'buttons', 'tiles', 'actions', 'team', 'chart'] as const;
const block = (name: string) => document.querySelector<HTMLElement>(`[data-home-${name}]`);
const tiles = () => [...block('tiles')!.querySelectorAll<HTMLElement>(':scope > a')];
const labelOf = (tile: HTMLElement) => tile.querySelector('[data-stat-label]')!.textContent;

async function open(view: HomeView, { px = 375, me = AGUS_AB, id = true, routes = {} }: {
  px?: number; me?: Me; id?: boolean; routes?: Parameters<typeof stubFetch>[0];
} = {}) {
  atWidth(px);
  const stub = stubFetch({ '/home': { body: view }, ...routes });
  (id ? renderInIndonesian : renderWithSession)(<HomePage />, { me });
  await waitFor(() => expect(block('chart')).not.toBeNull());
  return stub;
}

const RULES = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };

describe('P19.8-T2 AC-1 MOB UI-164 one order at every size', () => {
  it.each(PHONES)('P19.8-T2 AC-1 MOB UI-164 at %ipx: quote → Buat proposal | Tambah user → six tiles → Aksi hari ini → Laporan aktivitas tim → Aktivitas 7 hari, one column', async (px) => {
    await open(LEADER, { px });
    const drawn = BLOCKS.map(block);
    expect(drawn.every((el) => el !== null)).toBe(true);
    for (let i = 1; i < drawn.length; i += 1) {
      expect(drawn[i - 1]!.compareDocumentPosition(drawn[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(wears(document.querySelector('[data-home]')!.firstElementChild!, px).split(' ')).toContain('grid-cols-1');
    // The tiles two by two, 8px apart (2 × 167.5px at 375), and 8px under the button row.
    const worn = wears(block('tiles')!, px).split(' ');
    expect(worn).toEqual(expect.arrayContaining(['grid-cols-2', 'gap-2', '-mt-1.5']));
    expect(tiles()).toHaveLength(6);
  });

  it.each([768, 1024, 1280])('P19.8-T2 AC-1 at %ipx the same blocks in the same order, in the columns the size had', async (px) => {
    await open(LEADER, { px });
    const drawn = BLOCKS.map(block);
    for (let i = 1; i < drawn.length; i += 1) {
      expect(drawn[i - 1]!.compareDocumentPosition(drawn[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const grid = wears(document.querySelector('[data-home]')!.firstElementChild!, px).split(' ');
    expect(grid).toContain(px < 1024 ? 'grid-cols-2' : 'grid-cols-[3fr_2fr]');
    if (px >= 1024) {
      // The left column holds the quote, the buttons, the tiles and Aksi hari ini; the right the team and the chart.
      const [left, right] = [...document.querySelector('[data-home]')!.firstElementChild!.children];
      for (const name of ['quote', 'buttons', 'tiles', 'actions']) expect(left.contains(block(name))).toBe(true);
      for (const name of ['team', 'chart']) expect(right.contains(block(name))).toBe(true);
    } else {
      for (const name of ['quote', 'buttons', 'tiles', 'actions']) expect(wears(block(name)!, px).split(' ')).toContain('col-span-2');
    }
  });
});

describe('P19.8-T2 AC-2 MOB UI-163 no Tim saya', () => {
  it.each([375, 360, 768, 1280])('P19.8-T2 AC-2 MOB UI-163 at %ipx: no Tim saya block and no Coaching minggu ini — Coaching 7 hari is the one coaching figure', async (px) => {
    await open(LEADER, { px });
    expect(document.querySelector('[data-home-tim-saya]')).toBeNull();
    for (const words of ['Tim saya', 'Anggota tim', 'Coaching minggu ini', 'Recruitment pipeline']) {
      expect(screen.queryByText(words)).toBeNull();
    }
    expect(screen.getAllByText('Coaching 7 hari')).toHaveLength(1);
  });
});

describe('P19.8-T2 AC-3 MOB UI-164 OD-277 the button row', () => {
  const buttons = () => block('buttons');

  it.each(PHONES)('P19.8-T2 AC-3 MOB UI-164 at %ipx an AB sees two white 44px pills, 8px apart, 14px / 700 in navy with their icons', async (px) => {
    await open(LEADER, { px });
    expect(wears(buttons()!, px).split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-2', 'gap-2']));
    const make = screen.getByRole('link', { name: 'Buat proposal' });
    const add = screen.getByRole('link', { name: 'Tambah user' });
    expect(make).toHaveAttribute('href', '/proposal/new');
    expect(add).toHaveAttribute('href', '/user-management/add');
    for (const pill of [make, add]) {
      expect(pill.className.split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'rounded-pill', 'bg-card', 'text-md', 'font-bold', 'text-navy', 'whitespace-nowrap']));
      expect(pill.querySelector('svg')).not.toBeNull();
    }
    // Above the tiles now (ADR-0228 §3), where Buat proposal was one 48px pill under them.
    expect(buttons()!.compareDocumentPosition(block('tiles')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('P19.8-T2 AC-3 OD-277 the AAB sees both; the Agent sees Buat proposal alone, across the row', async () => {
    await open(NEW_LEADER, { me: DEWI_AAB });
    expect(screen.getByRole('link', { name: 'Tambah user' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buat proposal' })).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    await open(AGENT_VIEW, { me: RINA_AGENT });
    expect(screen.queryByRole('link', { name: 'Tambah user' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Buat proposal' })).toBeInTheDocument();
    expect(wears(buttons()!, 375).split(' ')).toContain('grid-cols-1');
  });

  it('P19.8-T2 AC-3 the Owner and an Admin in their field view, as their rung: both pills', async () => {
    for (const office of [{ isKpmOwner: true }, { isKpmAdmin: true }]) {
      const me = makeMe({ ...AGUS_AB, membership: { ...AGUS_AB.membership!, ...office } });
      await open(LEADER, { me });
      expect(screen.getByRole('link', { name: 'Tambah user' })).toHaveAttribute('href', '/user-management/add');
      expect(screen.getByRole('link', { name: 'Buat proposal' })).toBeInTheDocument();
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });

  it('P19.8-T2 AC-3 neither in a read-only support session', async () => {
    await open(LEADER, { me: { ...AGUS_AB, isImpersonating: true, impersonationReadOnly: true } });
    expect(buttons()).toBeNull();
  });
});

describe('P19.8-T2 AC-4 MOB UI-166 MOB UI-170 OD-283 OD-284 the tiles, by role', () => {
  it.each(PHONES)('P19.8-T2 AC-4 at %ipx a leader’s six tiles, in the owner’s order, each opening its page', async (px) => {
    await open(LEADER, { px });
    expect(tiles().map((tile) => [labelOf(tile), tile.getAttribute('href')])).toEqual([
      ['Aktivitas saya', '/activity/log'],
      ['Jadwal hari ini', '/calendar?view=agenda&date=2026-10-30'],
      ['Active AgentOktActive Agent Oktober', '/unit/dashboard'],
      ['Coaching 7 hari', '/coaching'],
      ['Leads', '/leads'],
      ['New hires', '/new-hires'],
    ]);
    // OD-283: the reader's own open leads; the Group's new hires before a first sale.
    expect(tiles()[4]).toHaveTextContent('Leads16');
    expect(tiles()[5]).toHaveTextContent('New hires3');
  });

  it.each(PHONES)('P19.8-T2 AC-4 MOB UI-166 at %ipx an AAB with nobody: all six, 0 dari – on the leader tiles with no ring and no chips, nothing else in a tile', async (px) => {
    await open(NEW_LEADER, { px, me: DEWI_AAB });
    expect(tiles()).toHaveLength(6);
    for (const tile of tiles().slice(2, 4)) {
      expect(tile).toHaveTextContent(/0dari –$/);
      expect(within(tile).queryByRole('img')).toBeNull();
      expect(tile.querySelector('li')).toBeNull();
    }
    expect(tiles()[4]).toHaveTextContent(/^Leads0$/);
    expect(tiles()[5]).toHaveTextContent(/^New hires0$/);
    // MOB UI-170: no Belum ada data and no next-step sentence in a tile.
    for (const tile of tiles()) expect(tile.textContent).not.toMatch(/Belum ada|→/);
  });

  it('P19.8-T2 AC-4 OD-284 an Agent: Aktivitas saya | Jadwal hari ini, then Leads across the row — no leader tile', async () => {
    await open(AGENT_VIEW, { me: RINA_AGENT });
    expect(tiles().map(labelOf)).toEqual(['Aktivitas saya', 'Jadwal hari ini', 'Leads']);
    expect(tiles()[2]).toHaveTextContent('Leads5');
    expect(wears(tiles()[2], 375).split(' ')).toContain('col-span-2');
  });

  it('P19.8-T2 AC-4 OD-284 an Agent whose menu has New Hires: Leads beside New hires', async () => {
    await open(AGENT_VIEW, { me: { ...RINA_AGENT, newHires: true } });
    expect(tiles().map(labelOf)).toEqual(['Aktivitas saya', 'Jadwal hari ini', 'Leads', 'New hires']);
    expect(wears(tiles()[2], 375).split(' ')).not.toContain('col-span-2');
  });

  it.each(PHONES)('P19.8-T2 AC-4 MOB UI-164 at %ipx + Log across the tile, 44px, when today is 0, and nothing else; n hari ini and Kemarin n otherwise', async (px) => {
    await open(LEADER, { px });
    const log = tiles()[0].querySelector('[data-log-pill]')!;
    expect(wears(log, px).split(' ')).toEqual(expect.arrayContaining(['flex', 'h-11', 'w-full']));
    expect(tiles()[0]).not.toHaveTextContent('Kemarin');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    await open({ ...LEADER, activity: { ...LEADER.activity, today: 2, yesterday: 5 } }, { px });
    expect(tiles()[0]).toHaveTextContent('Aktivitas saya2hari iniKemarin 5');
    expect(tiles()[0].querySelector('[data-log-pill]')).toBeNull();
  });
});

describe('P19.8-T2 AC-5 MOB UI-167 Active Agent and its month', () => {
  it.each(PHONES)('P19.8-T2 AC-5 MOB UI-167 at %ipx: Active Agent on one line with a 12px grey chip of the month', async (px) => {
    await open(LEADER, { px });
    const short = tiles()[2].querySelector('[data-active-agent-short]')!;
    expect(wears(short, px).split(' ')).toEqual(expect.arrayContaining(['inline-flex', 'whitespace-nowrap']));
    const chip = short.querySelector('[data-month-chip]')!;
    expect(chip).toHaveTextContent(/^Okt$/);
    expect(chip.className.split(' ')).toEqual(expect.arrayContaining(['text-sm', 'rounded-pill', 'bg-hover-row', 'text-muted']));
    // A screen reader hears the month in full; the short line is not read twice.
    expect(wears(tiles()[2].querySelector('[data-active-agent-long]')!, px).split(' ')).toContain('sr-only');
    expect(short).toHaveAttribute('aria-hidden', 'true');
    expect(tiles()[2]).toHaveAccessibleName(/Active Agent Oktober/);
  });

  it.each([768, 1280])('P19.8-T2 AC-5 at %ipx a tablet and a laptop keep Active Agent November', async (px) => {
    await open(LEADER, { px });
    expect(wears(tiles()[2].querySelector('[data-active-agent-short]')!, px).split(' ')).toContain('hidden');
    expect(wears(tiles()[2].querySelector('[data-active-agent-long]')!, px).split(' ')).not.toContain('sr-only');
  });
});

describe('P19.8-T2 AC-6 MOB UI-168 type sizes on a phone', () => {
  it.each(PHONES)('P19.8-T2 AC-6 MOB UI-168 at %ipx: tile labels 13px, the team report’s names 13px / 700, chips and meta 12px', async (px) => {
    await open(LEADER, { px });
    for (const label of document.querySelectorAll('[data-stat-label]')) expect(wears(label, px).split(' ')).toContain('text-base');
    for (const chip of block('tiles')!.querySelectorAll('li')) expect(chip.className.split(' ')).toContain('text-sm');
    const name = block('team')!.querySelector('[data-person-row] .uppercase')!;
    expect(wears(name, px).split(' ')).toEqual(expect.arrayContaining(['text-base', 'font-bold']));
    for (const meta of block('actions')!.querySelectorAll('[data-row-main] > span:last-child')) {
      expect(meta.className.split(' ')).toContain('text-sm');
    }
  });
});

describe('P19.8-T2 AC-7 MOB UI-169 Aksi hari ini: the row, the detail over Home, Hapus asks', () => {
  const rows = () => [...block('actions')!.querySelectorAll<HTMLElement>('[data-action-row]')];
  const entryRoutes = (second: HomeView = { ...LEADER, actions: LEADER.actions.slice(0, 2) }) => ({
    '/home': [{ body: LEADER }, { body: second }],
    'GET /calendar/entries/e-1': { body: HUDDLE_ENTRY },
    'DELETE /calendar/entries/e-1': { body: { entryId: 'e-1', deletedAt: '2026-10-30T02:10:00.000Z' } },
  });

  it.each([375, 360, 1280])('P19.8-T2 AC-7 MOB UI-169 at %ipx each row is 64px and tappable whole', async (px) => {
    await open(LEADER, { px });
    expect(rows()).toHaveLength(3);
    for (const row of rows()) {
      expect(wears(row, px).split(' ')).toContain('min-h-16');
      expect(row.querySelector('[data-row-main]')!.className).toContain("after:inset-0");
    }
  });

  it.each(PHONES)('P19.8-T2 AC-7 MOB UI-169 at %ipx an event row opens the Calendar’s detail over Home, with no navigation: Hapus · Ubah · Tutup', async (px) => {
    const user = userEvent.setup();
    const { calls } = await open(LEADER, { px, routes: entryRoutes() });
    await user.click(within(rows()[2]).getByRole('button', { name: /Weekly unit huddle/ }));
    const detail = await screen.findByRole('dialog', { name: 'Weekly unit huddle' });
    expect(calls.some((c) => c.url.includes('/calendar/entries/e-1'))).toBe(true);
    expect(nav.push).not.toHaveBeenCalled();
    // Home is still there under it.
    expect(block('tiles')).not.toBeNull();
    expect([...detail.querySelectorAll('dt')].map((dt) => dt.textContent!.toUpperCase())).toEqual(['KAPAN', 'LOKASI / CATATAN', 'YANG DIUNDANG']);
    const footer = detail.querySelector('[data-detail-actions]')!;
    const names = within(footer as HTMLElement).getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['Hapus', 'Ubah', 'Tutup']);
    expect(within(footer as HTMLElement).getByRole('button', { name: 'Tutup' }).className).toContain('bg-primary');
  });

  it('P19.8-T2 AC-7 MOB UI-169 Hapus asks first: Hapus event ini?, the title and day under it; Batal goes back to the detail', async () => {
    const user = userEvent.setup();
    const { calls } = await open(LEADER, { routes: entryRoutes() });
    await user.click(within(rows()[2]).getByRole('button', { name: /Weekly unit huddle/ }));
    const detail = await screen.findByRole('dialog', { name: 'Weekly unit huddle' });
    await user.click(within(detail).getByRole('button', { name: 'Hapus' }));
    const question = await screen.findByRole('dialog', { name: 'Hapus event ini?' });
    expect(question).toHaveAccessibleDescription(/Weekly unit huddle · Sabtu, 31 Okt 2026/);
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    await user.click(within(question).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Hapus event ini?' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Weekly unit huddle' })).toBeInTheDocument();
  });

  it('P19.8-T2 AC-7 MOB UI-169 Hapus deletes, pinned to the version read, and Home reads itself again: the row leaves', async () => {
    const user = userEvent.setup();
    const { calls } = await open(LEADER, { routes: entryRoutes() });
    await user.click(within(rows()[2]).getByRole('button', { name: /Weekly unit huddle/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Weekly unit huddle' })).getByRole('button', { name: 'Hapus' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Hapus event ini?' })).getByRole('button', { name: 'Hapus' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    const deleted = calls.find((c) => c.init.method === 'DELETE')!;
    expect(deleted.url).toContain('/calendar/entries/e-1');
    expect(deleted.url).toContain('version=3');
    expect(calls.filter((c) => c.url.endsWith('/home')).length).toBe(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('P19.8-T2 AC-7 Ubah opens the Calendar’s edit dialog over Home', async () => {
    const user = userEvent.setup();
    await open(LEADER, { routes: { ...entryRoutes(), '/calendar/people': { body: { groups: [] } } } });
    await user.click(within(rows()[2]).getByRole('button', { name: /Weekly unit huddle/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Weekly unit huddle' })).getByRole('button', { name: 'Ubah' }));
    expect(await screen.findByRole('dialog', { name: 'Ubah event' })).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('P19.8-T2 AC-7 a read-only support session sees neither Hapus nor Ubah: Tutup alone', async () => {
    const user = userEvent.setup();
    await open(LEADER, { me: { ...AGUS_AB, isImpersonating: true, impersonationReadOnly: true }, routes: entryRoutes() });
    await user.click(within(rows()[2]).getByRole('button', { name: /Weekly unit huddle/ }));
    const detail = await screen.findByRole('dialog', { name: 'Weekly unit huddle' });
    const footer = detail.querySelector('[data-detail-actions]') as HTMLElement;
    expect(within(footer).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tutup']);
  });

  it('P19.8-T2 AC-7 a Tugas row keeps its target, an event joined opens its page, Semua › the Agenda from today', async () => {
    const joined: HomeView = {
      ...LEADER,
      actions: [...LEADER.actions.slice(0, 2), { kind: 'agenda', source: 'event', id: 'ev-9', type: 'BOP', title: 'BOP Surabaya', date: '2026-11-02', start: '09:00' }],
    };
    await open(joined);
    expect(rows()[0].querySelector('a[data-row-main]')).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
    expect(rows()[1].querySelector('a[data-row-main]')).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
    expect(rows()[2].querySelector('a[data-row-main]')).toHaveAttribute('href', '/events/ev-9');
    expect(within(block('actions')!).getByRole('link', { name: 'Semua untuk hari ini di Kalender' })).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
  });

  it('P19.8-T2 AC-7 D-08 the section is hidden when there is nothing', async () => {
    await open(NEW_LEADER, { me: DEWI_AAB });
    expect(block('actions')).toBeNull();
  });

  it.each(PHONES)('P19.8-T2 AC-7 at %ipx the detail over Home and its question pass axe', async (px) => {
    const user = userEvent.setup();
    await open(LEADER, { px, routes: entryRoutes() });
    await user.click(within(rows()[2]).getByRole('button', { name: /Weekly unit huddle/ }));
    await screen.findByRole('dialog', { name: 'Weekly unit huddle' });
    expect((await axe(document.body, RULES)).violations).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Hapus' }));
    await screen.findByRole('dialog', { name: 'Hapus event ini?' });
    expect((await axe(document.body, RULES)).violations).toEqual([]);
  });
});

describe('P19.8-T2 AC-8 MOB UI-165 D-22 Laporan aktivitas tim', () => {
  const rowsOf = () => [...block('team')!.querySelectorAll<HTMLElement>('[data-person-row]')];

  it.each(PHONES)('P19.8-T2 AC-8 MOB UI-165 at %ipx: the title; a grey ✕ named Belum lapor where nobody reported, the orange count where they did', async (px) => {
    const user = userEvent.setup();
    await open(LEADER, { px });
    expect(screen.getByRole('heading', { name: 'Laporan aktivitas tim' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Group' }));
    const rina = rowsOf().find((r) => r.textContent!.includes('Rina Wijaya'))!;
    const [yesterday, today] = [...rina.querySelectorAll('[data-logged]')];
    expect(yesterday).toHaveAttribute('data-logged', 'true');
    expect(yesterday).toHaveTextContent(/^1$/);
    expect(yesterday.className.split(' ')).toEqual(expect.arrayContaining(['bg-primary-50', 'text-primary-deep', 'font-bold']));
    // A saved day of nothing is a ✕ too (ADR-0042).
    expect(today).toHaveAttribute('data-logged', 'false');
    expect(today).toHaveAccessibleName('Belum lapor');
    expect(today.querySelector('svg')).toHaveAttribute('width', '20');
    expect(today.className).toContain('text-signal-grey');
    expect(rina).not.toHaveTextContent('Belum lapor');
  });

  it.each(PHONES)('P19.8-T2 AC-8 MOB UI-165 at %ipx the row: avatar 32 · the name never cut · 52 · 52 · WhatsApp 36, 10px apart', async (px) => {
    const long = 'Raden Ayu Kartika Sari Indah Puspitasari';
    expect(long).toHaveLength(40);
    const team: HomeTeamPerson[] = [{ ...TEAM[2], name: long }];
    await open({ ...LEADER, leader: { ...LEADER.leader!, team } }, { px });
    const row = rowsOf()[0];
    expect(wears(row, px).split(' ')).toEqual(expect.arrayContaining(['gap-2.5', 'min-h-[3.75rem]']));
    const name = row.querySelector('.uppercase')!;
    expect(name).toHaveTextContent(long);
    expect(wears(name, px).split(' ')).toEqual(expect.arrayContaining(['whitespace-normal', 'break-words']));
    expect(row.querySelectorAll('.w-\\[3\\.25rem\\]')).toHaveLength(2);
    // A 36px circle, its 44px target reaching into the gaps (`-mx-1`), so the column reads 36px.
    const whatsApp = within(row).getByRole('link', { name: /WhatsApp/ });
    expect(whatsApp.firstElementChild!.className.split(' ')).toEqual(expect.arrayContaining(['h-9', 'w-9']));
    expect(whatsApp.parentElement!.parentElement!.className).toContain('-mx-1');
  });

  it('P19.8-T2 AC-8 OD-278 five rows, then Semua › to the Unit Dashboard’s Aktivitas tab; three in the Unit, no Semua', async () => {
    const user = userEvent.setup();
    await open(LEADER);
    expect(rowsOf()).toHaveLength(3);
    expect(block('team')!.querySelector('[data-team-all]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Group' }));
    // The server's order, unchanged: nobody both days, then nobody today, then the rest.
    expect(rowsOf().map((r) => r.querySelector('.uppercase')!.textContent)).toEqual(['Lukman Hakim', 'Herman Widjaja', 'Siti Rahmawati', 'Dewi Lestari', 'Rina Wijaya']);
    const all = within(block('team')!).getByRole('link', { name: 'Semua 7 di Unit Dashboard' });
    expect(all).toHaveAttribute('href', '/unit/dashboard?tab=activities');
    expect(all).toHaveTextContent('Semua');
  });

  it('P19.8-T2 AC-8 MOB UI-171 Unit | Group at the header-control size, 13px / 600 / 44px, at every size', async () => {
    for (const px of [375, 1280]) {
      await open(LEADER, { px });
      for (const name of ['Unit', 'Group']) {
        expect(wears(screen.getByRole('button', { name }), px).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'text-base', 'font-semibold']));
      }
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });
});

describe('P19.8-T2 AC-9 MOB UI-166 the team report is every leader’s by role', () => {
  it.each(PHONES)('P19.8-T2 AC-9 MOB UI-166 at %ipx nobody in the scope: one line, Tambah agent pertama →, to /new-hires', async (px) => {
    await open(NEW_LEADER, { px, me: DEWI_AAB });
    const team = block('team')!;
    expect(within(team).getByRole('heading', { name: 'Laporan aktivitas tim' })).toBeInTheDocument();
    const first = within(team).getByRole('link', { name: 'Tambah agent pertama →' });
    expect(first).toHaveAttribute('href', '/new-hires');
    expect(team.querySelectorAll('[data-person-row]')).toHaveLength(0);
    expect(team).not.toHaveTextContent('Belum ada');
  });

  it('P19.8-T2 AC-9 an Agent has no team report', async () => {
    await open(AGENT_VIEW, { me: RINA_AGENT });
    expect(block('team')).toBeNull();
  });
});

describe('P19.8-T2 AC-12 the mockup’s frames at 375 and 360', () => {
  it.each(PHONES)('P19.8-T2 AC-12 at %ipx Fixed Home: every tap of the tour goes where the mockup says', async (px) => {
    const user = userEvent.setup();
    await open(LEADER, { px });
    const href = (name: string | RegExp) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href('Buat proposal')).toBe('/proposal/new');
    expect(href('Tambah user')).toBe('/user-management/add');
    expect(href(/^Aktivitas saya/)).toBe('/activity/log');
    expect(href(/^Jadwal hari ini/)).toBe('/calendar?view=agenda&date=2026-10-30');
    expect(href(/^Active Agent/)).toBe('/unit/dashboard');
    expect(href(/^Coaching 7 hari/)).toBe('/coaching');
    expect(href(/^Leads/)).toBe('/leads');
    expect(href(/^New hires/)).toBe('/new-hires');
    expect(href('Semua untuk hari ini di Kalender')).toBe('/calendar?view=agenda&date=2026-10-30');
    expect(within(block('chart')!).getByRole('link')).toHaveAttribute('href', '/activity/log');
    await user.click(screen.getByRole('button', { name: 'Group' }));
    expect(href('Semua 7 di Unit Dashboard')).toBe('/unit/dashboard?tab=activities');
    expect((await axe(document.body, RULES)).violations).toEqual([]);
  });

  it.each(PHONES)('P19.8-T2 AC-12 at %ipx With activities: 2 hari ini and Kemarin 5, orange counts beside the ✕, the chart’s total', async (px) => {
    await open({ ...LEADER, activity: { ...LEADER.activity, today: 2, yesterday: 5 } }, { px });
    expect(tiles()[0]).toHaveTextContent('2hari iniKemarin 5');
    expect(block('team')!.querySelectorAll('[data-logged="true"]').length).toBeGreaterThan(0);
    expect(block('team')!.querySelectorAll('[data-logged="false"]').length).toBeGreaterThan(0);
    expect(block('chart')).toHaveTextContent('18 aktivitas');
  });

  it.each(PHONES)('P19.8-T2 AC-12 at %ipx the empty AAB: the six tiles at 0, Tambah agent pertama →, the sleeping Boost, axe clean', async (px) => {
    await open(NEW_LEADER, { px, me: DEWI_AAB });
    expect(tiles()).toHaveLength(6);
    expect(block('team')).toHaveTextContent('Tambah agent pertama →');
    expect(block('chart')!.querySelector('[data-boost]')).not.toBeNull();
    expect(document.body).not.toHaveTextContent('Belum ada data');
    expect((await axe(document.body, RULES)).violations).toEqual([]);
  });
});
