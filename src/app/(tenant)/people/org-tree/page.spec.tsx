import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { atWidth, digestAt, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import OrgTreePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/org-tree',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 1,
  },
  permissions: ['member:read_profile', 'org_tree:read'],
});

const node = (over: Record<string, unknown>) => ({
  fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000',
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0,
  isLeader: false, isSelf: false, ...over,
});

const OFFICE = {
  nodes: [
    node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab',
           layer: 1, isLeader: true, directCount: 1, isSelf: true }),
    node({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab',
           layer: 2, leaderId: 'mem-owner' }),
  ],
  leader: null,
  rootIds: ['mem-owner'],
  selfId: 'mem-owner',
  counts: { ab: 1, aab: 0, agent: 0, total: 1 },
};

const open = (tree: unknown = OFFICE) => {
  const stub = stubFetch({ '/members/tree': { body: tree } });
  renderInLayout(TenantLayout, <OrgTreePage />, { me: OWNER });
  return stub;
};

describe('org tree (P3-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2: draws the whole office from the one endpoint, with no scope to ask for', async () => {
    const { calls } = open();
    await screen.findByText('Layer 1');

    expect(calls.some((c) => c.url.includes('/members/tree'))).toBe(true);
    // The server decides the width from who is asking; the screen sends no scope.
    expect(calls.find((c) => c.url.includes('/members/tree'))!.url).not.toContain('scope');
    expect(document.querySelector('[data-node="mem-ab"]')).not.toBeNull();
  });

  it('drills through to the person, which is a route this reader has', async () => {
    open();
    await screen.findByText('Layer 1');
    const card = document.querySelector('[data-node="mem-ab"]') as HTMLElement;
    expect(within(card).getByRole('link', { name: 'Agus Prasetyo' }))
      .toHaveAttribute('href', '/people/members/mem-ab');
  });

  it('P18-T2 AC-7 drills a card of somebody who leads to their Unit Dashboard, in this tab (D-drill)', async () => {
    open({
      ...OFFICE,
      nodes: [
        ...OFFICE.nodes.map((n) => ((n as Record<string, unknown>).membershipId === 'mem-ab'
          ? { ...n, isLeader: true, directCount: 1, directCounts: { ab: 0, aab: 0, agent: 1, total: 1 } }
          : n)),
        node({ membershipId: 'mem-agent', fullName: 'Dimas Pratama', initials: 'DP', role: 'agent',
               layer: 3, leaderId: 'mem-ab' }),
      ],
      counts: { ab: 1, aab: 0, agent: 1, total: 2 },
    });
    await screen.findByText('Layer 1');

    const leader = within(document.querySelector('[data-node="mem-ab"]') as HTMLElement).getByRole('link', { name: 'Agus Prasetyo' });
    expect(leader).toHaveAttribute('href', '/unit/dashboard/mem-ab');
    // The same tab: the console's own drill, unlike the comparison's new tab.
    expect(leader).not.toHaveAttribute('target');
    // The reader's own card goes to their own, which the page of their own id would refuse.
    expect(within(document.querySelector('[data-node="mem-owner"]') as HTMLElement).getByRole('link', { name: 'Wilson Tanoto' }))
      .toHaveAttribute('href', '/unit/dashboard');
  });

  it('P18-T2 AC-7 keeps the person page for somebody who leads nobody, and the drill writes nothing', async () => {
    const { mock } = open({
      ...OFFICE,
      nodes: [
        ...OFFICE.nodes,
        node({ membershipId: 'mem-agent', fullName: 'Dimas Pratama', initials: 'DP', role: 'agent',
               layer: 2, leaderId: 'mem-owner' }),
      ],
    });
    await screen.findByText('Layer 1');
    expect(within(document.querySelector('[data-node="mem-agent"]') as HTMLElement).getByRole('link', { name: 'Dimas Pratama' }))
      .toHaveAttribute('href', '/people/members/mem-agent');
    const methods = mock.mock.calls.map(([, init]) => (init as RequestInit | undefined)?.method ?? 'GET');
    expect(methods.every((m) => m === 'GET')).toBe(true);
  });

  it('draws a forest, and says so, when somebody reports to nobody', async () => {
    // What P3-T7's orphan disposition leaves behind. Rooting at the Owner would hide them.
    open({
      ...OFFICE,
      nodes: [
        ...OFFICE.nodes,
        node({ membershipId: 'mem-orphan', fullName: 'Sari Puspita', initials: 'SP',
               role: 'aab', layer: 1 }),
      ],
      rootIds: ['mem-owner', 'mem-orphan'],
      counts: { ab: 1, aab: 1, agent: 0, total: 2 },
    });

    expect(await screen.findByText(/2 people report to nobody/)).toBeInTheDocument();
    expect(document.querySelector('[data-node="mem-orphan"]')).not.toBeNull();
  });

  it('says nothing about roots when there is only one', async () => {
    open();
    await screen.findByText('Layer 1');
    expect(screen.queryByText(/report to nobody/)).not.toBeInTheDocument();
  });

  it('has an empty state for an office nobody has joined', async () => {
    open({ nodes: [], leader: null, rootIds: [], selfId: null,
           counts: { ab: 0, aab: 0, agent: 0, total: 0 } });
    expect(await screen.findByText(/This office has no members yet/)).toBeInTheDocument();
  });

  it('shows a refusal rather than an empty canvas', async () => {
    stubFetch({
      '/members/tree': {
        status: 403,
        body: { error: { code: 'PERM_DENIED', message: 'Nope.', requestId: 'r-2' } },
      },
    });
    renderInLayout(TenantLayout, <OrgTreePage />, { me: OWNER });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });

  it('never renders for a session without the permission', () => {
    // Holding the office gate, so it is *this screen's* refusal being tested and not the
    // layout's — the two are different questions and the layer that answers first would
    // otherwise mask the one we mean.
    // An office reader, since anybody else is sent to their own landing first (2026-10-11).
    renderInLayout(TenantLayout, <OrgTreePage />, {
      me: makeMe({ ...OWNER, permissions: ['member:read_profile'] }),
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'org_tree:read');
  });
});

/**
 * **The office's tree on a phone** (P18.9-T7 AC-4, ADR-0178 §5; the client's KPM Owner review of 2026-10-27, UI-036:
 * only Wilson Tanoto, layer 1, in view, the connectors running off to the right). Below 768px the indented list that
 * opens and closes (`OrgTree asList`), as `/group-tree` has drawn since P18.7-T8; at 768px and wider the canvas it
 * was — the client's *Don't change* for a desktop.
 */
describe('P18.9-T7 AC-4 the office’s tree on a phone (UI-036)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Wilson leads Agus, who leads Sari, who leads Dimas; and Rina, placed under nobody. */
  const FOREST = {
    nodes: [
      node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab', layer: 1, isLeader: true,
        directCount: 1, directCounts: { ab: 1, aab: 0, agent: 0, total: 1 }, isSelf: true }),
      node({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab', layer: 2, leaderId: 'mem-owner',
        isLeader: true, directCount: 1, directCounts: { ab: 0, aab: 1, agent: 0, total: 1 } }),
      node({ membershipId: 'mem-sari', fullName: 'Sari Puspita', initials: 'SP', role: 'aab', layer: 3, leaderId: 'mem-ab',
        isLeader: true, directCount: 1, directCounts: { ab: 0, aab: 0, agent: 1, total: 1 } }),
      node({ membershipId: 'mem-dimas', fullName: 'Dimas Pratama', initials: 'DP', role: 'agent', layer: 4, leaderId: 'mem-sari' }),
      node({ membershipId: 'mem-rina', fullName: 'Rina Wijaya', initials: 'RW', role: 'agent', layer: 1 }),
    ],
    leader: null,
    rootIds: ['mem-owner', 'mem-rina'],
    selfId: 'mem-owner',
    counts: { ab: 1, aab: 1, agent: 2, total: 4 },
  };

  /*
   * **The canvas from 1024px, to the byte** (P18.9-T7 AC-4 kept it from 768px; P19.2-T3 AC-4 moves the tablet to the
   * list). *Re-recorded 2026-11-05 (P19.2-T3):* the digest is the tree's own markup (`OrgTree`'s root), no longer the
   * shell's `main`, which P19.2-T1 replaces (ADR-0197); taken from the canvas as P19.2-T3 leaves it, which changes only the
   * list (`OrgList`). It was the same at 768 and 1280, and the canvas carries no class that differs from 1024.
   */
  const CANVAS = 'd851451bc8a2397bccb70f687502c4c63643e1b29d1f58133ecc533a7814bb45';
  const treeRoot = () => screen.getByTestId('tree-canvas').parentElement!.parentElement!;

  it.each([1024, 1280] as const)('P19.2-T3 AC-4 at %ipx draws the canvas it drew, to the byte', async (px) => {
    atWidth(px);
    open(FOREST);
    await screen.findByText('Layer 1');
    expect(screen.getByTestId('tree-canvas')).toBeInTheDocument();
    expect(digestAt(treeRoot(), px)).toBe(CANVAS);
  });
  const line = (id: string) => document.querySelector<HTMLElement>(`[data-node="${id}"]`);
  const row = (id: string) => line(id)!.firstElementChild as HTMLElement;

  // *Changed 2026-11-05 (P19.2-T3 AC-4; UI-142):* a tablet draws the list too, below 1024px.
  it.each([375, 767, 768, 1023])('P18.9-T7 AC-4, P19.2-T3 AC-4 at %ipx draws the indented list, not the canvas, opened on the reader one level down', async (px) => {
    atWidth(px);
    open(FOREST);
    await screen.findByText('YOU');
    expect(screen.queryByTestId('tree-canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('Layer 1')).not.toBeInTheDocument();
    // Wilson, his direct report, and Rina, who reports to nobody; Agus's unit closed.
    expect(['mem-owner', 'mem-ab', 'mem-sari', 'mem-dimas', 'mem-rina'].map((id) => line(id) !== null))
      .toEqual([true, true, false, false, true]);
    expect([row('mem-owner').style.paddingLeft, row('mem-ab').style.paddingLeft]).toEqual(['0px', '16px']);
    // Each line a card's content: the initials, the name (its link), the rung's badge.
    expect(row('mem-ab')).toHaveTextContent(/^\+APAgus PrasetyoAB/);
    // The forest's sentence stays above it.
    expect(screen.getByText(/2 people report to nobody/)).toBeInTheDocument();
  });

  it('P18.9-T7 AC-4 opens a unit and closes it, each line linking as its card does', async () => {
    atWidth(375);
    open(FOREST);
    const show = await screen.findByRole('button', { name: 'Show who reports to Agus Prasetyo' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(wears(show, 375).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    await userEvent.click(show);
    expect(line('mem-sari')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show who reports to Sari Puspita' }));
    expect(row('mem-dimas').style.paddingLeft).toBe('48px');
    expect(within(row('mem-ab')).getByRole('link', { name: 'Agus Prasetyo' })).toHaveAttribute('href', '/unit/dashboard/mem-ab');
    expect(within(row('mem-dimas')).getByRole('link', { name: 'Dimas Pratama' })).toHaveAttribute('href', '/people/members/mem-dimas');
    await userEvent.click(screen.getByRole('button', { name: 'Hide who reports to Agus Prasetyo' }));
    expect(line('mem-sari')).toBeNull();
  });

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx every line is a 44px target: the whole line the person’s link, its + or − 44 × 44px', async (px) => {
    atWidth(px);
    open(FOREST);
    const show = await screen.findByRole('button', { name: 'Show who reports to Agus Prasetyo' });
    expect(wears(show, px).split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    // Above the line's stretched link, so a tap on it opens the unit and never the person.
    expect(show.className).toContain('z-[1]');
    for (const id of ['mem-owner', 'mem-ab', 'mem-rina']) {
      expect(wears(row(id), px).split(' ')).toEqual(expect.arrayContaining(['relative', 'min-h-11']));
      const link = within(row(id)).getByRole('link');
      // The name stretched over the line, as the shared person row does it: the line is the target.
      expect(link.className).toContain('after:inset-0');
    }
    // A line with no + keeps its column, so the names stand in one line.
    expect(wears(row('mem-rina').firstElementChild as HTMLElement, px).split(' ')).toContain('w-11');
  });

  it('P18.9-T7 AC-4 never draws the canvas first on a phone: the width is asked before the tree answers', async () => {
    atWidth(375);
    let drew = false;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches('[data-testid="tree-canvas"]') || node.querySelector('[data-testid="tree-canvas"]'))) drew = true;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    open(FOREST);
    await screen.findByText('YOU');
    observer.disconnect();
    expect(drew).toBe(false);
  });
});

/**
 * **P19.3-T4 AC-6 — the Org tree's search and *Buka semua*** (OWN UI-026, OWN case 8; ADR-0205): Group Tree's *Cari agen*
 * pill (D-05) finds by name or agent code, opens the path down to the person and highlights them, hiding nobody; *Open
 * all* opens every unit. On the canvas at 1280px and in the list at 375px.
 */
describe('P19.3-T4 AC-6 the Org tree’s search and Open all (OWN UI-026)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Wilson › Agus › Sari › Nina › Lukman Hakim, four units deep; and Dimas beside Agus. */
  const DEEP = {
    nodes: [
      node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab', layer: 1, isLeader: true,
        directCount: 2, directCounts: { ab: 1, aab: 0, agent: 1, total: 2 }, isSelf: true }),
      node({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab', layer: 2, leaderId: 'mem-owner',
        isLeader: true, directCount: 1, directCounts: { ab: 0, aab: 1, agent: 0, total: 1 } }),
      node({ membershipId: 'mem-sari', fullName: 'Sari Puspita', initials: 'SP', role: 'aab', layer: 3, leaderId: 'mem-ab',
        isLeader: true, directCount: 1, directCounts: { ab: 0, aab: 1, agent: 0, total: 1 } }),
      node({ membershipId: 'mem-nina', fullName: 'Nina Lestari', initials: 'NL', role: 'aab', layer: 4, leaderId: 'mem-sari',
        isLeader: true, directCount: 1, directCounts: { ab: 0, aab: 0, agent: 1, total: 1 } }),
      node({ membershipId: 'mem-lukman', fullName: 'Lukman Hakim', initials: 'LH', role: 'agent', layer: 5, leaderId: 'mem-nina',
        agentCode: '80117' }),
      node({ membershipId: 'mem-dimas', fullName: 'Dimas Pratama', initials: 'DP', role: 'agent', layer: 2, leaderId: 'mem-owner' }),
    ],
    leader: null,
    rootIds: ['mem-owner'],
    selfId: 'mem-owner',
    counts: { ab: 1, aab: 2, agent: 2, total: 5 },
  };
  const line = (id: string) => document.querySelector<HTMLElement>(`[data-node="${id}"]`);
  const searchBox = () => screen.getAllByRole('searchbox', { name: 'Find an agent' });

  it('P19.3-T4 AC-6 at 1280px: Lukman, four units down and closed, is found by name, the path opened and him highlighted', async () => {
    atWidth(1280);
    open(DEEP);
    await screen.findByText('Layer 1');
    // Units below layer 2 start closed: Lukman is not drawn.
    expect(line('mem-lukman')).toBeNull();
    // From 1024px the pill sits over the tree (the title row's is for below 1024px).
    const [pill] = searchBox().filter((box) => box.closest('[data-org-tree-tools]'));
    await userEvent.type(pill, 'Lukman');
    expect(line('mem-lukman')).not.toBeNull();
    expect(line('mem-lukman')).toHaveAttribute('data-match');
    expect(line('mem-lukman')!.className).toContain('ring-primary');
    // Nobody is hidden: Dimas, who does not match, is still drawn.
    expect(line('mem-dimas')).not.toBeNull();
    expect(line('mem-dimas')).not.toHaveAttribute('data-match');
    expect(screen.getByText('1 person matches your search, highlighted in the tree.')).toBeInTheDocument();
  });

  it('P19.3-T4 AC-6 at 375px: found by agent code in the list, the lines down to him opened, the line highlighted', async () => {
    atWidth(375);
    open(DEEP);
    await screen.findByText('YOU');
    expect(line('mem-lukman')).toBeNull();
    // Below 1024px the pill is on the title row (Group Tree's place, D-05).
    expect(searchBox().filter((box) => box.closest('[data-org-tree-tools]'))).toHaveLength(0);
    const [pill] = searchBox();
    await userEvent.type(pill, '80117');
    expect(line('mem-lukman')).toHaveAttribute('data-match');
    expect((line('mem-lukman')!.firstElementChild as HTMLElement).className).toContain('bg-primary/[0.16]');
    for (const id of ['mem-ab', 'mem-sari', 'mem-nina']) {
      expect(within(line(id)!).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true');
    }
    expect(within(line('mem-lukman')!).getByText('(matches your search)')).toHaveClass('sr-only');
  });

  it('P19.3-T4 AC-6 says so when nobody matches, and hides nobody', async () => {
    atWidth(1280);
    open(DEEP);
    await screen.findByText('Layer 1');
    const [pill] = searchBox().filter((box) => box.closest('[data-org-tree-tools]'));
    await userEvent.type(pill, 'zzz');
    expect(screen.getByText('Nobody in this office matches that search.')).toHaveAttribute('role', 'status');
    expect(line('mem-owner')).not.toBeNull();
  });

  it.each([375, 1280])('P19.3-T4 AC-6 at %ipx Open all opens every unit', async (px) => {
    atWidth(px);
    open(DEEP);
    await screen.findByText('YOU');
    expect(line('mem-lukman')).toBeNull();
    const button = screen.getByRole('button', { name: 'Open all' });
    if (px === 375) expect(button.className).toContain('max-lg:min-h-11');
    await userEvent.click(button);
    for (const id of ['mem-ab', 'mem-sari', 'mem-nina', 'mem-lukman', 'mem-dimas']) expect(line(id)).not.toBeNull();
    // A unit opened by it closes again on its own control.
    const hide = screen.getByRole('button', { name: 'Hide who reports to Nina Lestari' });
    await userEvent.click(hide);
    expect(line('mem-lukman')).toBeNull();
  });
});
