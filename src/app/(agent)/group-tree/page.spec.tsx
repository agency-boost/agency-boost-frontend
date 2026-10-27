import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import { PHONE_QUERY } from '@/lib/use-phone';
import { makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
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

  it('AC-4, P18.95-T8 AC-3: the legend names all three rungs in words, as their badges do — AB, AAB, Agent — never Associate AB', async () => {
    open();
    await screen.findByText('Layer 1');
    // One name per rung (ADR-0167 §10; UI-025, UI-027): the ladder's short names, the badges' own.
    const legend = screen.getByRole('button', { name: 'What is AAB?' }).closest('ul')!;
    // The AAB item carries its ⓘ, once on the screen (P18.95-T9 AC-3): its name and bubble follow the word.
    expect([...legend.querySelectorAll('li')].map((li) => li.textContent!.replace(/ⓘ.*$/, ''))).toEqual(['AB', 'AAB', 'Agent']);
    expect(screen.queryByText(/Associate AB/)).not.toBeInTheDocument();
    const sari = document.querySelector('[data-node="mem-sari"]') as HTMLElement;
    expect(within(sari).getByTitle('AAB')).toHaveTextContent('AAB');
  });

  it('P18.95-T9 AC-3 says what AAB means once, in the legend, in the glossary’s one line', async () => {
    open();
    await screen.findByText('Layer 1');
    const tips = screen.getAllByRole('button', { name: 'What is AAB?' });
    expect(tips).toHaveLength(1);
    expect(tips[0]).toHaveAccessibleDescription('Associate Agency Builder: a leader under an AB, with agents of their own.');
  });

  it('AC-4: a node badge carries its text, and the avatar carries the colour', async () => {
    open();
    await screen.findByText('Layer 1');
    const card = document.querySelector('[data-node="mem-sari"]') as HTMLElement;

    // Text on the badge…
    expect(within(card).getByTitle('AAB')).toHaveTextContent('AAB');
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

    it('says so under the title (`:10412`), titled as its nav item and saying Tap (P18.95-T9 AC-2, AC-5)', async () => {
      open();
      await screen.findByText('Layer 1');
      // The nav item's words, where the prototype titled it *Group Overview*.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Group Tree$/);
      expect(
        screen.getByText('Your leader, you, and your full downline, laid out by layer. Tap anyone to open their Unit Dashboard.'),
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

  /*
   * P18.95-T8 AC-3 (the client's UI review of 2026-10-26, UI-025; ADR-0167): below 768px the tree grew
   * right, 516px wide in a 285px box, and showed only the reader. A phone gets an indented list that opens
   * and closes; 768px and wider keep the canvas. The phone is `matchMedia` answering `usePhone`'s query.
   */
  describe('P18.95-T8 AC-3 the tree on a phone (UI-025)', () => {
    const onPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query,
      matches: query === PHONE_QUERY,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })));
    const onAPhone = (tree: unknown = TREE, me = LEADER) => {
      onPhone();
      stubFetch({ '/members/tree': { body: tree } });
      return renderWithSession(<GroupTreePage />, { me });
    };
    const line = (id: string) => document.querySelector<HTMLElement>(`[data-node="${id}"]`);
    const row = (id: string) => line(id)!.firstElementChild as HTMLElement;

    it('P18.95-T8 AC-3 draws an indented list, not the canvas, opened on the reader one level down', async () => {
      onAPhone();
      await screen.findByText('YOU');
      expect(screen.queryByTestId('tree-canvas')).not.toBeInTheDocument();
      expect(screen.queryByText('Layer 1')).not.toBeInTheDocument();
      // The reader and their direct reports; the unit below them closed.
      expect(['mem-ab', 'mem-sari', 'mem-dewi', 'mem-rina'].map((id) => line(id) !== null)).toEqual([true, true, true, false]);
      // Indented a level at a time, each team a list inside its leader's line.
      expect([row('mem-ab').style.paddingLeft, row('mem-sari').style.paddingLeft]).toEqual(['0px', '16px']);
      expect(line('mem-sari')!.parentElement!.closest('li')).toBe(line('mem-ab'));
      // Each line: the name, the rung, and a leader's unit.
      expect(row('mem-sari')).toHaveTextContent('Sari PuspitaAAB');
      expect(within(row('mem-ab')).getByTitle('AB')).toHaveTextContent('AB');
      expect(row('mem-ab')).toHaveTextContent('Agus PrasetyoYOUAB');
      expect(screen.getByRole('button', { name: 'Hide who reports to Agus Prasetyo' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'Show who reports to Sari Puspita' })).toHaveAttribute('aria-expanded', 'false');
      // The canvas's sentence about closed units is the canvas's: the list's + says it.
      expect(screen.queryByText(/inside a closed unit/)).not.toBeInTheDocument();
      // The legend and the count stay above it.
      expect(screen.getByText(/3 below you · 0 AB · 2 AAB · 1 Agent/)).toBeInTheDocument();
    });

    it('P18.95-T8 AC-3 opens and closes a unit from the keyboard, its control a 44px button that keeps the focus', async () => {
      onAPhone();
      const show = await screen.findByRole('button', { name: 'Show who reports to Sari Puspita' });
      expect(show.className).toContain('max-md:min-h-11');
      expect(show.closest('a')).toBeNull();
      show.focus();
      await userEvent.keyboard('{Enter}');
      expect(line('mem-rina')).not.toBeNull();
      expect(row('mem-rina').style.paddingLeft).toBe('32px');
      const hide = screen.getByRole('button', { name: 'Hide who reports to Sari Puspita' });
      expect(hide).toHaveAttribute('aria-expanded', 'true');
      expect(hide).toHaveFocus();
      await userEvent.keyboard(' ');
      expect(line('mem-rina')).toBeNull();
      // Closing the reader's own line folds everybody under it.
      await userEvent.click(screen.getByRole('button', { name: 'Hide who reports to Agus Prasetyo' }));
      expect(line('mem-sari')).toBeNull();
      // Somebody who leads nobody has no control.
      await userEvent.click(screen.getByRole('button', { name: 'Show who reports to Agus Prasetyo' }));
      expect(within(row('mem-dewi')).queryByRole('button')).toBeNull();
    });

    it('P18.95-T8 AC-3 links each line as its card links, the reader and their leader inert', async () => {
      onAPhone();
      await screen.findByText('YOU');
      expect(within(row('mem-sari')).getByRole('link', { name: 'Sari Puspita' })).toHaveAttribute('href', '/unit/dashboard/mem-sari');
      expect(within(row('mem-dewi')).getByRole('link', { name: 'Dewi Lestari' })).toHaveAttribute('href', '/coaching/mem-dewi/summary');
      expect(within(row('mem-ab')).queryByRole('link')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Wilson Tanoto' })).not.toBeInTheDocument();
    });

    it('P18.95-T8 AC-3 opens an office-wide tree down to the reader, so an Admin is in view at once', async () => {
      const ADMIN = makeMe({
        membership: {
          membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AAB', hierarchyRole: 'aab', status: 'active',
          isKpmOwner: false, isKpmAdmin: true, directCount: 1,
        },
        permissions: ['org_tree:read'],
      });
      onAPhone({
        nodes: [
          node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', initials: 'WT', role: 'ab', layer: 1, isLeader: true, directCount: 2 }),
          node({ membershipId: 'mem-admin', fullName: 'Arief Nugroho', initials: 'AN', role: 'aab', layer: 2, leaderId: 'mem-owner', isLeader: true, directCount: 1, isSelf: true }),
          node({ membershipId: 'mem-ab2', fullName: 'Budi Santoso', initials: 'BS', role: 'ab', layer: 2, leaderId: 'mem-owner', isLeader: true, directCount: 1 }),
          node({ membershipId: 'mem-b-ag', fullName: 'Eka Putri', initials: 'EP', layer: 3, leaderId: 'mem-ab2' }),
          node({ membershipId: 'mem-own-ag', fullName: 'Dina Lestari', initials: 'DL', layer: 3, leaderId: 'mem-admin' }),
        ],
        leader: null,
        rootIds: ['mem-owner'],
        selfId: 'mem-admin',
        counts: { ab: 2, aab: 1, agent: 2, total: 5 },
      }, ADMIN);
      await screen.findByText('YOU');
      expect(['mem-owner', 'mem-admin', 'mem-own-ag', 'mem-ab2', 'mem-b-ag'].map((id) => line(id) !== null))
        .toEqual([true, true, true, true, false]);
    });

    it('P18.95-T8 AC-3 at 768px and wider keeps the canvas, its layers and its cards', async () => {
      open();
      expect(await screen.findByText('Layer 1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-canvas')).toBeInTheDocument();
      expect(screen.getByText(/1 person is inside a closed unit/)).toBeInTheDocument();
    });

    it('P18.95-T8 AC-3 the list, a unit opened, passes axe (WCAG 2.1 AA)', async () => {
      onAPhone();
      await userEvent.click(await screen.findByRole('button', { name: 'Show who reports to Sari Puspita' }));
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect((results.violations ?? []).map((v) => v.id)).toEqual([]);
    });
  });
});
