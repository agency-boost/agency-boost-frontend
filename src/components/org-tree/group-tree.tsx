'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { ActivityPill } from '@/components/ui/activity-pill';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar, PersonRow, TreeIndent, TreeNode, TreeToggle, type PersonRowTone } from '@/components/ui/person-row';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { groupTreeMessages } from '@/i18n/messages/group-tree';
import { matchesAgent } from '@/lib/agent-search';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import { formatNumber } from '@/lib/format';
import type { OrgTree, OrgTreeNode } from '@/lib/org';
import type { OrgLevel } from '@/lib/tenant-config-cache';
import { defaultOpenInList } from './layout';
import { RolePill } from './role-pill';

/*
 * **The Group Tree as rows** (UI V1, 2026-10-30, Phase 18.99 T9: UI-058, UI-059, UI-072 to UI-075; mockups
 * `group-tree-mobile`, `-tablet`, `-desktop`). The office's *Org Tree* (`/people/org-tree`) keeps the canvas
 * (`org-tree.tsx`); this is `/group-tree` only.
 *
 * - **Below 1024px, the indented list** (UI-058, UI-059, UI-073): the shared `PersonRow` and `TreeIndent` — the reader's
 *   row navy with *Anda*, an AB or AAB tinted, an agent white; the upline muted, never a link; each row's meta its rung
 *   and today's activity pill; a leader's ⌄ at the right, its own target. The reader's unit open, the units below closed.
 * - **From 1024px, one card with columns** *Nama · Peran · Langsung · Hari ini · ⌄* (UI-058): rows of 52px, indented 34px
 *   a level with a 2px line; every unit open.
 * - **The whole row opens the person; no ›** (UI-072, the owner's exception to D-09): `personHref` decides where.
 * - **Under each leader, direct agents first, then the AAB units** (UI-059); otherwise the server's order.
 * - **`query`** (the page's *Cari agen*, UI-059): only the people whose name or agent code holds it, with the leaders
 *   above them, and every unit on the way to them opened — the same match as *Search agent* (`matchesAgent`).
 */

/** Agents first, then everyone who leads a unit, each group in the order the server sent (UI-059). */
function ordered(nodes: OrgTreeNode[]): OrgTreeNode[] {
  return [...nodes.filter((n) => n.role === 'agent'), ...nodes.filter((n) => n.role !== 'agent')];
}

/** *11 below you · 3 AAB · 8 Agent* — each rung's count, a zero left out (UI-074). */
export function useTreeSummary(tree: OrgTree): string {
  const t = useMessages(groupTreeMessages);
  const ladder = useLadder();
  const figures = useFigureLanguage();
  const parts = (['ab', 'aab', 'agent'] as const)
    .filter((role) => tree.counts[role] > 0)
    .map((role) => `${formatNumber(tree.counts[role], {}, figures)} ${rungShort(role.toUpperCase(), ladder)}`)
    .join(' · ');
  return t.below({ total: tree.counts.total, parts });
}

/** The tree's shape, the search's answer, and what is open — one model for both layouts. */
function useTreeModel(tree: OrgTree, query: string) {
  const byId = useMemo(() => new Map(tree.nodes.map((n) => [n.membershipId, n])), [tree]);
  const childrenOf = useMemo(() => {
    const below = new Map<string, OrgTreeNode[]>();
    for (const node of tree.nodes) {
      if (node.leaderId) below.set(node.leaderId, [...(below.get(node.leaderId) ?? []), node]);
    }
    for (const [id, team] of below) below.set(id, ordered(team));
    return below;
  }, [tree]);
  // The roots, and anybody whose leader is not in the payload, as the canvas places them.
  const roots = useMemo(() => [
    ...tree.rootIds.map((id) => byId.get(id)).filter((n): n is OrgTreeNode => Boolean(n)),
    ...tree.nodes.filter((n) => n.leaderId !== null && !byId.has(n.leaderId) && !tree.rootIds.includes(n.membershipId)),
  ], [tree, byId]);

  /** While searching: the matches and every leader above them, and the units to open to reach them. */
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

function useOpen(initial: () => Set<string>, opened: Set<string> | undefined) {
  const [open, setOpen] = useState(initial);
  // A search opens the units on the way to what it found (UI-059); the reader may close them again.
  useEffect(() => {
    if (!opened || opened.size === 0) return;
    setOpen((now) => {
      if ([...opened].every((id) => now.has(id))) return now;
      return new Set([...now, ...opened]);
    });
  }, [opened]);
  const toggle = (id: string) => setOpen((now) => {
    const next = new Set(now);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  return [open, toggle] as const;
}

const toneOf = (node: OrgTreeNode): PersonRowTone => (node.isSelf ? 'self' : node.role === 'agent' ? 'default' : 'tinted');

export function GroupTree({
  tree,
  personHref,
  query = '',
}: {
  tree: OrgTree;
  /** Where a row goes; `undefined` for a row that opens nothing (D-drill, O-6). */
  personHref?: (membershipId: string) => string | undefined;
  query?: string;
}) {
  const t = useMessages(groupTreeMessages);
  const model = useTreeModel(tree, query);
  const nothing = model.found !== null && model.found.shown.size === 0;
  return (
    <>
      {nothing && <p role="status" className="rounded-lg bg-card px-5 py-6 text-center text-md text-muted">{t.noMatch}</p>}
      {!nothing && (
        <>
          <div className="lg:hidden" data-testid="group-tree-list">
            <TreeList tree={tree} personHref={personHref} model={model} />
          </div>
          <div className="max-lg:hidden" data-testid="group-tree-table">
            <TreeTable tree={tree} personHref={personHref} model={model} />
          </div>
        </>
      )}
    </>
  );
}

type Model = ReturnType<typeof useTreeModel>;

/** Below 1024px: the shared person rows in the shared indent (UI-058's tablet, UI-059, UI-073). */
function TreeList({ tree, personHref, model }: {
  tree: OrgTree;
  personHref?: (membershipId: string) => string | undefined;
  model: Model;
}) {
  const t = useMessages(groupTreeMessages);
  const ladder = useLadder();
  const prefix = useId();
  const [open, toggle] = useOpen(() => defaultOpenInList(tree), model.found?.opened);

  const row = (node: OrgTreeNode, team: OrgTreeNode[]) => {
    const tone = toneOf(node);
    const expanded = open.has(node.membershipId);
    const name = displayName(node);
    return (
      <PersonRow
        name={name}
        photoUrl={node.photoUrl}
        seed={node.membershipId}
        href={personHref?.(node.membershipId)}
        tone={tone}
        height={60}
        className="md:max-lg:min-h-16 md:max-lg:[&>:first-child]:!h-10 md:max-lg:[&>:first-child]:!w-10"
        badge={node.isSelf ? <TonePill tone="blue" className="font-bold">{t.you}</TonePill> : undefined}
        meta={(
          <>
            <span className="shrink-0 font-medium md:max-lg:text-base">{rungShort(node.role.toUpperCase(), ladder)}</span>
            <ActivityPill count={node.todayActivityCount ?? 0} onTint={tone === 'tinted'} />
          </>
        )}
        trailing={team.length > 0 ? (
          <TreeToggle
            name={name}
            open={expanded}
            onToggle={() => toggle(node.membershipId)}
            controls={`${prefix}-${node.membershipId}`}
            onNavy={node.isSelf}
          />
        ) : undefined}
      />
    );
  };

  const seen = new Set<string>();
  const branch = (node: OrgTreeNode): React.ReactNode => {
    // A cycle is prevented server-side; a list that could loop on bad data would hang the tab.
    if (seen.has(node.membershipId)) return null;
    seen.add(node.membershipId);
    const team = model.visible(model.childrenOf.get(node.membershipId) ?? []);
    const expanded = open.has(node.membershipId);
    return (
      <>
        {row(node, team)}
        {team.length > 0 && expanded && (
          <TreeIndent id={`${prefix}-${node.membershipId}`} label={t.team({ name: displayName(node) })}>
            {team.map((child) => (
              <TreeNode key={child.membershipId} className="[--elbow:1.875rem] md:max-lg:[--elbow:2rem]">
                <div data-node={child.membershipId}>{branch(child)}</div>
              </TreeNode>
            ))}
          </TreeIndent>
        )}
      </>
    );
  };

  const roots = model.visible(model.roots);
  return (
    <div className="flex flex-col gap-1.5">
      {tree.leader && !model.found && <Upline leader={tree.leader} ladder={ladder} />}
      <ul className="flex flex-col gap-1.5">
        {roots.map((root) => (
          <li key={root.membershipId} data-node={root.membershipId}>{branch(root)}</li>
        ))}
      </ul>
    </div>
  );
}

/** The reader's own leader: muted, not a link, *AB · Leader Anda* (UI-059, UI-072); no pill. */
function Upline({ leader, ladder }: { leader: NonNullable<OrgTree['leader']>; ladder: OrgLevel[] }) {
  const t = useMessages(groupTreeMessages);
  return (
    <div data-upline="">
      <PersonRow
        name={leader.fullName}
        seed={leader.membershipId}
        tone="muted"
        nameClassName="text-base"
        meta={<span>{rungShort(leader.role.toUpperCase(), ladder)} · {t.yourLeader}</span>}
      />
    </div>
  );
}

/** From 1024px: one card, its columns *Nama · Peran · Langsung · Hari ini · ⌄*, every unit open (UI-058). */
function TreeTable({ tree, personHref, model }: {
  tree: OrgTree;
  personHref?: (membershipId: string) => string | undefined;
  model: Model;
}) {
  const t = useMessages(groupTreeMessages);
  const ladder = useLadder();
  const figures = useFigureLanguage();
  const prefix = useId();
  const [open, toggle] = useOpen(
    () => new Set(tree.nodes.filter((n) => n.isLeader).map((n) => n.membershipId)),
    model.found?.opened,
  );
  const GRID = 'grid grid-cols-[minmax(0,1fr)_110px_100px_140px_40px] items-center';

  const seen = new Set<string>();
  const branch = (node: OrgTreeNode, level: number): React.ReactNode => {
    if (seen.has(node.membershipId)) return null;
    seen.add(node.membershipId);
    const team = model.visible(model.childrenOf.get(node.membershipId) ?? []);
    const expanded = open.has(node.membershipId);
    const name = displayName(node);
    const href = personHref?.(node.membershipId);
    const self = node.isSelf;
    const tinted = !self && node.role !== 'agent';
    return (
      <li key={node.membershipId} data-node={node.membershipId}>
        <div
          data-row=""
          className={cn(
            GRID,
            'relative h-[52px] border-b border-divider px-5 text-md',
            self ? 'mx-2 my-1 rounded-row border-0 bg-navy px-3 text-white' : tinted ? 'bg-amber/[0.12]' : 'bg-card',
            href && 'cursor-pointer has-[[data-row-main]:focus-visible]:outline has-[[data-row-main]:focus-visible]:outline-2 has-[[data-row-main]:focus-visible]:-outline-offset-2 has-[[data-row-main]:focus-visible]:outline-amber',
            href && (self ? 'hover:bg-navy-soft' : tinted ? 'hover:bg-amber/20' : 'hover:bg-hover-row'),
          )}
        >
          <div className="flex h-full min-w-0 items-center gap-2.5">
            {Array.from({ length: level }, (_, i) => (
              <span key={i} aria-hidden="true" className={cn('h-full w-[34px] shrink-0 border-l-2 border-line', i === 0 && 'ml-[15px]')} />
            ))}
            <Avatar name={name} photoUrl={node.photoUrl} seed={node.membershipId} size={32} />
            {href ? (
              <Link
                href={href}
                data-row-main=""
                className="min-w-0 truncate font-bold uppercase tracking-[0.2px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                {name}
              </Link>
            ) : (
              <span className="min-w-0 truncate font-bold uppercase tracking-[0.2px]">{name}</span>
            )}
            {self && <TonePill tone="blue" className="font-bold">{t.you}</TonePill>}
          </div>
          <div>
            <RolePill role={node.role} onNavy={self}>{rungShort(node.role.toUpperCase(), ladder)}</RolePill>
          </div>
          <div>
            <span className="sr-only">{t.columns.direct}: </span>
            {node.directCount > 0
              ? formatNumber(node.directCount, {}, figures)
              : <><span aria-hidden="true">·</span><span className="sr-only">{t.noneDirect}</span></>}
          </div>
          <div><ActivityPill count={node.todayActivityCount ?? 0} onTint={tinted} /></div>
          <div className="flex justify-end">
            {team.length > 0 && (
              <TreeToggle
                name={name}
                open={expanded}
                onToggle={() => toggle(node.membershipId)}
                controls={`${prefix}-${node.membershipId}`}
                onNavy={self}
              />
            )}
          </div>
        </div>
        {team.length > 0 && expanded && (
          <ul id={`${prefix}-${node.membershipId}`} aria-label={t.team({ name })}>
            {team.map((child) => branch(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-[940px] rounded-lg bg-card py-1.5">
      <div aria-hidden="true" className={cn(GRID, 'h-9 border-b border-base px-5 text-sm font-semibold text-muted')}>
        <span>{t.columns.name}</span>
        <span>{t.columns.role}</span>
        <span>{t.columns.direct}</span>
        <span>{t.columns.today}</span>
        <span />
      </div>
      {tree.leader && !model.found && (
        <div data-upline="" className={cn(GRID, 'h-10 border-b border-divider px-5 text-base text-muted')}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={tree.leader.fullName} seed={tree.leader.membershipId} size={24} className="opacity-60" />
            <span className="min-w-0 truncate font-bold uppercase tracking-[0.2px]">{tree.leader.fullName}</span>
            <span className="shrink-0">{t.yourLeader}</span>
          </div>
          <span>{rungShort(tree.leader.role.toUpperCase(), ladder)}</span>
          <span />
          <span />
          <span />
        </div>
      )}
      <ul>{model.visible(model.roots).map((root) => branch(root, 0))}</ul>
    </div>
  );
}

/**
 * **The *Cari agen* pill** (UI-059): 40px, a magnifier, 16px words on a phone so iOS does not zoom; the page draws it
 * on the title row below 1024px (its `control`) and in the bar over the card from 1024px. It filters this tree only.
 */
export function TreeSearch({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const t = useMessages(groupTreeMessages);
  return (
    <label
      className={cn(
        'flex h-10 items-center gap-1.5 rounded-pill bg-card px-3.5 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-amber md:max-lg:h-11',
        className,
      )}
    >
      <LineIcon name="search" className="h-4 w-4 shrink-0" />
      <span className="sr-only">{t.search}</span>
      <input
        type="search"
        value={value}
        placeholder={t.search}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[1rem] text-ink placeholder:text-muted focus:outline-none md:text-md"
      />
    </label>
  );
}
