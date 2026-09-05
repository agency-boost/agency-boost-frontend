'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ROLE_LABEL, RoleBadge } from '@/components/ui/role-badge';
import type { OrgTree as OrgTreeData } from '@/lib/org';
import {
  defaultCollapsed,
  layoutTree,
  LABEL_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
} from './layout';

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
              <RoleBadge role={role} />
              {ROLE_LABEL[role]}
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-soft text-md font-bold text-card">
              {tree.leader.initials}
            </span>
            <span>
              <span className="block text-md font-semibold text-navy">{tree.leader.fullName}</span>
              <RoleBadge role={tree.leader.role} />
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <div
          className="relative inline-block min-w-full"
          style={{ width: layout.width, height: layout.height + LABEL_HEIGHT }}
          data-testid="tree-canvas"
        >
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={layout.width}
            height={layout.height + LABEL_HEIGHT}
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
                    style={{ left: x, top: y + LABEL_HEIGHT, width: NODE_WIDTH, height: NODE_HEIGHT }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-soft text-sm font-bold text-card">
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
                      <span className="flex items-center gap-1.5">
                        <RoleBadge role={node.role} />
                        {/* Their own unit, never cumulative — the prototype is explicit
                            about this, and a cumulative number here would double-count
                            everybody below. */}
                        {node.isLeader && (
                          <span className="text-sm text-muted">leads {node.directCount}</span>
                        )}
                      </span>
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
