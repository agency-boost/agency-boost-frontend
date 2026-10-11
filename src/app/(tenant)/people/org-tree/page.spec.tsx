import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
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
