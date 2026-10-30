import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInIndonesian, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import GroupTreePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/group-tree',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['org_tree:read'],
});

const node = (over: Record<string, unknown>) => ({
  fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000',
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 },
  subtreeCount: 0, isLeader: false, isSelf: false, todayActivityCount: 0, photoUrl: null, ...over,
});

/**
 * Agus (AB, the reader) under Wilson; under Agus, in the server's order, Sari (AAB, leads Rina), Indah (agent), Dewi
 * (AAB, no team) — so *direct agents first* has something to reorder (UI-059).
 */
const TREE = {
  nodes: [
    node({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', agentCode: '80001', role: 'ab', layer: 1, isLeader: true,
           directCount: 3, isSelf: true, todayActivityCount: 5 }),
    node({ membershipId: 'mem-sari', fullName: 'Sari Puspita', agentCode: '80006', role: 'aab', layer: 2,
           leaderId: 'mem-ab', isLeader: true, directCount: 1, todayActivityCount: 2 }),
    node({ membershipId: 'mem-indah', fullName: 'Indah Permatasari', agentCode: '80101', layer: 2, leaderId: 'mem-ab',
           todayActivityCount: 3, photoUrl: 'https://cdn.test/indah.jpg' }),
    node({ membershipId: 'mem-dewi', fullName: 'Dewi Lestari', agentCode: '80007', role: 'aab', layer: 2,
           leaderId: 'mem-ab' }),
    node({ membershipId: 'mem-rina', fullName: 'Rina Wijaya', agentCode: '80201', layer: 3, leaderId: 'mem-sari',
           todayActivityCount: 4 }),
  ],
  leader: { membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab' },
  rootIds: ['mem-ab'],
  selfId: 'mem-ab',
  counts: { ab: 0, aab: 2, agent: 2, total: 4 },
};

const open = (tree: unknown = TREE, me = LEADER) => {
  const stub = stubFetch({ '/members/tree': { body: tree } });
  renderInLayout(AgentLayout, <GroupTreePage />, { me });
  return stub;
};

const list = () => screen.getByTestId('group-tree-list');
const table = () => screen.getByTestId('group-tree-table');
/** A person's row in one layout: the element `data-node` names, its first child the row itself. */
const rowIn = (layout: HTMLElement, id: string) => {
  const holder = layout.querySelector<HTMLElement>(`[data-node="${id}"]`);
  return holder ? (holder.querySelector<HTMLElement>('[data-person-row], [data-row]') as HTMLElement) : null;
};
const ready = () => screen.findByTestId('group-tree-list');

describe('group tree (UI V1, Phase 18.99 T9)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('UI-058 rows at every size, no canvas', () => {
    it('UI-058 draws no canvas, no LAYER labels and no LEADER ANDA eyebrow at any size', async () => {
      open();
      await ready();
      expect(screen.queryByTestId('tree-canvas')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Layer \d/)).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/LEADER ANDA|Layer 1|YOU\b/);
    });

    it('UI-058 below 1024px is the list and from 1024px the table, each its own variant', async () => {
      open();
      await ready();
      expect(list().parentElement!.className + list().className).toContain('lg:hidden');
      expect(table().className).toContain('max-lg:hidden');
    });

    it('UI-058 the desktop table opens every unit at once, so every person is in one list', async () => {
      open();
      await ready();
      for (const id of ['mem-ab', 'mem-sari', 'mem-indah', 'mem-dewi', 'mem-rina']) expect(rowIn(table(), id)).not.toBeNull();
      // Its columns, in the report's order.
      expect(within(table()).getByText('Name').parentElement).toHaveTextContent(/^NameRoleDirect reportsToday$/);
      // Each row one 52px line, indented 34px a level with a 2px line.
      const rina = rowIn(table(), 'mem-rina')!;
      expect(rina.className).toContain('h-[52px]');
      expect(rina.querySelectorAll('.w-\\[34px\\].border-l-2')).toHaveLength(2);
    });
  });

  describe('UI-059 the person rows', () => {
    it('UI-059 the reader’s row is navy with You, an AAB tinted, an agent white, and the upline muted', async () => {
      open();
      await ready();
      expect(rowIn(list(), 'mem-ab')).toHaveAttribute('data-tone', 'self');
      expect(within(rowIn(list(), 'mem-ab')!).getByText('You')).toHaveAttribute('data-tone', 'blue');
      expect(rowIn(list(), 'mem-sari')).toHaveAttribute('data-tone', 'tinted');
      expect(rowIn(list(), 'mem-dewi')).toHaveAttribute('data-tone', 'tinted');
      expect(rowIn(list(), 'mem-indah')).toHaveAttribute('data-tone', 'default');
      const upline = list().querySelector<HTMLElement>('[data-upline] [data-person-row]')!;
      expect(upline).toHaveAttribute('data-tone', 'muted');
      expect(upline).toHaveTextContent('Wilson Tanoto');
      expect(upline).toHaveTextContent('AB · Your leader');
    });

    it('UI-059 puts the direct agents above the AAB units under each leader', async () => {
      open();
      await ready();
      const under = [...list().querySelectorAll('[aria-label="Agus Prasetyo’s team"] > li > [data-node]')]
        .map((el) => el.getAttribute('data-node'));
      expect(under).toEqual(['mem-indah', 'mem-sari', 'mem-dewi']);
    });

    it('UI-059 every row but the upline carries today’s pill, matching the server’s count', async () => {
      open();
      await ready();
      expect(rowIn(list(), 'mem-ab')).toHaveTextContent('5 activities');
      expect(rowIn(list(), 'mem-indah')).toHaveTextContent('Agent3 activities');
      expect(rowIn(list(), 'mem-sari')).toHaveTextContent('AAB2 activities');
      expect(rowIn(list(), 'mem-dewi')).toHaveTextContent('AABNot reported');
      expect(list().querySelector('[data-upline]')!.querySelector('[data-logged]')).toBeNull();
      // The desktop's *Hari ini* column says the same.
      expect(rowIn(table(), 'mem-rina')).toHaveTextContent('4 activities');
    });

    it('UI-059 names in capitals on one line, and a photo where there is one', async () => {
      open();
      await ready();
      const name = within(rowIn(list(), 'mem-indah')!).getByRole('link', { name: 'Indah Permatasari' });
      expect(name.className).toContain('uppercase');
      expect(name.className).toContain('truncate');
      expect(rowIn(list(), 'mem-indah')!.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/indah.jpg');
    });

    it('UI-059 Cari agen finds a person a closed unit holds, by name or agent code, and opens the unit', async () => {
      open();
      await ready();
      // Rina is in Sari's unit, closed on load below 1024px.
      expect(rowIn(list(), 'mem-rina')).toBeNull();
      const [search] = screen.getAllByRole('searchbox', { name: 'Find an agent' });
      await userEvent.type(search, 'rina');
      expect(rowIn(list(), 'mem-rina')).not.toBeNull();
      // The way to her stays; nobody else does.
      expect(rowIn(list(), 'mem-sari')).not.toBeNull();
      expect(rowIn(list(), 'mem-indah')).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Hide Sari Puspita’s team' })[0]).toHaveAttribute('aria-expanded', 'true');

      await userEvent.clear(search);
      await userEvent.type(search, '80101');
      expect(rowIn(list(), 'mem-indah')).not.toBeNull();
      expect(rowIn(list(), 'mem-rina')).toBeNull();

      await userEvent.clear(search);
      await userEvent.type(search, 'zzz');
      expect(screen.getByText('No agent in your tree matches that search.')).toBeInTheDocument();
    });
  });

  describe('UI-072 the whole row opens the person', () => {
    it('UI-072 each row is one link over the row, to the right page (O-6)', async () => {
      open();
      await ready();
      const link = (id: string) => within(rowIn(list(), id)!).getByRole('link');
      // The reader: their own Unit Dashboard.
      expect(link('mem-ab')).toHaveAttribute('href', '/unit/dashboard');
      // An AAB with a team: theirs; an AAB with none and an agent: the Personal Summary.
      expect(link('mem-sari')).toHaveAttribute('href', '/unit/dashboard/mem-sari');
      expect(link('mem-dewi')).toHaveAttribute('href', '/coaching/mem-dewi/summary');
      expect(link('mem-indah')).toHaveAttribute('href', '/coaching/mem-indah/summary');
      // Stretched over the row, so a tap anywhere on it opens.
      expect(link('mem-sari').className).toContain('after:inset-0');
      // The upline is not a link, in either layout.
      expect(screen.queryByRole('link', { name: 'Wilson Tanoto' })).not.toBeInTheDocument();
      expect(within(rowIn(table(), 'mem-sari')!).getByRole('link', { name: 'Sari Puspita' })).toHaveAttribute('href', '/unit/dashboard/mem-sari');
    });

    it('UI-072 the ⌄ is its own button, never inside the link, and the page has no › anywhere', async () => {
      open();
      await ready();
      const toggle = within(rowIn(list(), 'mem-sari')!).getByRole('button', { name: 'Show Sari Puspita’s team' });
      expect(toggle.closest('a')).toBeNull();
      await userEvent.click(toggle);
      expect(rowIn(list(), 'mem-rina')).not.toBeNull();
      // No › on a row, in either layout (the shell's own chrome is not the page's).
      for (const layout of [list(), table()]) expect(layout.querySelector('path[d="m9 6 6 6-6 6"]')).toBeNull();
      expect(document.body.textContent).not.toContain('›');
    });

    it('UI-072 the keyboard reaches each row and each ⌄; the row shows the focus ring', async () => {
      open();
      await ready();
      const sari = rowIn(list(), 'mem-sari')!;
      const link = within(sari).getByRole('link', { name: 'Sari Puspita' });
      link.focus();
      expect(link).toHaveFocus();
      await userEvent.tab();
      expect(within(sari).getByRole('button', { name: 'Show Sari Puspita’s team' })).toHaveFocus();
      expect(sari.className).toContain('has-[[data-row-main]:focus-visible]:outline-amber');
    });

    it('UI-072 an Admin’s field view: their own leader a node and inert, nobody outside their downline coached', async () => {
      const ADMIN = makeMe({
        membership: {
          membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
          isKpmOwner: false, isKpmAdmin: true, directCount: 1,
        },
        permissions: ['org_tree:read'],
      });
      open({
        nodes: [
          node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', role: 'ab', layer: 1, isLeader: true, directCount: 3 }),
          node({ membershipId: 'mem-admin', fullName: 'Arief Nugroho', role: 'aab', layer: 2, leaderId: 'mem-owner',
                 isLeader: true, directCount: 1, isSelf: true }),
          node({ membershipId: 'mem-ab2', fullName: 'Budi Santoso', role: 'ab', layer: 2, leaderId: 'mem-owner',
                 isLeader: true, directCount: 1 }),
          node({ membershipId: 'mem-ag', fullName: 'Citra Ayu', layer: 2, leaderId: 'mem-owner' }),
          node({ membershipId: 'mem-b-ag', fullName: 'Eka Putri', layer: 3, leaderId: 'mem-ab2' }),
          node({ membershipId: 'mem-own-ag', fullName: 'Dina Lestari', layer: 3, leaderId: 'mem-admin' }),
        ],
        leader: null,
        rootIds: ['mem-owner'],
        selfId: 'mem-admin',
        counts: { ab: 2, aab: 1, agent: 3, total: 6 },
      }, ADMIN);
      await ready();
      const t = table();
      expect(within(rowIn(t, 'mem-owner')!).queryByRole('link')).toBeNull();
      expect(within(rowIn(t, 'mem-admin')!).getByRole('link')).toHaveAttribute('href', '/unit/dashboard');
      expect(within(rowIn(t, 'mem-ab2')!).getByRole('link')).toHaveAttribute('href', '/unit/dashboard/mem-ab2');
      expect(within(rowIn(t, 'mem-ag')!).queryByRole('link')).toBeNull();
      expect(within(rowIn(t, 'mem-own-ag')!).getByRole('link')).toHaveAttribute('href', '/coaching/mem-own-ag/summary');
      // Below 1024px the list opens down to the reader, so the Admin is in view at once.
      expect(rowIn(list(), 'mem-admin')).not.toBeNull();
      expect(rowIn(list(), 'mem-b-ag')).toBeNull();
    });

    it('UI-072 a leader on the agent rung opens leaders’ units, but no Personal Summary (ADR-0087)', async () => {
      const AGENT_LEADER = makeMe({
        membership: {
          membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
          isKpmOwner: false, isKpmAdmin: false, directCount: 3,
        },
        permissions: ['org_tree:read'],
      });
      open(TREE, AGENT_LEADER);
      await ready();
      expect(within(rowIn(list(), 'mem-sari')!).getByRole('link')).toHaveAttribute('href', '/unit/dashboard/mem-sari');
      expect(within(rowIn(list(), 'mem-dewi')!).queryByRole('link')).toBeNull();
    });
  });

  describe('UI-073 the ⌄ and the indent', () => {
    it('UI-073 only a row with a team has a ⌄; the reader’s unit open and the units below closed', async () => {
      open();
      await ready();
      expect(within(rowIn(list(), 'mem-ab')!).getByRole('button', { name: 'Hide Agus Prasetyo’s team' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(rowIn(list(), 'mem-sari')!).getByRole('button', { name: 'Show Sari Puspita’s team' })).toHaveAttribute('aria-expanded', 'false');
      expect(within(rowIn(list(), 'mem-dewi')!).queryByRole('button')).toBeNull();
      expect(within(rowIn(list(), 'mem-indah')!).queryByRole('button')).toBeNull();
      // The team is a list the ⌄ names, indented 36px a level with the shared line.
      const toggle = within(rowIn(list(), 'mem-ab')!).getByRole('button', { name: 'Hide Agus Prasetyo’s team' });
      const team = document.getElementById(toggle.getAttribute('aria-controls')!)!;
      expect(team).toHaveAttribute('aria-label', 'Agus Prasetyo’s team');
      expect(team.className).toContain('ml-[17px]');
      expect(team.className).toContain('pl-[19px]');
    });

    it('UI-073 the ⌄ opens and closes a team without opening the person, from the keyboard too', async () => {
      open();
      await ready();
      const show = within(rowIn(list(), 'mem-sari')!).getByRole('button', { name: 'Show Sari Puspita’s team' });
      show.focus();
      await userEvent.keyboard('{Enter}');
      expect(rowIn(list(), 'mem-rina')).not.toBeNull();
      const hide = within(rowIn(list(), 'mem-sari')!).getByRole('button', { name: 'Hide Sari Puspita’s team' });
      expect(hide).toHaveFocus();
      await userEvent.keyboard(' ');
      expect(rowIn(list(), 'mem-rina')).toBeNull();
    });
  });

  describe('UI-074 the summary, with no legend', () => {
    it('UI-074 lists the non-zero rungs only, totals adding up, and no legend, dot or ⓘ', async () => {
      open();
      await ready();
      expect(screen.getAllByText('4 below you · 2 AAB · 2 Agent')).not.toHaveLength(0);
      expect(document.body.textContent).not.toContain('0 AB');
      expect(screen.queryByRole('button', { name: 'What is AAB?' })).not.toBeInTheDocument();
      expect(document.querySelector('.bg-role-ab, .bg-role-aab, .bg-role-agent')).toBeNull();
    });
  });

  describe('UI-075 nothing cut short, nothing small', () => {
    it('UI-075 You never truncates; the ⌄ is 44px on a phone, 48 on a tablet, 32 on a desktop', async () => {
      open();
      await ready();
      const you = within(rowIn(table(), 'mem-ab')!).getByText('You');
      expect(you.className).toContain('shrink-0');
      const toggle = within(rowIn(table(), 'mem-ab')!).getByRole('button', { name: 'Hide Agus Prasetyo’s team' });
      expect(toggle.className).toMatch(/h-11 w-11.*md:max-lg:h-12 md:max-lg:w-12 lg:h-8 lg:w-8/);
      // No class below 12px on the page's own rows.
      expect(document.querySelector('[data-testid^="group-tree"] .text-\\[10px\\], [data-testid^="group-tree"] .text-\\[11px\\]')).toBeNull();
    });
  });

  it('UI-087 (the shell’s rule here too) keeps the sub-line from 1024px only (O-9)', async () => {
    open();
    await ready();
    const line = screen.getByText('Your leader, you, and your full downline, laid out by layer. Tap anyone to open their Unit Dashboard.');
    expect(line.className).toContain('max-md:hidden');
    expect(line.className).toContain('md:max-lg:hidden');
  });

  it('tells a leader with nobody under them, rather than drawing a tree of one', async () => {
    open({
      nodes: [node({ membershipId: 'mem-ab', fullName: 'Agus', layer: 1, isSelf: true })],
      leader: null, rootIds: ['mem-ab'], selfId: 'mem-ab',
      counts: { ab: 0, aab: 0, agent: 0, total: 0 },
    });
    expect(await screen.findByText(/Nobody reports to you yet/)).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows the server refusal rather than an empty tree', async () => {
    stubFetch({
      '/members/tree': {
        status: 413,
        body: { error: { code: 'ORG_TREE_TOO_LARGE', message: 'This office has 2400 members, more than the tree can draw.', requestId: 'r-1' } },
      },
    });
    renderInLayout(AgentLayout, <GroupTreePage />, { me: LEADER });
    expect(await screen.findByRole('alert')).toHaveTextContent('more than the tree can draw');
  });

  it('never renders for a session without the permission', () => {
    renderInLayout(AgentLayout, <GroupTreePage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'org_tree:read');
  });

  it('UI-059 in Indonesian: Cari agen, Anda, Belum lapor, n aktivitas, di bawah Anda, Leader Anda', async () => {
    stubFetch({ '/members/tree': { body: TREE } });
    renderInIndonesian(<GroupTreePage />, { me: LEADER });
    await ready();
    expect(screen.getAllByRole('searchbox', { name: 'Cari agen' })).not.toHaveLength(0);
    expect(within(rowIn(list(), 'mem-ab')!).getByText('Anda')).toBeInTheDocument();
    expect(rowIn(list(), 'mem-dewi')).toHaveTextContent('Belum lapor');
    expect(rowIn(list(), 'mem-indah')).toHaveTextContent('3 aktivitas');
    expect(screen.getAllByText('4 di bawah Anda · 2 AAB · 2 Agent')).not.toHaveLength(0);
    expect(list().querySelector('[data-upline]')).toHaveTextContent('AB · Leader Anda');
    expect(within(table()).getByText('Nama').parentElement).toHaveTextContent(/^NamaPeranLangsungHari ini$/);
  });

  it('UI-058, UI-059 the rows, a unit opened and a search typed, pass axe (WCAG 2.1 AA)', async () => {
    stubFetch({ '/members/tree': { body: TREE } });
    renderWithSession(<GroupTreePage />, { me: LEADER });
    await ready();
    await userEvent.click(within(rowIn(list(), 'mem-sari')!).getByRole('button', { name: 'Show Sari Puspita’s team' }));
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect((results.violations ?? []).map((v) => v.id)).toEqual([]);
  });
});
