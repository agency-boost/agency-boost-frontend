'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrgTree } from '@/components/org-tree/org-tree';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTree } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { groupTreeMessages } from '@/i18n/messages/group-tree';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readOrgTree, type OrgTree as OrgTreeData } from '@/lib/org';
import { useSession } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';

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
 * **On a phone the tree is an indented list that opens and closes** (`asList`; P18.95-T8 AC-3, the
 * client's UI review, UI-025), opened on the reader's own line one level down; the same links, the same
 * people. At 768px and wider it is the canvas it always was. The width is read here, when the page mounts
 * and before the tree has answered, so a phone never draws the canvas first.
 */
export default function GroupTreePage() {
  const [tree, setTree] = useState<OrgTreeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const { me } = useSession();
  const t = useMessages(groupTreeMessages);
  const phone = usePhone();
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
  return (
    <Page title={t.title} subtitle={t.subtitle} permission="org_tree:read">
      {error && <ErrorBanner {...error} />}

      <Card>
        {tree === null && !error && (
          <SkeletonTree label={t.loading} />
        )}

        {tree && tree.nodes.length <= 1 && (
          <EmptyState title={t.empty} />
        )}

        {tree && tree.nodes.length > 1 && <OrgTree tree={tree} personHref={personHref} asList={phone} />}
      </Card>
    </Page>
  );
}

/**
 * Where each card of this tree goes, or `undefined` for one that is inert (D-drill).
 *
 * Inert: the reader, and the reader's own leader, whether the server sent that leader beside the
 * tree (a leader's view) or as a node in it (a tenant admin's). Everybody else: their Unit Dashboard
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
    if (!node || inert.has(membershipId)) return undefined;
    const id = encodeURIComponent(membershipId);
    if (node.isLeader) return `/unit/dashboard/${id}`;
    return opensCoaching && coached.has(membershipId) ? `/coaching/${id}/summary` : undefined;
  };
}
