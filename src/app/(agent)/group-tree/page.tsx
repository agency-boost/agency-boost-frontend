'use client';

import { useEffect, useMemo, useState } from 'react';
import { GroupTree, TreeSearch, useTreeSummary } from '@/components/org-tree/group-tree';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTree } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { groupTreeMessages } from '@/i18n/messages/group-tree';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readOrgTree, type OrgTree as OrgTreeData } from '@/lib/org';
import { useSession } from '@/lib/session';

/**
 * Group tree (`Overall.html:3639-3660`) — your own downline.
 *
 * Ego-centric: layer 1 is you, and your own leader is drawn above without being a layer.
 * The server decides what comes back, so this screen never asks for a scope — a leader
 * gets themselves and their downline, and that is the whole of AC-2 as far as here is
 * concerned.
 *
 * **A card opens the person** (P15-T4 AC-3, D-drill; parity I-34 amended), as the prototype's
 * click does (`Overall.html:8408-8411`) and by `KPM_Owner.html:2228-2230`'s rule for who opens
 * what: somebody who leads opens their Unit Dashboard, `/unit/dashboard/{membershipId}`, and
 * anybody else their *Personal Summary* in the coaching shell, `/coaching/{membershipId}/summary`.
 * Leading is the graph (OD-23): the server's `isLeader`, a direct report, never the rung, so an AAB
 * who leads nobody opens their summary. The reader's own card and their own leader are inert, as the
 * prototype's `.self` and `.leader` are. Until Phase 15 the cards linked nowhere: the dashboard was
 * a sign, and the person page is an Owner and Admin route a leader's nav cannot use.
 *
 * The same rule for the Owner and the Admin in their field view, who read the whole office as one
 * tree (the server's answer to a tenant admin): their own leader is then an ordinary node, and still
 * inert. Each target keeps its own guard; a link decides what is offered, never what is allowed.
 *
 * **UI V1 (2026-10-30, Phase 18.99 T9; UI-058, UI-059, UI-072 to UI-075): rows at every size, no canvas** —
 * `GroupTree`: the indented list of the shared person rows below 1024px, one card with columns from 1024px; today's
 * activity pill on every row but the upline's; the whole row opens the person, with no ›; *Cari agen* on the title row
 * below 1024px and over the card from 1024px, filtering this tree. **The reader's own row opens their Unit Dashboard**
 * (UI-072) when they lead somebody; their leader stays inert. The office's *Org Tree* keeps the canvas.
 */
export default function GroupTreePage() {
  const [tree, setTree] = useState<OrgTreeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const { me } = useSession();
  const t = useMessages(groupTreeMessages);
  const [query, setQuery] = useState('');
  const membership = me?.membership ?? null;
  // A member on the agent rung who leads somebody reads their unit (ADR-0087) but coaches nobody: their
  // coaching tabs and subject reads are `own` only, so a summary link would answer *not found*. The
  // Owner and the Admin keep theirs, whatever rung they stand on.
  const opensCoaching = !membership || membership.hierarchyRole !== 'agent' || membership.isKpmOwner || membership.isKpmAdmin;
  const personHref = useMemo(() => (tree ? drillFor(tree, opensCoaching) : undefined), [tree, opensCoaching]);

  useEffect(() => {
    void readOrgTree()
      .then(setTree)
      .catch((err) => setError(toDisplayError(err)));
  }, []);

  // The title is the nav item's words (P18.95-T9 AC-2, UI-027): the prototype's *Group Overview* sat under a nav item
  // reading *Group tree*. *Tap*, not *Click* (AC-5).
  const populated = tree !== null && tree.nodes.length > 1;
  // UI-087's rule for this page too (UI-004): the sub-line from 1024px only, unchanged there (O-9).
  return (
    <Page
      title={t.title}
      subtitle={t.subtitle}
      subtitleOnPhone={false}
      subtitleOnTablet={false}
      control={populated ? <TreeSearch value={query} onChange={setQuery} className="w-[140px] md:max-lg:w-[300px]" /> : null}
      permission="org_tree:read"
    >
      {error && <ErrorBanner {...error} />}

      {tree === null && !error && (
        <Card>
          <SkeletonTree label={t.loading} />
        </Card>
      )}

      {tree && tree.nodes.length <= 1 && (
        <Card>
          <EmptyState title={t.empty} />
        </Card>
      )}

      {populated && (
        <>
          <Summary tree={tree} search={<TreeSearch value={query} onChange={setQuery} className="w-[320px] shrink-0" />} />
          <GroupTree tree={tree} personHref={personHref} query={query} />
        </>
      )}
    </Page>
  );
}

/** *11 di bawah Anda · 3 AAB · 8 Agent* (UI-074): under the title row below 1024px, beside *Cari agen* from 1024px. */
function Summary({ tree, search }: { tree: OrgTreeData; search: React.ReactNode }) {
  const summary = useTreeSummary(tree);
  return (
    <>
      <p className="mb-2.5 text-base font-medium text-muted md:max-lg:mb-3 md:max-lg:text-md lg:hidden">{summary}</p>
      <div className="mb-3 flex items-center gap-4 max-lg:hidden">
        {search}
        <span className="text-md font-medium text-muted">{summary}</span>
      </div>
    </>
  );
}

/**
 * Where each card of this tree goes, or `undefined` for one that is inert (D-drill).
 *
 * Inert: the reader's own leader, whether the server sent that leader beside the tree (a leader's view) or as a
 * node in it (a tenant admin's). The reader opens their own Unit Dashboard (UI-072, UI V1), when they lead. Everybody else: their Unit Dashboard
 * when they lead somebody, their *Personal Summary* when they lead nobody.
 *
 * **A Personal Summary only for somebody the reader coaches**, which is somebody below them in this tree
 * (ADR-0074). An Admin's field view holds the whole office, and a card outside the Admin's own downline
 * would open coaching's *not someone you coach*: it stays inert. A leader's card still opens their Unit
 * Dashboard, which the Admin reads office-wide, and whose own drills follow the same rule. A leader on the
 * agent rung opens no Personal Summary at all (`opensCoaching`): their coaching reads are their own.
 */
function drillFor(tree: OrgTreeData, opensCoaching: boolean): (membershipId: string) => string | undefined {
  const byId = new Map(tree.nodes.map((node) => [node.membershipId, node]));
  const self = tree.nodes.find((node) => node.isSelf) ?? (tree.selfId ? byId.get(tree.selfId) : undefined);
  const selfId = self?.membershipId ?? tree.selfId;
  const inert = new Set(
    [self?.membershipId, tree.selfId, self?.leaderId, tree.leader?.membershipId]
      .filter((id): id is string => Boolean(id)),
  );
  const coached = new Set<string>();
  const below = new Map<string, string[]>();
  for (const node of tree.nodes) {
    if (node.leaderId) below.set(node.leaderId, [...(below.get(node.leaderId) ?? []), node.membershipId]);
  }
  const stack = selfId ? [...(below.get(selfId) ?? [])] : [];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (coached.has(id)) continue;
    coached.add(id);
    stack.push(...(below.get(id) ?? []));
  }
  return (membershipId) => {
    const node = byId.get(membershipId);
    // The reader's own row opens their own Unit Dashboard (UI-072), when they lead somebody.
    if (node && membershipId === selfId) return node.isLeader ? '/unit/dashboard' : undefined;
    if (!node || inert.has(membershipId)) return undefined;
    const id = encodeURIComponent(membershipId);
    if (node.isLeader) return `/unit/dashboard/${id}`;
    return opensCoaching && coached.has(membershipId) ? `/coaching/${id}/summary` : undefined;
  };
}
