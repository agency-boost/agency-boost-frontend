import { describe, expect, it } from 'vitest';
import type { OrgTree, OrgTreeNode } from '@/lib/org';
import {
  COLUMN_GAP,
  defaultCollapsed,
  GROUP_GAP,
  layoutTree,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_GAP,
} from './layout';

const node = (over: Partial<OrgTreeNode> & { membershipId: string; layer: number }): OrgTreeNode => ({
  fullName: `Person ${over.membershipId}`,
  preferredName: null,
  initials: 'PP',
  agentCode: `KPM0417-${over.membershipId}`,
  role: 'agent',
  depth: over.layer - 1,
  leaderId: null,
  directCount: 0,
  directCounts: { ab: 0, aab: 0, agent: 0, total: 0 },
  subtreeCount: 0,
  isLeader: false,
  isSelf: false,
  ...over,
});

function tree(nodes: OrgTreeNode[], over: Partial<OrgTree> = {}): OrgTree {
  return {
    nodes,
    leader: null,
    rootIds: nodes.filter((n) => n.leaderId === null).map((n) => n.membershipId),
    selfId: null,
    counts: { ab: 0, aab: 0, agent: nodes.length, total: nodes.length },
    ...over,
  };
}

/** A leader with `n` reports, plus the reports. */
function unit(leaderId: string, n: number, layer: number): OrgTreeNode[] {
  return [
    node({ membershipId: leaderId, layer, isLeader: true, directCount: n, role: 'aab' }),
    ...Array.from({ length: n }, (_, i) =>
      node({ membershipId: `${leaderId}-${i}`, layer: layer + 1, leaderId }),
    ),
  ];
}

describe('tree layout (P3-T8)', () => {
  it('AC-1: puts a node in the column its layer names, not the one its position suggests', () => {
    const layout = layoutTree(tree([node({ membershipId: 'a', layer: 1, isLeader: true, directCount: 1 }),
                                    node({ membershipId: 'b', layer: 2, leaderId: 'a' })]));

    expect(layout.columns.map((c) => c.layer)).toEqual([1, 2]);
    expect(layout.columns[1].nodes[0].node.membershipId).toBe('b');
  });

  it('AC-3: reads nothing from the DOM', () => {
    // The prototype issues two getBoundingClientRect per edge plus one for the canvas,
    // inside a rAF after innerHTML — about a thousand forced layouts at 500 members,
    // repeated on every collapse and every resize. This function cannot: it is given a
    // model and returns numbers. The assertion is that `document` is never touched.
    const nodes = Array.from({ length: 500 }, (_, i) =>
      i === 0
        ? node({ membershipId: 'root', layer: 1, isLeader: true, directCount: 499 })
        : node({ membershipId: `n${i}`, layer: 2, leaderId: 'root' }),
    );

    const seen: string[] = [];
    const proxied = new Proxy(globalThis.document, {
      get(target, prop) {
        seen.push(String(prop));
        return Reflect.get(target, prop) as unknown;
      },
    });
    const original = globalThis.document;
    Object.defineProperty(globalThis, 'document', { value: proxied, configurable: true });
    try {
      const layout = layoutTree(tree(nodes));
      expect(layout.placed).toHaveLength(500);
    } finally {
      Object.defineProperty(globalThis, 'document', { value: original, configurable: true });
    }
    expect(seen).toEqual([]);
  });

  it('AC-3: positions are arithmetic, so they are the same before paint as after', () => {
    const layout = layoutTree(tree(unit('lead', 2, 1)));
    const [first, second] = layout.columns[1].nodes;

    expect(first.x).toBe(NODE_WIDTH + COLUMN_GAP);
    expect(second.y - first.y).toBe(NODE_HEIGHT + ROW_GAP);
  });

  it('separates one leader children from the next, and only there', () => {
    // The prototype's heuristic compares each card only with the one above it, which is
    // correct exactly because depth-first keeps siblings contiguous.
    const nodes = [
      node({ membershipId: 'a', layer: 1, isLeader: true, directCount: 2 }),
      node({ membershipId: 'b', layer: 1, isLeader: true, directCount: 1 }),
      node({ membershipId: 'a1', layer: 2, leaderId: 'a' }),
      node({ membershipId: 'a2', layer: 2, leaderId: 'a' }),
      node({ membershipId: 'b1', layer: 2, leaderId: 'b' }),
    ];
    const layout = layoutTree(tree(nodes));
    const second = layout.columns[1].nodes;

    expect(second.map((p) => p.node.membershipId)).toEqual(['a1', 'a2', 'b1']);
    expect(second.map((p) => p.groupStart)).toEqual([false, false, true]);
    // The extra air is only at the boundary.
    expect(second[1].y - second[0].y).toBe(NODE_HEIGHT + ROW_GAP);
    expect(second[2].y - second[1].y).toBe(NODE_HEIGHT + ROW_GAP + GROUP_GAP);
  });

  it('keeps one leader children contiguous even when the payload interleaves them', () => {
    // The server sorts by agent code, so siblings arrive scattered. Depth-first
    // rebuilds the contiguity the separator depends on.
    const nodes = [
      node({ membershipId: 'a', layer: 1, isLeader: true, directCount: 2 }),
      node({ membershipId: 'a1', layer: 2, leaderId: 'a' }),
      node({ membershipId: 'b', layer: 1, isLeader: true, directCount: 2 }),
      node({ membershipId: 'b1', layer: 2, leaderId: 'b' }),
      node({ membershipId: 'a2', layer: 2, leaderId: 'a' }),
      node({ membershipId: 'b2', layer: 2, leaderId: 'b' }),
    ];
    const layout = layoutTree(tree(nodes));

    expect(layout.columns[1].nodes.map((p) => p.node.membershipId))
      .toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('draws one edge per placed child, and none to a hidden one', () => {
    const layout = layoutTree(tree(unit('lead', 3, 1)), new Set(['lead']));
    expect(layout.placed).toHaveLength(1);
    // The prototype drops edges whose endpoints are missing and draws a wrong picture.
    // Here an edge only exists for a pair this same walk placed.
    expect(layout.edges).toHaveLength(0);
  });

  it('collapsing removes a whole subtree, not one level of it', () => {
    const nodes = [
      node({ membershipId: 'a', layer: 1, isLeader: true, directCount: 1 }),
      node({ membershipId: 'b', layer: 2, leaderId: 'a', isLeader: true, directCount: 1 }),
      node({ membershipId: 'c', layer: 3, leaderId: 'b' }),
    ];
    expect(layoutTree(tree(nodes)).placed).toHaveLength(3);
    expect(layoutTree(tree(nodes), new Set(['a'])).placed.map((p) => p.node.membershipId))
      .toEqual(['a']);
  });

  it('collapsing the last deep branch removes its column entirely', () => {
    const nodes = [
      node({ membershipId: 'a', layer: 1, isLeader: true, directCount: 1 }),
      node({ membershipId: 'b', layer: 2, leaderId: 'a', isLeader: true, directCount: 1 }),
      node({ membershipId: 'c', layer: 3, leaderId: 'b' }),
    ];
    expect(layoutTree(tree(nodes), new Set(['b'])).columns).toHaveLength(2);
  });

  it('draws a forest: every root starts its own chain at layer 1', () => {
    // What P3-T7's orphan disposition produces, and what the office root already is.
    const nodes = [
      node({ membershipId: 'root', layer: 1, isLeader: true, directCount: 1 }),
      node({ membershipId: 'kid', layer: 2, leaderId: 'root' }),
      node({ membershipId: 'orphan', layer: 1 }),
    ];
    const layout = layoutTree(tree(nodes));

    expect(layout.columns[0].nodes.map((p) => p.node.membershipId)).toEqual(['root', 'orphan']);
    expect(layout.placed).toHaveLength(3);
  });

  it('places a node whose leader is missing rather than dropping the person', () => {
    const nodes = [node({ membershipId: 'stray', layer: 1, leaderId: 'gone' })];
    const layout = layoutTree({ ...tree(nodes), rootIds: [] });
    expect(layout.placed.map((p) => p.node.membershipId)).toEqual(['stray']);
  });

  it('cannot loop, even given a cycle', () => {
    const nodes = [
      node({ membershipId: 'a', layer: 1, leaderId: 'b', isLeader: true, directCount: 1 }),
      node({ membershipId: 'b', layer: 2, leaderId: 'a', isLeader: true, directCount: 1 }),
    ];
    expect(layoutTree({ ...tree(nodes), rootIds: ['a'] }).placed).toHaveLength(2);
  });

  it('is empty for an empty office rather than throwing', () => {
    const layout = layoutTree(tree([]));
    expect(layout).toMatchObject({ columns: [], edges: [], width: 0, height: 0 });
  });

  describe('what opens by default', () => {
    it('AC-3: units below layer 2 start closed, so the DOM is bounded', () => {
      const nodes = [
        node({ membershipId: 'root', layer: 1, isLeader: true, directCount: 1 }),
        node({ membershipId: 'ab', layer: 2, leaderId: 'root', isLeader: true, directCount: 400 }),
        ...Array.from({ length: 400 }, (_, i) =>
          node({ membershipId: `a${i}`, layer: 3, leaderId: 'ab' }),
        ),
      ];
      const t = tree(nodes);

      expect(layoutTree(t, defaultCollapsed(t)).placed).toHaveLength(2);
      // And everything is still reachable — nothing was dropped, only closed.
      expect(layoutTree(t).placed).toHaveLength(402);
    });

    it('leaves layer 1 open, so the office shape is legible without a click', () => {
      const nodes = [
        node({ membershipId: 'root', layer: 1, isLeader: true, directCount: 2 }),
        node({ membershipId: 'x', layer: 2, leaderId: 'root' }),
        node({ membershipId: 'y', layer: 2, leaderId: 'root' }),
      ];
      const t = tree(nodes);
      expect(layoutTree(t, defaultCollapsed(t)).placed).toHaveLength(3);
    });

    it('closes nobody who leads nobody', () => {
      const t = tree([node({ membershipId: 'solo', layer: 1 })]);
      expect(defaultCollapsed(t).size).toBe(0);
    });
  });
});
