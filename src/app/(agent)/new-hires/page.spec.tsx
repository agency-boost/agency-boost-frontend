import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { notFound, readOnlySession, ROSTER, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import { invite, JOINING_PERMISSIONS, requestedTransfer, TODAY } from '@test/joining-fixtures';
import type { NewHiresRoster } from '@/lib/activation';
import NewHiresPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => '/new-hires',
  // The year is the address's (P19.9-T3 AC-2): each test names its own, and starts from none.
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** Agus, the AB the roster is his — who coaches, adds agents and decides requests. */
const AGUS = {
  ...SARI_ME,
  user: { ...SARI_ME.user, id: 'u-agus', fullName: 'Agus Prasetyo', preferredName: 'Agus', initials: 'AP' },
  membership: { ...SARI_ME.membership!, membershipId: 'mem-agus', hierarchyRole: 'ab' as const, orgLevelCode: 'AB' },
  permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS],
};

const WAITING = {
  '/new-hires/invites': {
    body: {
      today: TODAY,
      invites: [
        invite({ inviteId: 'inv-stefan', fullName: 'Stefan Wijaya', agentCode: '80111' }),
        invite({ inviteId: 'inv-yusuf', fullName: 'Yusuf Hidayat' }),
      ],
    },
  },
  '/new-hires/transfers': { body: [requestedTransfer({ requestedName: 'Raka Aditama' })] },
};

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = AGUS) => {
  const stub = stubFetch({
    ...SHELL_STUBS,
    '/new-hires': { body: ROSTER },
    ...WAITING,
    '/join/requests': { body: [] },
    '/join/requests/routing': { body: [] },
    '/join/my-code': { body: { code: 'AGUS01', url: 'https://app.test/join?code=AGUS01' } },
    ...routes,
  });
  const view = renderInLayout(AgentLayout, <NewHiresPage />, { me });
  return { ...stub, ...view };
};

beforeEach(() => { nav.search = ''; nav.replace.mockClear(); });

const group = (name: string) => screen.findByRole('group', { name });
const toggleOf = (region: HTMLElement) => within(region).getAllByRole('button', { name: /team$/ })[0];

describe('/new-hires below 768px — UI V1 (UI-023 to UI-026, D-24)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-024 two tiles at the top: Aktivasi 3M as the server’s % alone, and Menunggu bergabung with its count', async () => {
    atWidth(375);
    show();
    const tile = await screen.findByRole('region', { name: '3M activation rate' });
    // UI-023: only the percentage — never "4 activated · 1 not activated", never 3/4. P19.11-T2 AC-2: 4 of 6 due, 67%.
    expect(tile).toHaveTextContent(/^3M activation rate67%$/);
    const waiting = await screen.findByRole('button', { name: 'Waiting to join: 3. Show them' });
    expect(waiting).toHaveTextContent('3');
    // The month filter and the counts sentence are gone.
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(/in progress$/)).toBeNull();
  });

  it('UI-024 the reader’s own group open on load, the AAB groups closed; newest joiner on top', async () => {
    atWidth(375);
    show();
    const own = await group('Agus Prasetyo');
    expect(own).toHaveTextContent('You · Direct Unit · 5');
    expect(toggleOf(own)).toHaveAttribute('aria-expanded', 'true');
    expect(within(own).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Fikri Ramadhan', 'Dimas Saputra', 'Indah Permata', 'Lukman Hakim', 'Kemal Pratama',
    ]);
    for (const name of ['Arief Hidayat', 'Sari Puspita']) {
      const closed = await group(name);
      expect(toggleOf(closed)).toHaveAttribute('aria-expanded', 'false');
      expect(within(closed).queryAllByRole('link')).toEqual([]);
      expect(closed).toHaveTextContent('AAB · 2');
    }
    await userEvent.click(toggleOf(await group('Arief Hidayat')));
    // P19.11-T2 AC-1: Tari, marked left, is listed and opens as anybody (the test below).
    expect(within(await group('Arief Hidayat')).getAllByRole('link').map((l) => l.textContent)).toEqual(['Tari Wulandari', 'Novi Lestari']);
  });

  it('UI-023 each person: the status circle, one line — Pecah telor di hari ke-X, amber after day 90, or Hari ke-X — and the checklist %', async () => {
    atWidth(375);
    show();
    const own = await group('Agus Prasetyo');
    const row = (name: string) => within(own).getByRole('link', { name }).closest('[data-person-row]') as HTMLElement;
    expect(row('Dimas Saputra')).toHaveTextContent('ActivatedDimas SaputraFirst sale on day 3950%');
    expect(row('Lukman Hakim').querySelector('[data-status]')).toHaveAttribute('data-status', 'activated_late');
    expect(within(row('Lukman Hakim')).getByText('First sale on day 96')).toHaveClass('text-primary-ink');
    expect(row('Fikri Ramadhan')).toHaveTextContent('Not yetFikri RamadhanDay 38No checklist');
    // UI-024: no join date, first-sale date, agent code or status chip on a row.
    expect(own).not.toHaveTextContent(/Join date|2026|Activated ·/);
  });

  it('P19.9-T3 AC-4 the whole row opens the person’s activation, with a › — for a leader who coaches too (was their coaching page, UI-029)', async () => {
    atWidth(375);
    show();
    const link = within(await group('Agus Prasetyo')).getByRole('link', { name: 'Dimas Saputra' });
    expect(link).toHaveAttribute('href', '/new-hires/mem-dimas');
    expect(link.closest('[data-person-row]')!.querySelector('svg')).not.toBeNull();
  });

  it('P19.9-T3 AC-4 an Agent who leads, who runs no coaching, opens the same activation', async () => {
    atWidth(375);
    show({}, { ...AGUS, permissions: AGUS.permissions.filter((p) => p !== 'coaching_session:create') });
    expect(within(await group('Agus Prasetyo')).getByRole('link', { name: 'Dimas Saputra' })).toHaveAttribute('href', '/new-hires/mem-dimas');
  });

  it('UI-024 Semua · Teraktivasi · Belum with counts; Belum shows only people without a pecah telor and hides empty leaders', async () => {
    atWidth(375);
    show();
    const filter = await screen.findByRole('group', { name: 'Show' });
    expect(within(filter).getAllByRole('button').map((b) => b.textContent)).toEqual(['All 9', 'Activated 5', 'Not yet 4']);
    await userEvent.click(within(filter).getByRole('button', { name: 'Not yet 4' }));
    expect(within(filter).getByRole('button', { name: 'Not yet 4' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(await group('Agus Prasetyo')).getAllByRole('link').map((l) => l.textContent)).toEqual(['Fikri Ramadhan', 'Kemal Pratama']);
    await userEvent.click(within(filter).getByRole('button', { name: 'Activated 5' }));
    // Nobody under Sari but Rina, nobody under Arief but Novi: both stay; a leader with nobody left is hidden.
    expect(screen.getAllByRole('group').map((r) => r.getAttribute('aria-label'))).toEqual(
      expect.arrayContaining(['Agus Prasetyo', 'Arief Hidayat', 'Sari Puspita']),
    );
  });

  it('UI-024 Menunggu bergabung opens a sheet with the invites and the transfer; Batalkan undangan is last, red, and asks first', async () => {
    atWidth(375);
    const { calls } = show({ 'DELETE /new-hires/invites/inv-stefan': { body: { today: TODAY, invites: [invite()] } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Waiting to join: 3. Show them' }));
    const sheet = await screen.findByRole('dialog', { name: 'Waiting to join' });
    expect(within(sheet).getAllByRole('listitem').map((li) => li.querySelector('p')!.textContent)).toEqual([
      'Stefan Wijaya', 'Yusuf Hidayat', 'Raka Aditama',
    ]);
    expect(within(sheet).getByText('Transfer requested')).toBeInTheDocument();
    // No Resend or Cancel on the row itself: they are in its ⋯.
    expect(within(sheet).queryByRole('button', { name: 'Cancel invite' })).toBeNull();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Actions for Stefan Wijaya' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Resend', 'Cancel invite']);
    await userEvent.click(items[1]);
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    const ask = (await screen.findByText('Cancel the invite for Stefan Wijaya? Its link stops working.')).closest('[role="dialog"]') as HTMLElement;
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel invite' }));
    expect(calls.filter((c) => c.init.method === 'DELETE').map((c) => c.url)).toEqual(['http://api.test/api/v1/new-hires/invites/inv-stefan']);
  });

  it('UI-025, UI-026 no Keluar, no Tandai keluar and no terlambat anywhere — Tari, marked left, reads as anybody', async () => {
    atWidth(375);
    show();
    await userEvent.click(toggleOf(await group('Arief Hidayat')));
    const page = document.body;
    expect(page).not.toHaveTextContent(/Left|Mark left|overdue/);
    expect(within(await group('Arief Hidayat')).getByText('Tari Wulandari')).toBeInTheDocument();
  });

  /*
   * *Changed 2026-11-10 (P19.11-T2 AC-1, UX-3; ADR-0239):* the Phase 19.9 exit review's L4 drew a new hire who left as a
   * row that opened nothing, because their detail answered *not found*. The detail reaches everybody the list shows now,
   * a leaver read-only, so their row opens as anybody's: the link, the ›, the whole row.
   */
  it('P19.11-T2 AC-1 a new hire who left is listed and opens as anybody: the link, the ›, /new-hires/{id}', async () => {
    atWidth(375);
    show();
    await userEvent.click(toggleOf(await group('Arief Hidayat')));
    const link = within(await group('Arief Hidayat')).getByRole('link', { name: 'Tari Wulandari' });
    expect(link).toHaveAttribute('href', '/new-hires/mem-tari');
    const row = link.closest('[data-person-row]') as HTMLElement;
    expect(row).toHaveTextContent('Not yetTari WulandariDay 4119%');
    expect(row.lastElementChild!.tagName.toLowerCase()).toBe('svg');
  });

  it('P19-T4 AC-3 the empty year: Aktivasi 3M at –, No data yet, the list as it will look, and Add your first agent', async () => {
    atWidth(375);
    show({ '/new-hires': notFound });
    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(document.querySelector('[data-sample]')!.textContent).toContain('Sample agent 1');
    // Its filter is the sample's, inert: none is offered to the reader.
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add your first agent' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('a read-only support session is offered no + Add agent and no Menunggu bergabung', async () => {
    atWidth(375);
    show({}, readOnlySession(AGUS));
    await group('Agus Prasetyo');
    expect(screen.queryByRole('button', { name: '+ Add agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Waiting to join/ })).toBeNull();
  });
});

/*
 * *Changed 2026-11-05 (P19.1-T5 AC-2; UI-115):* the table and its right column from 1024px — a tablet draws the phone's
 * page (`new-hires-tablet.spec.tsx`). This block read *from 768px* and pinned the table at 768 and 1280.
 */
describe('/new-hires from 1024px — UI V1 (UI-024, D-24)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([1024, 1280])('UI-024 at %ipx: the same tree as a table (Nama · Status · Checklist), every leader open', async (px) => {
    atWidth(px);
    show();
    const table = await screen.findByRole('table', { name: 'New Hires' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.filter((h) => h.getAttribute('scope') === 'col').map((h) => h.textContent)).toEqual(['Name', 'Status', 'Checklist']);
    const leaders = headers.filter((h) => h.getAttribute('scope') === 'colgroup');
    expect(leaders.map((h) => h.textContent)).toEqual([
      expect.stringContaining('Agus Prasetyo'), expect.stringContaining('Arief Hidayat'), expect.stringContaining('Sari Puspita'),
    ]);
    // P19.11-T2 AC-1: every row header is its person's link — Tari, marked left, as anybody.
    const everyone = [
      'Fikri Ramadhan', 'Dimas Saputra', 'Indah Permata', 'Lukman Hakim', 'Kemal Pratama', 'Tari Wulandari', 'Novi Lestari',
      'Rina Wijaya', 'Budi Hartono',
    ];
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(everyone);
    expect(within(table).getAllByRole('link').map((l) => l.textContent)).toEqual(everyone);
    expect(within(table).getByRole('link', { name: 'Tari Wulandari' })).toHaveAttribute('href', '/new-hires/mem-tari');
    const lukman = within(table).getByRole('link', { name: 'Lukman Hakim' }).closest('tr')!;
    expect(lukman).toHaveTextContent('Activated after 3MFirst sale on day 96');
  });

  it('UI-024 the right column: the Aktivasi 3M tile and the invitation list with every phone action', async () => {
    atWidth(1280);
    show();
    expect(await screen.findByRole('region', { name: '3M activation rate' })).toHaveTextContent('67%');
    const list = await screen.findByRole('region', { name: 'Waiting to join' });
    expect(within(list).getAllByRole('button', { name: /^Actions for/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Actions for Stefan Wijaya', 'Actions for Yusuf Hidayat',
    ]);
    // The same filter, the same counts.
    const filter = screen.getByRole('group', { name: 'Show' });
    await userEvent.click(within(filter).getByRole('button', { name: 'Not yet 4' }));
    expect(within(screen.getByRole('table')).getAllByRole('rowheader').map((h) => h.textContent)).toEqual([
      'Fikri Ramadhan', 'Kemal Pratama', 'Tari Wulandari', 'Budi Hartono',
    ]);
  });

  it('UI-004 keeps the sub-line from 768px and the title as the nav item’s words', async () => {
    atWidth(1280);
    show();
    await screen.findByRole('table');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^New Hires$/);
    expect(screen.getByText('Track your new agents\' 90-day activation progress.')).toBeInTheDocument();
  });
});

/**
 * **The year** (P19.9-T3 AC-1, AC-2; ADR-0233, the owner's R2 and R3): *Tahun berjalan | Tahun lalu*, a header control
 * above what it scopes; the address carries the other year, and a row carries it to the detail for its ‹.
 */
describe('/new-hires by year — P19.9-T3', () => {
  afterEach(() => vi.unstubAllGlobals());
  const LAST_YEAR: NewHiresRoster = {
    ...ROSTER, year: 'previous', window: { from: '2025-01-01', to: '2025-12-31' },
    sections: { ...ROSTER.sections, inProgress: [], activated: ROSTER.sections.activated.slice(0, 1) },
  };
  const yearChoice = () => screen.findByRole('group', { name: 'Year' });

  it('P19.9-T3 AC-1 opens on This year, asked for by name, the control’s two choices 13px/600/44px', async () => {
    atWidth(375);
    const { calls } = show();
    const choice = await yearChoice();
    const [current, previous] = within(choice).getAllByRole('button');
    expect([current.textContent, previous.textContent]).toEqual(['This year', 'Last year']);
    expect(current).toHaveAttribute('aria-pressed', 'true');
    expect(previous).toHaveAttribute('aria-pressed', 'false');
    for (const button of [current, previous]) expect(button).toHaveClass('min-h-11', 'text-base', 'font-semibold');
    expect(calls.some((c) => c.url.endsWith('/new-hires?year=current'))).toBe(true);
  });

  it('P19.9-T3 AC-2 Last year goes to the address, replacing it', async () => {
    atWidth(375);
    show();
    await userEvent.click(within(await yearChoice()).getByRole('button', { name: 'Last year' }));
    expect(nav.replace).toHaveBeenCalledWith('/new-hires?year=previous', { scroll: false });
  });

  it('P19.9-T3 AC-2, AC-4 ?year=previous reads last year, and each row carries the year to the detail', async () => {
    atWidth(375);
    nav.search = 'year=previous';
    const { calls } = show({ '/new-hires?year=previous': { body: LAST_YEAR } });
    expect(within(await yearChoice()).getByRole('button', { name: 'Last year' })).toHaveAttribute('aria-pressed', 'true');
    expect(calls.some((c) => c.url.endsWith('/new-hires?year=previous'))).toBe(true);
    const link = (await screen.findAllByRole('link')).find((l) => l.getAttribute('href')?.startsWith('/new-hires/mem-'))!;
    expect(link.getAttribute('href')).toMatch(/^\/new-hires\/mem-[a-z]+\?year=previous$/);
  });

  it('P19.9-T3 AC-2 a year with nobody says so in one line, the year control still there to go back', async () => {
    atWidth(375);
    nav.search = 'year=previous';
    const nobody: NewHiresRoster = {
      ...LAST_YEAR, units: [], sections: { inProgress: [], activated: [], notActivated: [] },
      activation3M: { all: { activated: 0, notActivated: 0, late: 0, inProgress: 0, pct: null }, byMonth: [] },
    };
    show({ '/new-hires?year=previous': { body: nobody } });
    expect(await screen.findByText('No one joined as a new hire last year.')).toBeInTheDocument();
    expect(await yearChoice()).toBeInTheDocument();
    expect(screen.queryByText('No one here.')).toBeNull();
  });

  it('P19.9-T3 AC-2 from 1024px the control sits above the table and its column, its words’ width', async () => {
    atWidth(1280);
    show();
    const choice = await yearChoice();
    expect(choice).toHaveClass('lg:w-fit');
    expect(screen.getByTestId('new-hires-wide')).toBeInTheDocument();
  });
});

/**
 * **P19.11-T2 — New Hires (UX-3, UX-4, UX-14; ADR-0239).** Every row the list shows opens, at every size, under every
 * filter and on both years; a hire past day 90 with no first sale says so in alert ink; a hire not activated yet wears
 * their photo, or their initials, in the status circle.
 */
describe('/new-hires — P19.11-T2', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ids = new Map(Object.values(ROSTER.sections).flat().map((r) => [r.hire.name, r.hire.membershipId]));
  const LAST_YEAR: NewHiresRoster = { ...ROSTER, year: 'previous', window: { from: '2025-01-01', to: '2025-12-31' } };

  /** Every person's row on the phone's and the tablet's tree: each opens its person, with its ›. */
  const expectEveryRowOpens = (suffix: string) => {
    const rows = [...document.querySelectorAll<HTMLElement>('li[data-tree-node] [data-person-row]')];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const link = row.querySelector('a[data-row-main]');
      const name = row.querySelector('[data-row-main]')?.textContent ?? row.textContent;
      expect([name, link?.getAttribute('href')]).toEqual([name, `/new-hires/${ids.get(name!)}${suffix}`]);
      expect([name, row.lastElementChild!.tagName.toLowerCase()]).toEqual([name, 'svg']);
      // The whole row is the target: the name's link is stretched over it.
      expect(link).toHaveClass('after:absolute', 'after:inset-0');
    }
    return rows.length;
  };

  it.each([
    [375, 'current', ''], [375, 'previous', '?year=previous'], [768, 'current', ''], [768, 'previous', '?year=previous'],
  ] as const)('P19.11-T2 AC-1 at %ipx on %s year: every row opens under All, Activated and Not yet — none a dead end', async (px, year, suffix) => {
    atWidth(px);
    nav.search = year === 'previous' ? 'year=previous' : '';
    show({ '/new-hires?year=previous': { body: LAST_YEAR } });
    for (const name of ['Arief Hidayat', 'Sari Puspita']) {
      const toggle = toggleOf(await group(name));
      if (toggle.getAttribute('aria-expanded') === 'false') await userEvent.click(toggle);
    }
    const filter = await screen.findByRole('group', { name: 'Show' });
    const shown: number[] = [];
    for (const choice of ['All 9', 'Activated 5', 'Not yet 4']) {
      await userEvent.click(within(filter).getByRole('button', { name: choice }));
      shown.push(expectEveryRowOpens(suffix));
    }
    expect(shown).toEqual([9, 5, 4]);
  });

  it.each([
    [1024, 'current', ''], [1280, 'previous', '?year=previous'],
  ] as const)('P19.11-T2 AC-1 at %ipx on %s year: every row of the table is its person’s link with its ›, the whole row the target', async (px, year, suffix) => {
    atWidth(px);
    nav.search = year === 'previous' ? 'year=previous' : '';
    show({ '/new-hires?year=previous': { body: LAST_YEAR } });
    const table = await screen.findByRole('table', { name: 'New Hires' });
    const filter = screen.getByRole('group', { name: 'Show' });
    for (const choice of ['All 9', 'Activated 5', 'Not yet 4']) {
      await userEvent.click(within(filter).getByRole('button', { name: choice }));
      for (const header of within(table).getAllByRole('rowheader')) {
        const link = within(header).getByRole('link');
        expect([header.textContent, link.getAttribute('href')]).toEqual([header.textContent, `/new-hires/${ids.get(header.textContent!)}${suffix}`]);
        expect(link.querySelector('svg')).not.toBeNull();
        expect(link).toHaveClass('after:absolute', 'after:inset-0');
        expect(header.closest('tr')).toHaveClass('relative');
      }
    }
  });

  it('P19.11-T2 AC-3 past day 90 with no first sale: Day N · no first sale within 90 days, in alert ink — on the tree and the table', async () => {
    atWidth(375);
    show();
    const own = await group('Agus Prasetyo');
    const line = within(own).getByText('Day 110 · no first sale within 90 days');
    expect(line).toHaveClass('text-alert');
    // Inside the 90 days with none: Day N, the row's own ink; a late sale keeps its amber.
    expect(within(own).getByText('Day 38')).not.toHaveClass('text-alert');
    expect(within(own).getByText('First sale on day 96')).toHaveClass('text-primary-ink');
  });

  it('P19.11-T2 AC-3 the table says the same, in the Status column under its pill', async () => {
    atWidth(1280);
    show();
    const table = await screen.findByRole('table', { name: 'New Hires' });
    const kemal = within(table).getByRole('link', { name: 'Kemal Pratama' }).closest('tr')!;
    expect(kemal).toHaveTextContent('Not yetDay 110 · no first sale within 90 days');
    expect(within(kemal).getByText('Day 110 · no first sale within 90 days')).toHaveClass('text-alert');
    expect(within(kemal).getByText('Day 110 · no first sale within 90 days')).not.toHaveClass('text-muted');
  });

  it('P19.11-T2 AC-4 a hire not activated yet wears their photo, or their initials on their tint, in the 28px circle; a ✓ keeps no photo', async () => {
    atWidth(375);
    const photo = 'https://cdn.test/fikri.jpg?sig=abc';
    const withPhoto: NewHiresRoster = {
      ...ROSTER,
      sections: {
        ...ROSTER.sections,
        inProgress: ROSTER.sections.inProgress.map((r) => (r.hire.name === 'Fikri Ramadhan' ? { ...r, hire: { ...r.hire, photoUrl: photo } } : r)),
        activated: ROSTER.sections.activated.map((r) => ({ ...r, hire: { ...r.hire, photoUrl: 'https://cdn.test/never.jpg' } })),
      },
    };
    show({ '/new-hires': { body: withPhoto } });
    const own = await group('Agus Prasetyo');
    const circle = (name: string) =>
      within(own).getByRole('link', { name }).closest('[data-person-row]')!.querySelector('[data-status]') as HTMLElement;

    // Fikri: his photo, in the circle's place and size; the status still named for a screen reader.
    const fikri = circle('Fikri Ramadhan');
    expect(fikri).toHaveAttribute('data-status', 'not_yet');
    expect(fikri).toHaveClass('h-7', 'w-7', 'rounded-full');
    expect(fikri.querySelector('img')).toHaveAttribute('src', photo);
    expect(fikri.querySelector('img')).toHaveStyle({ width: '28px', height: '28px' });
    expect(within(fikri).getByText('Not yet')).toHaveClass('sr-only');
    // Kemal, no photo: his initials on his tint, 28px.
    const kemal = circle('Kemal Pratama');
    const initials = kemal.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(initials).toHaveTextContent(/^KP$/);
    expect(initials).toHaveStyle({ width: '28px', height: '28px' });
    expect(kemal.querySelector('img')).toBeNull();
    // Dimas, activated, and Lukman, late: the ✓ and no photo, whatever the row carries.
    for (const [name, status] of [['Dimas Saputra', 'activated'], ['Lukman Hakim', 'activated_late']] as const) {
      const done = circle(name);
      expect([name, done.getAttribute('data-status'), done.querySelector('img'), !!done.querySelector('svg')]).toEqual([name, status, null, true]);
    }
  });

  // 2026-11-10: every group's row drew initials, its leader's photo or the reader's own notwithstanding.
  it('UI-111 a group’s row wears its leader’s photo — a unit leader’s from the read, Direct Unit’s the reader’s own — or initials', async () => {
    atWidth(375);
    const arief = 'https://cdn.test/arief.jpg?sig=abc';
    const mine = 'https://cdn.test/agus.jpg?sig=abc';
    const withLeader: NewHiresRoster = {
      ...ROSTER,
      units: ROSTER.units.map((u) => (u.leader?.name === 'Arief Hidayat' ? { ...u, leader: { ...u.leader, photoUrl: arief } } : u)),
    };
    show({ '/new-hires': { body: withLeader } }, { ...AGUS, user: { ...AGUS.user, avatarUrl: mine } });
    const head = async (name: string) => (await group(name)).querySelector('[data-person-row]') as HTMLElement;

    expect((await head('Agus Prasetyo')).querySelector('img')).toHaveAttribute('src', mine);
    expect((await head('Arief Hidayat')).querySelector('img')).toHaveAttribute('src', arief);
    // Sari has none: her initials, as before.
    const sari = await head('Sari Puspita');
    expect(sari.querySelector('img')).toBeNull();
    expect(sari.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^SP$/);
  });
});
