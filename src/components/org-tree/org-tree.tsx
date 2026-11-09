'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  avatarClassFor, rungShort, shortOfRung, useLadder, RoleBadge, SEEDED_LADDER,
} from '@/components/ui/role-badge';
import { TAP_TARGET } from '@/components/ui/phone';
import { TermTip } from '@/components/ui/term-tip';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { orgTreeMessages } from '@/i18n/messages/org-tree';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import type { OrgLevel } from '@/lib/tenant-config-cache';
import type { OrgTree as OrgTreeData, OrgTreeNode } from '@/lib/org';
import { defaultCollapsed, defaultOpenInList, everyUnit, layoutTree, NODE_HEIGHT, NODE_WIDTH, searchTree } from './layout';

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
  /** The reader's language (P18.10-T4; `useLanguage()`): English, the source, when given none. */
  language: Language = SOURCE_LANGUAGE,
): string {
  const { directAgents } = messagesIn(orgTreeMessages, language);
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
    // The badge's name (P18.7-T9 AC-1), a long label lower-cased inside the sentence.
    const name = shortOfRung(rung);
    const short = name === rung.code ? name : name.toLowerCase();
    parts.push(
      rung.code === 'AGENT'
        // The prototype's exact words for the commonest case.
        ? directAgents({ n })
        : `${n} ${short}`,
    );
  }
  return parts.join(', ');
}

export function OrgTree({
  tree,
  personHref,
  asList = false,
  query = '',
  openAll = 0,
}: {
  tree: OrgTreeData;
  /**
   * Where a card goes when clicked. Omitted where the reader cannot open a person; `undefined` for
   * one card leaves that card inert (the Group tree's reader and their leader, P15-T4 AC-3).
   */
  personHref?: (membershipId: string) => string | undefined;
  /**
   * **An indented list in place of the canvas** — `/group-tree`'s below 768px (P18.7-T8 AC-3; the
   * client's UI review, UI-025: the tree grew right, 516px wide in a 285px box, and only the reader
   * showed). The page decides, from the width it has known since it mounted, so the canvas never flashes
   * on a phone before the list. The office's tree, `/people/org-tree`, draws it too since the client reviewed
   * it (P18.9-T7 AC-4, ADR-0178 §5; UI-036).
   */
  asList?: boolean;
  /**
   * **The Org tree's search** (OWN UI-026; OWN case 8): the people whose name or agent code holds it are highlighted, and
   * every unit on the way down to them is opened — nobody is hidden (`searchTree`). Empty is no search.
   */
  query?: string;
  /** ***Buka semua*** (OWN UI-026): each new value opens every unit. `0`, the start, opens nothing. */
  openAll?: number;
}) {
  const t = useMessages(orgTreeMessages);
  const language = useLanguage();
  // The company's ladder: labels and colours come from it, not from a map here (P4-T9).
  const ladder = useLadder();
  const [collapsed, setCollapsed] = useState(() => defaultCollapsed(tree));
  const layout = useMemo(() => layoutTree(tree, collapsed), [tree, collapsed]);
  const found = useMemo(() => searchTree(tree, query), [tree, query]);
  const box = useRef<HTMLDivElement>(null);

  // The search opens the units on the way to what it found; the reader may close them again (Group Tree's rule, D-05).
  useEffect(() => {
    if (!found || found.path.size === 0) return;
    setCollapsed((now) => {
      if (![...found.path].some((id) => now.has(id))) return now;
      return new Set([...now].filter((id) => !found.path.has(id)));
    });
  }, [found]);

  useEffect(() => {
    if (openAll > 0) setCollapsed(new Set());
  }, [openAll]);

  // The first person found is brought into view, on the canvas and in the list alike, once the path has opened.
  useEffect(() => {
    const first = found ? [...found.matches][0] : undefined;
    if (!first) return;
    const frame = requestAnimationFrame(() => {
      const at = box.current?.querySelector<HTMLElement>(`[data-node="${CSS.escape(first)}"]`);
      at?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [found, collapsed]);

  function toggle(membershipId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(membershipId)) next.add(membershipId);
      return next;
    });
  }

  const hiddenCount = tree.nodes.length - layout.placed.length;

  return (
    <div ref={box}>
      {found && found.matches.size === 0 && (
        <p role="status" className="mb-3 rounded-md bg-base px-3 py-2 text-md text-muted">{t.noMatch}</p>
      )}
      {found && found.matches.size > 0 && (
        <p role="status" className="sr-only">{t.found({ n: found.matches.size })}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-md text-muted">
          {tree.counts.total === 0
            ? t.nobody
            : t.counts({
              total: tree.counts.total,
              ab: `${tree.counts.ab} ${rungShort('AB', ladder)}`,
              aab: `${tree.counts.aab} ${rungShort('AAB', ladder)}`,
              agent: `${tree.counts.agent} ${rungShort('AGENT', ladder)}`,
            })}
        </p>
        <ul className="flex flex-wrap items-center gap-3">
          {(['ab', 'aab', 'agent'] as const).map((role) => (
            <li key={role} className="flex items-center gap-1.5 text-sm text-muted">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-sm ${avatarClassFor(role, ladder).split(' ')[0]}`}
              />
              {/* The badges' own names, *AB* · *AAB* · *Agent* (P18.7-T8 AC-3, ADR-0167 §10; UI-025, UI-027):
                  the prototype's legend said *Agency Builder* and *Associate AB* beside badges reading
                  *AB* and *AAB*, a third name for the middle rung. */}
              {rungShort(role, ladder)}
              {/* What *AAB* stands for, once, in the legend that names the badges (P18.7-T9 AC-3; UI-028). A ladder
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
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">{t.yourLeader}</p>
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

      {asList ? <OrgList tree={tree} personHref={personHref} ladder={ladder} found={found} openAll={openAll} /> : (
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
                {t.layer({ n: column.layer })}
              </div>
              {column.nodes.map(({ node, x, y }) => {
                const href = personHref?.(node.membershipId);
                const label = displayName(node);
                const match = found?.matches.has(node.membershipId) ?? false;
                return (
                  <div
                    key={node.membershipId}
                    data-node={node.membershipId}
                    data-match={match ? '' : undefined}
                    className={cn(
                      'absolute flex items-center gap-2 rounded-md border bg-card p-2',
                      node.isSelf || match ? 'border-primary' : 'border-hairline',
                      // OWN UI-026: the person the search found, ringed in the focus colour and tinted.
                      match && 'bg-primary/[0.16] ring-2 ring-primary',
                    )}
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
                          <span className="ml-1 rounded bg-primary px-1 text-sm font-bold text-primary-contrast">
                            {t.you}
                          </span>
                        )}
                        {match && <span className="sr-only">{` (${t.matched})`}</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <RoleBadge role={node.role} tone="muted" />
                      </span>
                      {/* Their own unit, never cumulative — the prototype is explicit
                          about this, and a cumulative number would double-count everybody
                          below. */}
                      {node.isLeader && (
                        <span className="mt-0.5 block truncate text-2xs text-muted">
                          {unitBreakdown(node.directCounts, undefined, language)}
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
                            ? t.show({ name: node.fullName })
                            : t.hide({ name: node.fullName })
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
        <p className="mt-3 text-sm text-muted">{t.closed({ n: hiddenCount })}</p>
      )}
    </div>
  );
}

/**
 * **The tree as a phone draws it: an indented list that opens and closes** (P18.7-T8 AC-3; the client's
 * UI review, UI-025). The same people in the same order as the canvas — depth first, each leader's team
 * under them — each line a card's content: the avatar, the name (a link where the card's is), *YOU*, the
 * rung's badge and a leader's unit, *"3 direct agents, 2 AAB"*. A leader's line has the canvas's own
 * control, + or −, named *Show* or *Hide who reports to {name}*, `aria-expanded`, a 44px target; it is a
 * button, so Tab reaches it and Enter or Space opens it. **It opens on the reader's own line, one level
 * down**: their direct reports shown, everybody's below them closed, and the lines above the reader open
 * as far as the reader — an Admin's office-wide tree included — so the reader is always in view.
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-4; UI-142, *Org tree names 17px*):* **the whole line is the person's link**, the name
 * stretched over it as the shared person row does it, so the target is the line's 44px and more rather than the name's
 * 17px; the + or − sits above it, its own 44 × 44px target, on a phone and a tablet (the list is drawn below 1024px).
 */
function OrgList({
  tree,
  personHref,
  ladder,
  found,
  openAll,
}: {
  tree: OrgTreeData;
  personHref?: (membershipId: string) => string | undefined;
  ladder: OrgLevel[];
  found: ReturnType<typeof searchTree>;
  openAll: number;
}) {
  const t = useMessages(orgTreeMessages);
  const language = useLanguage();
  const [open, setOpen] = useState(() => defaultOpenInList(tree));
  // The search opens the lines on the way to what it found (OWN UI-026); *Buka semua* opens every one.
  useEffect(() => {
    if (!found || found.path.size === 0) return;
    setOpen((now) => ([...found.path].every((id) => now.has(id)) ? now : new Set([...now, ...found.path])));
  }, [found]);
  useEffect(() => {
    if (openAll > 0) setOpen(everyUnit(tree));
  }, [openAll, tree]);
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
        const match = found?.matches.has(node.membershipId) ?? false;
        return (
          <li key={node.membershipId} data-node={node.membershipId} data-match={match ? '' : undefined}>
            <div
              className={cn(
                'relative flex min-h-11 items-center gap-2 border-b border-hairline py-1.5',
                node.isSelf && 'bg-primary/[0.08]',
                // OWN UI-026: the person the search found, tinted and edged in the focus colour.
                match && 'bg-primary/[0.16] shadow-[inset_3px_0_0_var(--color-primary)]',
                // The ring of the line's link, drawn round the line (UI-142).
                href && 'has-[[data-line-link]:focus-visible]:outline has-[[data-line-link]:focus-visible]:outline-2 has-[[data-line-link]:focus-visible]:-outline-offset-2 has-[[data-line-link]:focus-visible]:outline-primary',
              )}
              style={{ paddingLeft: level * 16 }}
            >
              {node.isLeader ? (
                <button
                  type="button"
                  onClick={() => toggle(node.membershipId)}
                  aria-expanded={expanded}
                  aria-label={expanded ? t.hide({ name: node.fullName }) : t.show({ name: node.fullName })}
                  className={cn(
                    'relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-sm text-navy',
                    TAP_TARGET,
                    // And on a tablet, where the list is drawn too (UI-142).
                    'md:max-lg:min-h-11 md:max-lg:min-w-11',
                  )}
                >
                  {expanded ? '−' : '+'}
                </button>
              ) : (
                <span aria-hidden="true" className="w-6 shrink-0 max-lg:w-11" />
              )}
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${avatarClassFor(node.role, ladder)}`}
              >
                {node.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-md font-semibold text-navy">
                  {href ? (
                    <Link
                      href={href}
                      data-line-link=""
                      className="underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                    >
                      {label}
                    </Link>
                  ) : label}
                  {node.isSelf && <span className="ml-1 rounded bg-primary px-1 text-sm font-bold text-primary-contrast">{t.you}</span>}
                  {match && <span className="sr-only">{` (${t.matched})`}</span>}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <RoleBadge role={node.role} tone="muted" />
                  {node.isLeader && <span className="text-xs text-muted">{unitBreakdown(node.directCounts, undefined, language)}</span>}
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
