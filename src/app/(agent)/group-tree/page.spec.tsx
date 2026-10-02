import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import GroupTreePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/group-tree',
}));

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 2,
  },
  permissions: ['org_tree:read'],
});

const node = (over: Record<string, unknown>) => ({
  fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000',
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 }, subtreeCount: 0,
  isLeader: false, isSelf: false, ...over,
});

const TREE = {
  nodes: [
    node({ membershipId: 'mem-ab', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab',
           layer: 1, isLeader: true, directCount: 2, isSelf: true }),
    node({ membershipId: 'mem-sari', fullName: 'Sari Puspita', initials: 'SP', role: 'aab',
           layer: 2, leaderId: 'mem-ab', isLeader: true, directCount: 1 }),
    node({ membershipId: 'mem-dewi', fullName: 'Dewi Lestari', initials: 'DL', role: 'aab',
           layer: 2, leaderId: 'mem-ab' }),
    node({ membershipId: 'mem-rina', fullName: 'Rina Wijaya', initials: 'RW',
           layer: 3, leaderId: 'mem-sari' }),
  ],
  leader: { membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab' },
  rootIds: ['mem-ab'],
  selfId: 'mem-ab',
  counts: { ab: 0, aab: 2, agent: 1, total: 3 },
};

const open = (tree: unknown = TREE) => {
  const stub = stubFetch({ '/members/tree': { body: tree } });
  renderInLayout(AgentLayout, <GroupTreePage />, { me: LEADER });
  return stub;
};

describe('group tree (P3-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: labels a column by the layer the server sent, not by its position', async () => {
    open();
    expect(await screen.findByText('Layer 1')).toBeInTheDocument();
    expect(screen.getByText('Layer 2')).toBeInTheDocument();
  });

  it('AC-1: draws your leader above, and never as a node in a layer', async () => {
    open();
    expect(await screen.findByText('Your leader')).toBeInTheDocument();
    expect(screen.getByText('Wilson Tanoto')).toBeInTheDocument();
    // The leader has no card in the tree itself.
    expect(document.querySelector('[data-node="mem-owner"]')).toBeNull();
  });

  it('joins cards edge-to-edge at their vertical centre, not at their top', async () => {
    // The bug this pins: `layoutTree` already starts y at LABEL_HEIGHT, and the card
    // added it a second time — so every card sat 28px below its own connector and the
    // line met it at the top-left corner. One coordinate frame, applied once.
    open();
    await screen.findByText('Layer 1');

    const card = document.querySelector('[data-node="mem-sari"]') as HTMLElement;
    const top = Number.parseFloat(card.style.top);
    const height = Number.parseFloat(card.style.height);
    const centre = top + height / 2;

    // Every path ends at some card's centre; one of them must end at this card's.
    const ends = Array.from(document.querySelectorAll('path')).map((path) => {
      const d = path.getAttribute('d')!;
      return Number.parseFloat(d.slice(d.lastIndexOf(' ', d.length - 1) + 1));
    });
    expect(ends).toContain(centre);
  });

  it('marks which card is you', async () => {
    open();
    const self = await screen.findByText('YOU');
    expect(self.closest('[data-node]')).toHaveAttribute('data-node', 'mem-ab');
  });

  it('AC-4: the legend names all three roles in words, never colour alone', async () => {
    open();
    await screen.findByText('Layer 1');
    // The prototype's legend, verbatim — and it abbreviates the middle one.
    expect(screen.getByText('Agency Builder')).toBeInTheDocument();
    expect(screen.getByText('Associate AB')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('AC-4: a node badge carries its text, and the avatar carries the colour', async () => {
    open();
    await screen.findByText('Layer 1');
    const card = document.querySelector('[data-node="mem-sari"]') as HTMLElement;

    // Text on the badge…
    expect(within(card).getByTitle('Associate Agency Builder')).toHaveTextContent('AAB');
    // …and the role colour on the avatar beside it, which is where the prototype puts it.
    expect(within(card).getByText('SP')).toHaveClass('bg-role-aab');
  });

  it('says how many are below, excluding you, as the prototype counts it', async () => {
    open();
    expect(await screen.findByText(/3 below you · 0 AB · 2 AAB · 1 Agent/)).toBeInTheDocument();
  });

  it('AC-3: a unit below layer 2 starts closed, and opens when asked', async () => {
    open();
    await screen.findByText('Layer 1');

    // Sari leads somebody and sits on layer 2, so her unit is closed at first paint.
    expect(document.querySelector('[data-node="mem-rina"]')).toBeNull();
    expect(screen.getByText(/1 person is inside a closed unit/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show who reports to Sari Puspita' }));
    expect(document.querySelector('[data-node="mem-rina"]')).not.toBeNull();
  });

  it('gives the toggle a name and a state a screen reader can use', async () => {
    open();
    const toggle = await screen.findByRole('button', { name: 'Show who reports to Sari Puspita' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide who reports to Sari Puspita' }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  it('offers no toggle for somebody who leads nobody, whatever their role', async () => {
    // OD-23: a childless AAB is not a leader, and a control that expands nothing is a lie.
    open();
    await screen.findByText('Layer 1');
    expect(screen.queryByRole('button', { name: /Dewi Lestari/ })).not.toBeInTheDocument();
  });

  it('does not link a card anywhere — the person page is not this reader\'s route', async () => {
    open();
    await screen.findByText('Layer 1');
    const card = document.querySelector('[data-node="mem-sari"]')!;
    expect(within(card as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('tells a leader with nobody under them, rather than drawing a tree of one', async () => {
    open({
      nodes: [node({ membershipId: 'mem-ab', fullName: 'Agus', layer: 1, isSelf: true })],
      leader: null, rootIds: ['mem-ab'], selfId: 'mem-ab',
      counts: { ab: 0, aab: 0, agent: 0, total: 0 },
    });
    expect(await screen.findByText(/Nobody reports to you yet/)).toBeInTheDocument();
  });

  it('shows the server refusal rather than an empty canvas', async () => {
    stubFetch({
      '/members/tree': {
        status: 413,
        body: {
          error: {
            code: 'ORG_TREE_TOO_LARGE',
            message: 'This office has 2400 members, more than the tree can draw.',
            requestId: 'r-1',
          },
        },
      },
    });
    renderInLayout(AgentLayout, <GroupTreePage />, { me: LEADER });
    expect(await screen.findByRole('alert')).toHaveTextContent('more than the tree can draw');
  });

  it('never renders for a session without the permission', () => {
    renderInLayout(AgentLayout, <GroupTreePage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'org_tree:read');
  });
});
