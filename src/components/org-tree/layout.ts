import type { OrgTree, OrgTreeNode } from '@/lib/org';

/**
 * Tree geometry, computed from the model alone.
 *
 * The prototype measures: `drawConnectors` issues two `getBoundingClientRect()` per edge
 * plus one for the canvas, from inside a `requestAnimationFrame` that fires immediately
 * after `columnsEl.innerHTML = html`. At 500 members that is ~1,000 forced synchronous
 * layouts, repeated in full on every collapse and on every unthrottled `resize`. It also
 * drops any edge whose endpoints are not both in the DOM, so the moment anything is
 * hidden the picture is wrong rather than smaller.
 *
 * Nothing here reads the DOM. Every card's position is arithmetic on fixed constants, so
 * the layout is the same in a browser, in a test and on a server, and a test can assert
 * that no measurement happened at all — which is the only way AC-3 is provable rather
 * than asserted. It also means the numbers below *are* the design: change one and the
 * picture changes, with no second source of truth to disagree.
 */
export const NODE_HEIGHT = 64;
export const NODE_WIDTH = 220;
export const ROW_GAP = 24;
/** Extra air between one leader's children and the next leader's. */
export const GROUP_GAP = 20;
export const COLUMN_GAP = 76;
export const LABEL_HEIGHT = 28;

export interface PlacedNode {
  node: OrgTreeNode;
  x: number;
  y: number;
  /** True when this card starts a new sibling group within its column. */
  groupStart: boolean;
}

export interface Edge {
  parentId: string;
  childId: string;
  path: string;
}

export interface TreeLayout {
  columns: { layer: number; nodes: PlacedNode[] }[];
  edges: Edge[];
  width: number;
  height: number;
  /** Every node actually placed, so a caller can count them without walking columns. */
  placed: PlacedNode[];
}

/**
 * Depth-first, in the order the roots and children arrive.
 *
 * The order is load-bearing, not cosmetic: the sibling separator asks only whether the
 * previous card in this column had a different leader, which is equivalent to "a new
 * group starts here" **only** if one leader's children are contiguous within the column.
 * Depth-first pre-order is what makes them contiguous — between two children of P,
 * everything pushed is deeper than they are, so nothing from another parent can land
 * between them.
 */
function walk(
  tree: OrgTree,
  collapsed: ReadonlySet<string>,
): { columns: OrgTreeNode[][]; edges: { parentId: string; childId: string }[] } {
  const childrenOf = new Map<string, OrgTreeNode[]>();
  for (const node of tree.nodes) {
    if (node.leaderId === null) continue;
    const siblings = childrenOf.get(node.leaderId);
    if (siblings) siblings.push(node);
    else childrenOf.set(node.leaderId, [node]);
  }

  const byId = new Map(tree.nodes.map((n) => [n.membershipId, n]));
  const columns: OrgTreeNode[][] = [];
  const edges: { parentId: string; childId: string }[] = [];
  const seen = new Set<string>();

  const push = (node: OrgTreeNode) => {
    const index = node.layer - 1;
    while (columns.length <= index) columns.push([]);
    columns[index].push(node);
  };

  const visit = (node: OrgTreeNode) => {
    // A cycle is prevented server-side, but a client that could loop on bad data would
    // hang the tab rather than draw a wrong tree, which is worse.
    if (seen.has(node.membershipId)) return;
    seen.add(node.membershipId);
    push(node);
    if (collapsed.has(node.membershipId)) return;

    for (const child of childrenOf.get(node.membershipId) ?? []) {
      edges.push({ parentId: node.membershipId, childId: child.membershipId });
      visit(child);
    }
  };

  for (const rootId of tree.rootIds) {
    const root = byId.get(rootId);
    if (root) visit(root);
  }
  // A node whose leader is not in the payload at all is unreachable from any root and
  // would otherwise vanish. It cannot happen today — the server computes `rootIds` by
  // the same rule — but a silently dropped person is the one failure this screen must
  // not have. Being *inside a collapsed unit* is not that: those are hidden on purpose,
  // so the test is the leader's absence, never `seen`.
  for (const node of tree.nodes) {
    const unreachable = node.leaderId !== null && !byId.has(node.leaderId);
    if (unreachable && !seen.has(node.membershipId)) visit(node);
  }

  return { columns, edges };
}

export function layoutTree(tree: OrgTree, collapsed: ReadonlySet<string> = new Set()): TreeLayout {
  const { columns, edges } = walk(tree, collapsed);

  const at = new Map<string, PlacedNode>();
  const placedColumns = columns.map((column, index) => {
    const x = index * (NODE_WIDTH + COLUMN_GAP);
    let y = LABEL_HEIGHT;
    let previousLeader: string | null | undefined;

    const nodes = column.map((node, row) => {
      const groupStart = row > 0 && node.leaderId !== previousLeader;
      if (row > 0) y += ROW_GAP + (groupStart ? GROUP_GAP : 0);
      previousLeader = node.leaderId;

      const placed = { node, x, y, groupStart };
      at.set(node.membershipId, placed);
      y += NODE_HEIGHT;
      return placed;
    });

    return { layer: index + 1, nodes };
  });

  const height = placedColumns.reduce((tallest, column) => {
    const last = column.nodes[column.nodes.length - 1];
    return last ? Math.max(tallest, last.y + NODE_HEIGHT) : tallest;
  }, 0);

  return {
    columns: placedColumns,
    edges: edges.flatMap(({ parentId, childId }) => {
      const from = at.get(parentId);
      const to = at.get(childId);
      // Unlike the prototype, a missing endpoint drops the edge *and* is impossible:
      // an edge is only emitted for a pair this same walk placed.
      if (!from || !to) return [];
      const x1 = from.x + NODE_WIDTH;
      const y1 = from.y + NODE_HEIGHT / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_HEIGHT / 2;
      const mid = x1 + (x2 - x1) / 2;
      return [{ parentId, childId, path: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}` }];
    }),
    width: placedColumns.length * NODE_WIDTH + Math.max(0, placedColumns.length - 1) * COLUMN_GAP,
    height,
    placed: [...at.values()],
  };
}

/**
 * What is collapsed when the tree first opens.
 *
 * The prototype opens everything and has no default; at its own seeded 187 members the
 * fully expanded tree is unusable, and this task's budget is 500. So anything that leads
 * people below the second layer starts closed — the shape of the office is legible, and
 * nothing below is in the DOM until asked for. That is the bound in AC-3, and it holds
 * without measuring anything.
 */
export const DEFAULT_OPEN_LAYERS = 2;

export function defaultCollapsed(tree: OrgTree): Set<string> {
  return new Set(
    tree.nodes.filter((n) => n.isLeader && n.layer >= DEFAULT_OPEN_LAYERS).map((n) => n.membershipId),
  );
}
