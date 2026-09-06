'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ROLE_AVATAR_CLASS, ROLE_LABEL, RoleBadge } from '@/components/ui/role-badge';
import type { OrgTree as OrgTreeData } from '@/lib/org';
import { defaultCollapsed, layoutTree, NODE_HEIGHT, NODE_WIDTH } from './layout';

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
export function unitBreakdown(counts: { ab: number; aab: number; agent: number }): string {
  const parts: string[] = [];
  if (counts.agent) parts.push(`${counts.agent} direct agent${counts.agent > 1 ? 's' : ''}`);
  if (counts.aab) parts.push(`${counts.aab} AAB`);
  if (counts.ab) parts.push(`${counts.ab} AB`);
  return parts.join(', ');
}

export function OrgTree({
  tree,
  personHref,
}: {
  tree: OrgTreeData;
  /** Where a card goes when clicked. Omitted where the reader cannot open a person. */
  personHref?: (membershipId: string) => string;
}) {
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
            : `${tree.counts.total} below you · ${tree.counts.ab} AB · ${tree.counts.aab} AAB · ${tree.counts.agent} Agent`}
        </p>
        <ul className="flex flex-wrap items-center gap-3">
          {(['ab', 'aab', 'agent'] as const).map((role) => (
            <li key={role} className="flex items-center gap-1.5 text-sm text-muted">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-sm ${ROLE_AVATAR_CLASS[role].split(' ')[0]}`}
              />
              {/* The prototype's legend abbreviates the middle one: "Associate AB". */}
              {role === 'aab' ? 'Associate AB' : ROLE_LABEL[role]}
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
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-md font-bold ${ROLE_AVATAR_CLASS[tree.leader.role]}`}
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
                const label = node.preferredName ?? node.fullName;
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
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${ROLE_AVATAR_CLASS[node.role]}`}
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

      {hiddenCount > 0 && (
        <p className="mt-3 text-sm text-muted">
          {hiddenCount} {hiddenCount === 1 ? 'person is' : 'people are'} inside a closed unit. Units
          below layer 2 start closed, so a large office opens legibly.
        </p>
      )}
    </div>
  );
}
