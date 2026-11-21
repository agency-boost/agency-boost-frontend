'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { PersonName } from '@/components/people/people-parts';
import { ActivityPill } from '@/components/ui/activity-pill';
import { Avatar } from '@/components/ui/avatar';
import { PersonRow, TreeIndent, TreeNode, TreeToggle, type PersonRowTone } from '@/components/ui/person-row';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { orgTreeMessages } from '@/i18n/messages/org-tree';
import { matchesAgent } from '@/lib/agent-search';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import { formatNumber } from '@/lib/format';
import type { OrgTree, OrgTreeNode } from '@/lib/org';

/*
 * **The KPM's Org tree as rows, at every size** (P19.20-T3; ADR-0273 §4, superseding ADR-0178 §5–§6; the People mockup's
 * frames 22–25): the Group Tree design (D-05) for the whole KPM — never the sideways *Lapisan* chart — and Import people's
 * *Struktur saat ini* (T5 AC-3), the same tree drawn compact.
 */

const RANK: Record<OrgTreeNode['role'], number> = { ab: 0, aab: 1, agent: 2 };

/** The tree's shape and the search's answer: whom each leader leads, the roots, and what a search shows and opens. */
function useModel(tree: OrgTree, query: string, order: 'agents-first' | 'leaders-first') {
  const byId = useMemo(() => new Map(tree.nodes.map((n) => [n.membershipId, n])), [tree]);
  const childrenOf = useMemo(() => {
    const below = new Map<string, OrgTreeNode[]>();
    for (const node of tree.nodes) {
      if (node.leaderId) below.set(node.leaderId, [...(below.get(node.leaderId) ?? []), node]);
    }
    for (const [id, team] of below) {
      below.set(id, order === 'agents-first'
        // The Group Tree's order (UI-059), the Org tree mockup's: a leader's own agents, then the units under them.
        ? [...team.filter((n) => n.role === 'agent'), ...team.filter((n) => n.role !== 'agent')]
        // *Struktur saat ini* (T5 AC-3): AB → AAB → Agent under each leader.
        : [...team].sort((a, b) => RANK[a.role] - RANK[b.role]));
    }
    return below;
  }, [tree, order]);
  const roots = useMemo(() => [
    ...tree.rootIds.map((id) => byId.get(id)).filter((n): n is OrgTreeNode => Boolean(n)),
    ...tree.nodes.filter((n) => n.leaderId !== null && !byId.has(n.leaderId) && !tree.rootIds.includes(n.membershipId)),
  ], [tree, byId]);
  const found = useMemo(() => {
    if (!query.trim()) return null;
    const shown = new Set<string>();
    const opened = new Set<string>();
    for (const node of tree.nodes) {
      if (!matchesAgent(query, node)) continue;
      shown.add(node.membershipId);
      let up = node.leaderId ? byId.get(node.leaderId) : undefined;
      const seen = new Set<string>();
      while (up && !seen.has(up.membershipId)) {
        seen.add(up.membershipId);
        shown.add(up.membershipId);
        opened.add(up.membershipId);
        up = up.leaderId ? byId.get(up.leaderId) : undefined;
      }
    }
    return { shown, opened };
  }, [query, tree, byId]);
  const visible = (nodes: OrgTreeNode[]) => (found ? nodes.filter((n) => found.shown.has(n.membershipId)) : nodes);
  return { childrenOf, roots, found, visible };
}

/** *30 orang · 5 AB · 4 AAB · 21 Agent · akun tes tidak dihitung*: every node of the KPM's tree, the reader included. */
export function useKpmTreeSummary(tree: OrgTree | null): string {
  const t = useMessages(orgTreeMessages);
  const ladder = useLadder();
  const figures = useFigureLanguage();
  if (!tree) return '';
  const counts = { ab: 0, aab: 0, agent: 0 };
  for (const n of tree.nodes) counts[n.role] += 1;
  const parts = (['ab', 'aab', 'agent'] as const)
    .filter((role) => counts[role] > 0)
    .map((role) => `${formatNumber(counts[role], {}, figures)} ${rungShort(role.toUpperCase(), ladder)}`)
    .join(' · ');
  return t.summary({ total: tree.nodes.length, parts });
}

/**
 * **The Org tree** (T3 AC-1 to AC-3): the indented list — 36px a level with a thin connector (`TreeIndent`) — the
 * reader's own row navy with *Anda*, an AB's and an AAB's orange-tinted, an agent's white; names in capitals; the second
 * line *role · n langsung* and today's activity pill (orange *n aktivitas*, grey *Belum lapor*); ⌄ only opens or closes
 * the team; **a tap on the row opens the member sheet** (`onOpen`). A core leader's rows outside their downline are muted
 * — an outline, grey, no pill — and open nothing (`openable: false`). `openAll` opens every unit each time it changes;
 * `closeAll` closes them.
 */
export function KpmTree({
  tree, query = '', openAll = 0, closeAll = 0, onOpen,
}: {
  tree: OrgTree;
  query?: string;
  openAll?: number;
  closeAll?: number;
  onOpen: (membershipId: string) => void;
}) {
  const t = useMessages(orgTreeMessages);
  const ladder = useLadder();
  const prefix = useId();
  const model = useModel(tree, query, 'agents-first');
  // Opened as the Group Tree opens: the reader's own unit and the roots, the units below closed.
  const [open, setOpen] = useState<Set<string>>(() => new Set([
    ...tree.rootIds, ...(tree.selfId ? [tree.selfId] : []),
  ]));
  useEffect(() => {
    if (openAll > 0) setOpen(new Set(tree.nodes.filter((n) => n.isLeader).map((n) => n.membershipId)));
  }, [openAll, tree]);
  useEffect(() => {
    if (closeAll > 0) setOpen(new Set());
  }, [closeAll]);
  useEffect(() => {
    const opened = model.found?.opened;
    if (opened && opened.size > 0) setOpen((now) => new Set([...now, ...opened]));
  }, [model.found]);
  const toggle = (id: string) => setOpen((now) => {
    const next = new Set(now);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  if (model.found && model.found.shown.size === 0) {
    return <p role="status" className="rounded-lg bg-card px-5 py-6 text-center text-md text-muted">{t.noMatch}</p>;
  }

  const seen = new Set<string>();
  const branch = (node: OrgTreeNode): ReactNode => {
    if (seen.has(node.membershipId)) return null;
    seen.add(node.membershipId);
    const team = model.visible(model.childrenOf.get(node.membershipId) ?? []);
    const expanded = open.has(node.membershipId);
    const name = displayName(node);
    const muted = node.openable === false;
    const tone: PersonRowTone = muted ? 'muted' : node.isSelf ? 'self' : node.role === 'agent' ? 'default' : 'tinted';
    return (
      <>
        <PersonRow
          name={name}
          photoUrl={node.photoUrl}
          seed={node.membershipId}
          onSelect={muted ? undefined : () => onOpen(node.membershipId)}
          tone={tone}
          height={60}
          className={cn(muted && 'min-h-[3.75rem]')}
          badge={node.isSelf ? <TonePill tone="blue" className="font-bold">{t.you}</TonePill> : undefined}
          meta={(
            <>
              <span className="shrink-0">
                {rungShort(node.role.toUpperCase(), ladder)}
                {node.directCount > 0 && ` · ${t.direct({ n: node.directCount })}`}
              </span>
              {!muted && <ActivityPill count={node.todayActivityCount ?? 0} onTint={tone === 'tinted'} />}
            </>
          )}
          trailing={team.length > 0 ? (
            <TreeToggle name={name} open={expanded} onToggle={() => toggle(node.membershipId)}
              controls={`${prefix}-${node.membershipId}`} onNavy={node.isSelf && !muted} />
          ) : undefined}
        />
        {team.length > 0 && expanded && (
          <TreeIndent id={`${prefix}-${node.membershipId}`} label={t.team({ name })}>
            {team.map((child) => (
              <TreeNode key={child.membershipId} className="[--elbow:1.875rem]">
                <div data-node={child.membershipId}>{branch(child)}</div>
              </TreeNode>
            ))}
          </TreeIndent>
        )}
      </>
    );
  };

  return (
    <ul className="flex flex-col gap-1.5" data-testid="kpm-tree">
      {model.visible(model.roots).map((root) => <li key={root.membershipId} data-node={root.membershipId}>{branch(root)}</li>)}
    </ul>
  );
}

/**
 * ***Struktur saat ini*** (T5 AC-3; the People mockup's frames 13 and 21): the KPM's tree compact in one card — photo, the
 * AB / AAB label, the NAME, the team's size on the right (*n orang*); AB → AAB → Agent under each leader, every unit
 * open; a tap opens the member sheet. `fresh` — the people a save just added — read *Baru* in green on a light green row.
 */
export function KpmStructure({
  tree, fresh, onOpen, footer,
}: {
  tree: OrgTree;
  fresh?: ReadonlySet<string>;
  onOpen: (membershipId: string) => void;
  footer?: ReactNode;
}) {
  const t = useMessages(orgTreeMessages);
  const model = useModel(tree, '', 'leaders-first');
  const rows: { node: OrgTreeNode; level: number }[] = [];
  const seen = new Set<string>();
  const walk = (node: OrgTreeNode, level: number) => {
    if (seen.has(node.membershipId)) return;
    seen.add(node.membershipId);
    rows.push({ node, level });
    for (const child of model.childrenOf.get(node.membershipId) ?? []) walk(child, level + 1);
  };
  for (const root of model.roots) walk(root, 0);

  return (
    <div className="overflow-hidden rounded-lg bg-card">
      <ul>
        {rows.map(({ node, level }) => {
          const name = displayName(node);
          const isNew = fresh?.has(node.membershipId) ?? false;
          const muted = node.openable === false;
          return (
            <li key={node.membershipId} data-node={node.membershipId} data-new={isNew ? '' : undefined}
              className={cn('border-b border-divider last:border-b-0', isNew && 'bg-pill-green/50')}>
              <button
                type="button"
                disabled={muted}
                onClick={() => onOpen(node.membershipId)}
                aria-label={t.open({ name })}
                className="flex min-h-11 w-full items-center gap-2.5 py-1.5 pr-4 text-left hover:bg-hover-row disabled:cursor-default disabled:hover:bg-transparent"
                style={{ paddingLeft: `${16 + level * 26}px` }}
              >
                <Avatar name={name} photoUrl={node.photoUrl} seed={node.membershipId} size={28} />
                <PersonName name={name} role={node.role} muted={muted} className="flex-1 text-md" />
                {isNew && <TonePill tone="green">{t.newTag}</TonePill>}
                {!isNew && node.subtreeCount > 0 && <span className="shrink-0 text-sm text-muted">{t.people({ n: node.subtreeCount })}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {footer}
    </div>
  );
}
