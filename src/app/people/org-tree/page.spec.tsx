import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '../../../../test/harness';
import OrgTreePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/org-tree',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 1,
  },
  permissions: ['org_tree:read'],
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
  renderWithSession(<OrgTreePage />, { me: OWNER });
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
    renderWithSession(<OrgTreePage />, { me: OWNER });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.');
  });

  it('never renders for a session without the permission', () => {
    renderWithSession(<OrgTreePage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('org_tree:read');
  });
});
