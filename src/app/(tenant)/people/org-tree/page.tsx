'use client';

import { useEffect, useState } from 'react';
import { OrgTree } from '@/components/org-tree/org-tree';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTree } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readOrgTree, type OrgTree as OrgTreeData } from '@/lib/org';

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
 */
export default function OrgTreePage() {
  const [tree, setTree] = useState<OrgTreeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

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
            <OrgTree tree={tree} personHref={(id) => `/people/members/${id}`} />
          </>
        )}
      </Card>
    </Page>
  );
}
