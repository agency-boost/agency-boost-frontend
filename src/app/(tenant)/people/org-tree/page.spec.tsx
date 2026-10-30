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
 * **The office's tree on a phone** (P18.97-T7 AC-4, ADR-0178 §5; the client's KPM Owner review of 2026-10-27, UI-036:
 * only Wilson Tanoto, layer 1, in view, the connectors running off to the right). Below 768px the indented list that
 * opens and closes (`OrgTree asList`), as `/group-tree` has drawn since P18.95-T8; at 768px and wider the canvas it
 * was — the client's *Don't change* for a desktop.
 */
describe('P18.97-T7 AC-4 the office’s tree on a phone (UI-036)', () => {
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

  /** The page's markup on the build before P18.97-T7, rendered from this fixture on 2026-10-28. */
  const BEFORE_T7: Record<768 | 1280, string> = {
    // Re-recorded 2026-10-30 (UI V1): UI-008's card edge (`border-card-edge`) and UI-010's 44px/48px targets below 1024px.
    768: '27a100e172092353f88f741b5359f30575e17de6c4deb374e814977db9528d2f',
    1280: '27a100e172092353f88f741b5359f30575e17de6c4deb374e814977db9528d2f',
  };

  it.each([768, 1280] as const)('P18.97-T7 AC-4 at %ipx draws the canvas it drew, to the byte', async (px) => {
    atWidth(px);
    open(FOREST);
    await screen.findByText('Layer 1');
    expect(screen.getByTestId('tree-canvas')).toBeInTheDocument();
    expect(digestAt(screen.getByRole('main'), px)).toBe(BEFORE_T7[px]);
  });
  const line = (id: string) => document.querySelector<HTMLElement>(`[data-node="${id}"]`);
  const row = (id: string) => line(id)!.firstElementChild as HTMLElement;

  it.each([375, 767])('P18.97-T7 AC-4 at %ipx draws the indented list, not the canvas, opened on the reader one level down', async (px) => {
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

  it('P18.97-T7 AC-4 opens a unit and closes it, each line linking as its card does', async () => {
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

  it('P18.97-T7 AC-4 never draws the canvas first on a phone: the width is asked before the tree answers', async () => {
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
