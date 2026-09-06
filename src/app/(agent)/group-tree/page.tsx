'use client';

import { useEffect, useState } from 'react';
import { OrgTree } from '@/components/org-tree/org-tree';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readOrgTree, type OrgTree as OrgTreeData } from '@/lib/org';

/**
 * Group tree (`Overall.html:3639-3660`) — your own downline.
 *
 * Ego-centric: layer 1 is you, and your own leader is drawn above without being a layer.
 * The server decides what comes back, so this screen never asks for a scope — a leader
 * gets themselves and their downline, and that is the whole of AC-2 as far as here is
 * concerned.
 *
 * Cards do not link anywhere. The prototype drills through to the Unit Dashboard, which
 * is a Phase 13 placeholder, and the person page is an Owner and Admin route — sending a
 * leader there would land them on a nav they cannot use.
 */
export default function GroupTreePage() {
  const [tree, setTree] = useState<OrgTreeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void readOrgTree()
      .then(setTree)
      .catch((err) => setError(toDisplayError(err)));
  }, []);

  return (
    <Page
      title="Group Overview"
      subtitle="Your leader, you, and your full downline, laid out by layer."
      permission="org_tree:read"
    >
      {error && <ErrorBanner {...error} />}

      <Card>
        {tree === null && !error && (
          <p role="status" className="text-md text-muted">
            Loading…
          </p>
        )}

        {tree && tree.nodes.length <= 1 && (
          <EmptyState title="Nobody reports to you yet. Once you add agents to your unit they appear here, with everyone below them." />
        )}

        {tree && tree.nodes.length > 1 && <OrgTree tree={tree} />}
      </Card>
    </Page>
  );
}
