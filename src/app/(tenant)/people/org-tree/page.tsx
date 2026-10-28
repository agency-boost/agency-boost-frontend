'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrgTree } from '@/components/org-tree/org-tree';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTree } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { orgTreeHref } from '@/lib/kpm-analytics';
import { readOrgTree, type OrgTree as OrgTreeData } from '@/lib/org';
import { usePhone } from '@/lib/use-phone';

/**
 * Org tree (`KPM_Owner.html`) — the whole office.
 *
 * The same component and the same endpoint as the leader's Group tree; only the shell,
 * the copy and the drill-through differ. What comes back is wider because the requester
 * is a tenant admin, and that decision is the server's.
 *
 * **It is a forest.** The office root is one tree; anybody orphaned by a removal
 * (P3-T7) or not yet placed under a leader is another. Drawing only the office root's
 * descendants would hide exactly the people who most need finding.
 *
 * **Where a card goes** (D-drill, P18-T2 AC-7): somebody with a direct report to their Unit Dashboard, in
 * this tab — their unit and every unit nested under it, as the prototype's alert promises (`:2224-2241`);
 * anybody else to the person page, as built (parity I-34). Not coaching's *Personal Summary*, which answers
 * by who coaches whom and would refuse the Owner and the Admin outside their own downline.
 *
 * **On a phone the tree is the indented list that opens and closes** (`asList`; P18.97-T7 AC-4, ADR-0178 §5; the
 * client's KPM Owner review of 2026-10-27, UI-036: only Wilson Tanoto, layer 1, in view, the connectors running off to
 * the right), as `/group-tree` has drawn it since P18.95-T8 — opened on the reader's own line one level down, the same
 * links and the same people. At 768px and wider it is the canvas it always was (the client's *Don't change* for a
 * desktop). The width is read here, where the page mounts and before the tree has answered, so a phone never draws
 * the canvas first.
 */
export default function OrgTreePage() {
  const [tree, setTree] = useState<OrgTreeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const phone = usePhone();
  // Each card's drill, worked out once per read rather than looked up per card.
  const drills = useMemo(() => new Map(tree?.nodes.map((n) => [n.membershipId, orgTreeHref(n)]) ?? []), [tree]);

  useEffect(() => {
    void readOrgTree()
      .then(setTree)
      .catch((err) => setError(toDisplayError(err)));
  }, []);

  return (
    <Page
      title="Org Tree"
      subtitle="Every AB in this KPM and their full downline"
      permission="org_tree:read"
    >
      {error && <ErrorBanner {...error} />}

      <Card>
        {tree === null && !error && (
          <SkeletonTree label="Loading the office tree…" />
        )}

        {tree && tree.nodes.length === 0 && (
          <EmptyState title="This office has no members yet. People appear here once they have joined and been placed under a leader." />
        )}

        {tree && tree.nodes.length > 0 && (
          <>
            {tree.rootIds.length > 1 && (
              <p className="mb-3 text-md text-navy">
                {tree.rootIds.length} people report to nobody. That is the office root plus anyone
                left unassigned — each starts a tree of their own here.
              </p>
            )}
            <OrgTree tree={tree} personHref={(id) => drills.get(id)} asList={phone} />
          </>
        )}
      </Card>
    </Page>
  );
}

