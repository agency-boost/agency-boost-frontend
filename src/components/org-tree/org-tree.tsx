'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  avatarClassFor, rungShort, shortOfRung, useLadder, RoleBadge, SEEDED_LADDER,
} from '@/components/ui/role-badge';
import { TAP_TARGET } from '@/components/ui/phone';
import { TermTip } from '@/components/ui/term-tip';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import type { OrgLevel } from '@/lib/tenant-config-cache';
import type { OrgTree as OrgTreeData, OrgTreeNode } from '@/lib/org';
import { defaultCollapsed, defaultOpenInList, layoutTree, NODE_HEIGHT, NODE_WIDTH } from './layout';

/**
 * The hierarchy, drawn.
 *
 * One component for both screens, because the only thing that differs between a leader's
 * own tree and the office-wide one is which nodes came back — and the server already
 * decided that. Two components would be two chances to disagree about a layer.
 *
 * Geometry comes from `layoutTree`, which reads nothing from the DOM. The prototype
 * measures every card twice per edge on every render and every resize; this positions
 * from the model, so the picture is identical before paint, in a test, and at 500 members.
 */
/**
 * *"3 direct agents, 2 AAB"* — the prototype's own sentence (`Group_Overview.html:219-228`),
 * pluralised, and always in the order agent → AAB → AB.
 *
 * A bare total cannot say this. "leads 5" is true of an AB with five agents and of one
 * with five AABs, and those are different offices.
 */
export function unitBreakdown(
  counts: Record<string, number>,
  ladder: OrgLevel[] = SEEDED_LADDER,
): string {
  /*
   * Junior first, because that is the prototype's own order and it is also the useful
   * one: a leader's agents are the bulk of their unit and their AABs are the exception.
   *
   * Keyed by ladder code since P4-T9. Three fixed keys silently said nothing about a
   * rung a second insurer publishes — a leader with four reports on a new rung read as
   * leading nobody here while the total beside it said four.
   */
  const junior = [...ladder].sort((a, b) => a.displayOrder - b.displayOrder);
  const parts: string[] = [];
  for (const rung of junior) {
    const n = counts[rung.code] ?? 0;
    if (!n) continue;
    // The badge's name (P18.95-T9 AC-1), a long label lower-cased inside the sentence.
    const name = shortOfRung(rung);
    const short = name === rung.code ? name : name.toLowerCase();
    parts.push(
      rung.code === 'AGENT'
        // The prototype's exact words for the commonest case.
        ? `${n} direct agent${n > 1 ? 's' : ''}`
        : `${n} ${short}`,
    );
  }
  return parts.join(', ');
}

export function OrgTree({
  tree,
  personHref,
  asList = false,
}: {
  tree: OrgTreeData;
  /**
   * Where a card goes when clicked. Omitted where the reader cannot open a person; `undefined` for
   * one card leaves that card inert (the Group tree's reader and their leader, P15-T4 AC-3).
   */
  personHref?: (membershipId: string) => string | undefined;
  /**
   * **An indented list in place of the canvas** — `/group-tree`'s below 768px (P18.95-T8 AC-3; the
   * client's UI review, UI-025: the tree grew right, 516px wide in a 285px box, and only the reader
   * showed). The page decides, from the width it has known since it mounted, so the canvas never flashes
   * on a phone before the list; the office's tree keeps its canvas until the client reviews it.
   */
  asList?: boolean;
}) {
  // The company's ladder: labels and colours come from it, not from a map here (P4-T9).
  const ladder = useLadder();
  const [collapsed, setCollapsed] = useState(() => defaultCollapsed(tree));
  const layout = useMemo(() => layoutTree(tree, collapsed), [tree, collapsed]);

  function toggle(membershipId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(membershipId)) next.add(membershipId);
      return next;
    });
  }

  const hiddenCount = tree.nodes.length - layout.placed.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-md text-muted">
          {tree.counts.total === 0
            ? 'Nobody reports to you yet.'
            : `${tree.counts.total} below you · ${tree.counts.ab} ${rungShort('AB', ladder)} · ${tree.counts.aab} ${rungShort('AAB', ladder)} · ${tree.counts.agent} ${rungShort('AGENT', ladder)}`}
        </p>
        <ul className="flex flex-wrap items-center gap-3">
          {(['ab', 'aab', 'agent'] as const).map((role) => (
            <li key={role} className="flex items-center gap-1.5 text-sm text-muted">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-sm ${avatarClassFor(role, ladder).split(' ')[0]}`}
              />
              {/* The badges' own names, *AB* · *AAB* · *Agent* (P18.95-T8 AC-3, ADR-0167 §10; UI-025, UI-027):
                  the prototype's legend said *Agency Builder* and *Associate AB* beside badges reading
                  *AB* and *AAB*, a third name for the middle rung. */}
              {rungShort(role, ladder)}
              {/* What *AAB* stands for, once, in the legend that names the badges (P18.95-T9 AC-3; UI-028). A ladder
                  that calls the rung something else has its own word, and this ⓘ defines only the default's. */}
              {rungShort(role, ladder) === 'AAB' && <TermTip term="AAB" />}
            </li>
          ))}
        </ul>
      </div>

      {tree.leader && (
        <div className="mt-4">
          {/* Above the layers, never inside one. The prototype emits this card *after*
              the Layer 1 label, so on screen it sits below the rule it is meant to be
              above — contradicting its own comment. */}
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your leader</p>
          <div className="mt-1 inline-flex items-center gap-3 rounded-md border border-dashed border-hairline bg-card p-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-md font-bold ${avatarClassFor(tree.leader.role, ladder)}`}
            >
              {tree.leader.initials}
            </span>
            <span>
              <span className="block text-md font-semibold text-navy">{tree.leader.fullName}</span>
              <RoleBadge role={tree.leader.role} tone="muted" />
            </span>
          </div>
        </div>
      )}

      {asList ? <OrgList tree={tree} personHref={personHref} ladder={ladder} /> : (
      <div className="mt-4 overflow-x-auto">
        <div
          className="relative inline-block min-w-full"
          style={{ width: layout.width, height: layout.height }}
          data-testid="tree-canvas"
        >
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.edges.map((edge) => (
              <path
                key={`${edge.parentId}-${edge.childId}`}
                d={edge.path}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="text-hairline"
              />
            ))}
          </svg>

          {layout.columns.map((column) => (
            <div key={column.layer}>
              <div
                className="absolute text-sm font-semibold uppercase tracking-wide text-muted"
                style={{ left: column.nodes[0]?.x ?? 0, top: 0, width: NODE_WIDTH }}
              >
                Layer {column.layer}
              </div>
              {column.nodes.map(({ node, x, y }) => {
                const href = personHref?.(node.membershipId);
                const label = displayName(node);
                return (
                  <div
                    key={node.membershipId}
                    data-node={node.membershipId}
                    className={`absolute flex items-center gap-2 rounded-md border bg-card p-2 ${
                      node.isSelf ? 'border-amber' : 'border-hairline'
                    }`}
                    style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${avatarClassFor(node.role, ladder)}`}
                    >
                      {node.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-md font-semibold text-navy">
                        {href ? (
                          <Link href={href} className="underline">
                            {label}
                          </Link>
                        ) : (
                          label
                        )}
                        {node.isSelf && (
                          <span className="ml-1 rounded bg-amber px-1 text-sm font-bold text-navy">
                            YOU
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <RoleBadge role={node.role} tone="muted" />
                      </span>
                      {/* Their own unit, never cumulative — the prototype is explicit
                          about this, and a cumulative number would double-count everybody
                          below. */}
                      {node.isLeader && (
                        <span className="mt-0.5 block truncate text-2xs text-muted">
                          {unitBreakdown(node.directCounts)}
                        </span>
                      )}
                    </span>

                    {node.isLeader && (
                      <button
                        type="button"
                        onClick={() => toggle(node.membershipId)}
                        aria-expanded={!collapsed.has(node.membershipId)}
                        aria-label={
                          collapsed.has(node.membershipId)
                            ? `Show who reports to ${node.fullName}`
                            : `Hide who reports to ${node.fullName}`
                        }
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-sm text-navy"
                      >
                        {collapsed.has(node.membershipId) ? '+' : '−'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      )}

      {!asList && hiddenCount > 0 && (
        <p className="mt-3 text-sm text-muted">
          {hiddenCount} {hiddenCount === 1 ? 'person is' : 'people are'} inside a closed unit. Units
          below layer 2 start closed, so a large office opens legibly.
        </p>
      )}
    </div>
  );
}

/**
 * **The tree as a phone draws it: an indented list that opens and closes** (P18.95-T8 AC-3; the client's
 * UI review, UI-025). The same people in the same order as the canvas — depth first, each leader's team
 * under them — each line a card's content: the avatar, the name (a link where the card's is), *YOU*, the
 * rung's badge and a leader's unit, *"3 direct agents, 2 AAB"*. A leader's line has the canvas's own
 * control, + or −, named *Show* or *Hide who reports to {name}*, `aria-expanded`, a 44px target; it is a
 * button, so Tab reaches it and Enter or Space opens it. **It opens on the reader's own line, one level
 * down**: their direct reports shown, everybody's below them closed, and the lines above the reader open
 * as far as the reader — an Admin's office-wide tree included — so the reader is always in view.
 */
function OrgList({
  tree,
  personHref,
  ladder,
}: {
  tree: OrgTreeData;
  personHref?: (membershipId: string) => string | undefined;
  ladder: OrgLevel[];
}) {
  const [open, setOpen] = useState(() => defaultOpenInList(tree));
  const childrenOf = useMemo(() => {
    const below = new Map<string, OrgTreeNode[]>();
    for (const node of tree.nodes) {
      if (node.leaderId) below.set(node.leaderId, [...(below.get(node.leaderId) ?? []), node]);
    }
    return below;
  }, [tree]);
  const byId = useMemo(() => new Map(tree.nodes.map((n) => [n.membershipId, n])), [tree]);
  // The roots, and anybody whose leader is not in the payload, as the canvas places them (`walk`).
  const roots = [
    ...tree.rootIds.map((id) => byId.get(id)).filter((n): n is OrgTreeNode => Boolean(n)),
    ...tree.nodes.filter((n) => n.leaderId !== null && !byId.has(n.leaderId) && !tree.rootIds.includes(n.membershipId)),
  ];

  const toggle = (membershipId: string) => setOpen((now) => {
    const next = new Set(now);
    if (!next.delete(membershipId)) next.add(membershipId);
    return next;
  });

  const seen = new Set<string>();
  const branch = (nodes: OrgTreeNode[], level: number) => (
    <ul className={level === 0 ? 'mt-4 flex flex-col' : 'flex flex-col'}>
      {nodes.map((node) => {
        // A cycle is prevented server-side; a list that could loop on bad data would hang the tab.
        if (seen.has(node.membershipId)) return null;
        seen.add(node.membershipId);
        const href = personHref?.(node.membershipId);
        const label = displayName(node);
        const expanded = open.has(node.membershipId);
        const team = childrenOf.get(node.membershipId) ?? [];
        return (
          <li key={node.membershipId} data-node={node.membershipId}>
            <div
              className={cn('flex items-center gap-2 border-b border-hairline py-1.5', node.isSelf && 'bg-amber/[0.08]')}
              style={{ paddingLeft: level * 16 }}
            >
              {node.isLeader ? (
                <button
                  type="button"
                  onClick={() => toggle(node.membershipId)}
                  aria-expanded={expanded}
                  aria-label={expanded ? `Hide who reports to ${node.fullName}` : `Show who reports to ${node.fullName}`}
                  className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-sm text-navy', TAP_TARGET)}
                >
                  {expanded ? '−' : '+'}
                </button>
              ) : (
                <span aria-hidden="true" className="w-6 shrink-0 max-md:w-11" />
              )}
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${avatarClassFor(node.role, ladder)}`}
              >
                {node.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-md font-semibold text-navy">
                  {href ? <Link href={href} className="underline">{label}</Link> : label}
                  {node.isSelf && <span className="ml-1 rounded bg-amber px-1 text-sm font-bold text-navy">YOU</span>}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <RoleBadge role={node.role} tone="muted" />
                  {node.isLeader && <span className="text-xs text-muted">{unitBreakdown(node.directCounts)}</span>}
                </span>
              </span>
            </div>
            {node.isLeader && expanded && team.length > 0 && branch(team, level + 1)}
          </li>
        );
      })}
    </ul>
  );

  return branch(roots, 0);
}
