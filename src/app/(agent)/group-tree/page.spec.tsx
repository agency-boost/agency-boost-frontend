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

  describe('P15-T4 AC-3 a card opens the person (D-drill, `Overall.html:8408-8411`, `KPM_Owner.html:2228-2230`)', () => {
    const card = (id: string) => document.querySelector(`[data-node="${id}"]`) as HTMLElement;

    it('says so under the title, verbatim (`:10412`)', async () => {
      open();
      await screen.findByText('Layer 1');
      expect(
        screen.getByText('Your leader, you, and your full downline, laid out by layer. Click anyone to open their Unit Dashboard.'),
      ).toBeInTheDocument();
    });

    it('opens the Unit Dashboard of somebody who leads, through a real link named for them', async () => {
      open();
      await screen.findByText('Layer 1');
      const link = within(card('mem-sari')).getByRole('link', { name: 'Sari Puspita' });
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/unit/dashboard/mem-sari');
    });

    it('opens the Personal Summary of somebody who leads nobody, whatever the rung (OD-23)', async () => {
      // Dewi is an AAB with no reports: the graph, not the rung, decides she has no unit to open.
      open();
      await screen.findByText('Layer 1');
      expect(within(card('mem-dewi')).getByRole('link', { name: 'Dewi Lestari' }))
        .toHaveAttribute('href', '/coaching/mem-dewi/summary');
    });

    it('opens the Personal Summary of an agent inside a unit, once the unit is open', async () => {
      open();
      await userEvent.click(await screen.findByRole('button', { name: 'Show who reports to Sari Puspita' }));
      expect(within(card('mem-rina')).getByRole('link', { name: 'Rina Wijaya' }))
        .toHaveAttribute('href', '/coaching/mem-rina/summary');
    });

    it('leaves the reader’s own card and their leader inert', async () => {
      open();
      await screen.findByText('Layer 1');
      expect(within(card('mem-ab')).queryByRole('link')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Wilson Tanoto' })).not.toBeInTheDocument();
      // Nothing on the canvas links to either of them, by any name.
      const hrefs = Array.from(screen.getByTestId('tree-canvas').querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(hrefs.some((href) => href?.includes('mem-ab') || href?.includes('mem-owner'))).toBe(false);
    });

    it('keeps the toggle a button beside the link, so opening a unit never navigates', async () => {
      open();
      const toggle = await screen.findByRole('button', { name: 'Show who reports to Sari Puspita' });
      expect(toggle.closest('a')).toBeNull();
    });

    it('P15-T4 AC-3: a leader on the agent rung opens leaders’ units, but no Personal Summary (ADR-0087)', async () => {
      const AGENT_LEADER = makeMe({
        membership: {
          membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
          isKpmOwner: false, isKpmAdmin: false, directCount: 2,
        },
        permissions: ['org_tree:read'],
      });
      stubFetch({ '/members/tree': { body: TREE } });
      renderInLayout(AgentLayout, <GroupTreePage />, { me: AGENT_LEADER });
      await screen.findByText('Layer 1');
      expect(within(card('mem-sari')).getByRole('link', { name: 'Sari Puspita' }))
        .toHaveAttribute('href', '/unit/dashboard/mem-sari');
      // Their coaching reads are their own: a summary link would only say *not found*.
      expect(within(card('mem-dewi')).queryByRole('link')).toBeNull();
    });

    it('applies the same rule to an Owner or an Admin in their field view, their own leader inert as a node', async () => {
      // A tenant admin reads the whole office as one tree, so their own leader comes back as an
      // ordinary node rather than beside the tree; it is inert all the same.
      const ADMIN = makeMe({
        membership: {
          membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
          isKpmOwner: false, isKpmAdmin: true, directCount: 1,
        },
        permissions: ['org_tree:read'],
      });
      stubFetch({
        '/members/tree': {
          body: {
            nodes: [
              node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab',
                     layer: 1, isLeader: true, directCount: 2 }),
              node({ membershipId: 'mem-admin', fullName: 'Arief Nugroho', initials: 'AN', role: 'aab',
                     layer: 2, leaderId: 'mem-owner', isLeader: true, directCount: 1, isSelf: true }),
              node({ membershipId: 'mem-ab2', fullName: 'Budi Santoso', initials: 'BS', role: 'ab',
                     layer: 2, leaderId: 'mem-owner', isLeader: true, directCount: 1 }),
              node({ membershipId: 'mem-ag', fullName: 'Citra Ayu', initials: 'CA', layer: 2, leaderId: 'mem-owner' }),
              node({ membershipId: 'mem-own-ag', fullName: 'Dina Lestari', initials: 'DL', layer: 3, leaderId: 'mem-admin' }),
            ],
            leader: null,
            rootIds: ['mem-owner'],
            selfId: 'mem-admin',
            counts: { ab: 2, aab: 1, agent: 2, total: 5 },
          },
        },
      });
      renderInLayout(AgentLayout, <GroupTreePage />, { me: ADMIN });
      await screen.findByText('Layer 1');

      expect(within(card('mem-owner')).queryByRole('link')).toBeNull();
      expect(within(card('mem-admin')).queryByRole('link')).toBeNull();
      expect(within(card('mem-ab2')).getByRole('link', { name: 'Budi Santoso' }))
        .toHaveAttribute('href', '/unit/dashboard/mem-ab2');
      // Somebody outside the Admin's own downline is not somebody they coach: no Personal Summary to open.
      expect(within(card('mem-ag')).queryByRole('link')).toBeNull();
      const show = screen.queryByRole('button', { name: 'Show who reports to Arief Nugroho' });
      if (show) await userEvent.click(show);
      expect(within(card('mem-own-ag')).getByRole('link', { name: 'Dina Lestari' }))
        .toHaveAttribute('href', '/coaching/mem-own-ag/summary');
    });
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
